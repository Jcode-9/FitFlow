import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import { EXERCISE_CATALOG, MUSCLES } from '@/data/exercise-catalog';

async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) < 1) {
    await db.execAsync(`
      CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_custom INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, performed_at TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, exercise_id INTEGER NOT NULL REFERENCES exercises(id), position INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE, set_number INTEGER NOT NULL, weight REAL NOT NULL CHECK(weight >= 0), reps INTEGER NOT NULL CHECK(reps > 0));
      CREATE INDEX workouts_date_idx ON workouts(performed_at DESC);
      INSERT INTO exercises (name) VALUES ('Wyciskanie sztangi leżąc'), ('Przysiad ze sztangą'), ('Martwy ciąg'), ('Wiosłowanie sztangą'), ('Wyciskanie hantli'), ('Podciąganie'), ('Wyciskanie nad głowę'), ('Wykroki');
      PRAGMA user_version = 1;
    `);
  }
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((current?.user_version ?? 0) < 2) {
    await db.execAsync(`ALTER TABLE workouts ADD COLUMN name TEXT NOT NULL DEFAULT 'Trening siłowy';`);
    await db.runAsync("UPDATE workouts SET name = 'Trening siłowy - ' || substr(performed_at, 9, 2) || '.' || substr(performed_at, 6, 2) || '.' || substr(performed_at, 1, 4)");
    await db.execAsync('PRAGMA user_version = 2;');
  }
  const latest = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((latest?.user_version ?? 0) < 3) {
    await db.execAsync('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
    try {
      await db.execAsync(`
        ALTER TABLE workout_exercises ADD COLUMN entry_mode TEXT NOT NULL DEFAULT 'weight' CHECK(entry_mode IN ('weight','note'));
        ALTER TABLE workout_exercises ADD COLUMN note TEXT;
        CREATE TABLE sets_v3 (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE, set_number INTEGER NOT NULL, weight REAL CHECK(weight IS NULL OR weight >= 0), reps INTEGER NOT NULL CHECK(reps > 0));
        INSERT INTO sets_v3 (id,workout_exercise_id,set_number,weight,reps) SELECT id,workout_exercise_id,set_number,weight,reps FROM sets;
        DROP TABLE sets;
        ALTER TABLE sets_v3 RENAME TO sets;
        CREATE INDEX sets_workout_exercise_idx ON sets(workout_exercise_id,set_number);
        CREATE TABLE muscle_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE);
        CREATE TABLE exercise_muscles (exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE, muscle_id INTEGER NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('primary','secondary')), PRIMARY KEY(exercise_id,muscle_id));
        CREATE UNIQUE INDEX exercise_one_primary_muscle_idx ON exercise_muscles(exercise_id) WHERE role='primary';
        CREATE TABLE workout_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE workout_template_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE, exercise_id INTEGER NOT NULL REFERENCES exercises(id), position INTEGER NOT NULL, entry_mode TEXT NOT NULL CHECK(entry_mode IN ('weight','note')), set_count INTEGER NOT NULL CHECK(set_count > 0), UNIQUE(template_id,exercise_id));
      `);
      const muscleIds = new Map<string, number>();
      for (const muscle of MUSCLES) {
        await db.runAsync('INSERT OR IGNORE INTO muscle_groups (key,name) VALUES (?,?)', muscle.key, muscle.name);
        const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM muscle_groups WHERE key=?', muscle.key);
        if (row) muscleIds.set(muscle.key, row.id);
      }
      for (const item of EXERCISE_CATALOG) {
        await db.runAsync('INSERT OR IGNORE INTO exercises (name,is_custom) VALUES (?,0)', item.name);
        const exercise = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name=?', item.name);
        const primaryId = muscleIds.get(item.primary);
        if (!exercise || !primaryId) throw new Error(`Nie udało się dodać ćwiczenia ${item.name}.`);
        await db.runAsync("INSERT OR IGNORE INTO exercise_muscles (exercise_id,muscle_id,role) VALUES (?,?, 'primary')", exercise.id, primaryId);
        for (const key of item.secondary) {
          const secondaryId = muscleIds.get(key);
          if (secondaryId) await db.runAsync("INSERT OR IGNORE INTO exercise_muscles (exercise_id,muscle_id,role) VALUES (?,?, 'secondary')", exercise.id, secondaryId);
        }
      }
      await db.execAsync('PRAGMA user_version = 3; COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
      <SQLiteProvider databaseName="fitflow.db" onInit={migrateDatabase}>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/new" options={{ presentation: 'modal', headerShown: true, title: 'Nowy trening' }} />
            <Stack.Screen name="workout/[id]" options={{ headerShown: true, title: 'Szczegóły treningu' }} />
            <Stack.Screen name="templates" options={{ headerShown: true, title: 'Szablony treningów' }} />
            <Stack.Screen name="template-edit" options={{ headerShown: true, title: 'Edytuj szablon' }} />
          </Stack>
        </ThemeProvider>
      </SQLiteProvider>
    </KeyboardProvider>
  </GestureHandlerRootView>;
}
