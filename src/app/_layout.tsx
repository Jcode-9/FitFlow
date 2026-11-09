import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

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
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return <SQLiteProvider databaseName="fitflow.db" onInit={migrateDatabase}>
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/new" options={{ presentation: 'modal', headerShown: true, title: 'Nowy trening' }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: true, title: 'Szczegóły treningu' }} />
      </Stack>
    </ThemeProvider>
  </SQLiteProvider>;
}
