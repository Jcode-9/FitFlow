import type { SQLiteDatabase } from 'expo-sqlite';
import type { MuscleKey } from './exercise-catalog';

export type EntryMode = 'weight' | 'note';
export type WorkoutSummary = { id: number; name: string; performed_at: string; note: string | null; exercise_count: number; set_count: number; total_volume: number };
export type MuscleTag = { key: MuscleKey; name: string };
export type Exercise = { id: number; name: string; is_custom: number; primary_muscle: MuscleTag | null; secondary_muscles: MuscleTag[] };
export type WorkoutSet = { id: number; set_number: number; weight: number | null; reps: number };
export type WorkoutDetail = { id: number; name: string; performed_at: string; note: string | null; exercises: { id: number; name: string; entry_mode: EntryMode; note: string | null; sets: WorkoutSet[] }[] };
export type LastExerciseEntry = { entry_mode: EntryMode; note: string | null; sets: { weight: number | null; reps: number }[] };
export type TemplateExercise = { id?: number; name: string; position: number; entry_mode: EntryMode; set_count: number };
export type WorkoutTemplate = { id: number; name: string; exercises: TemplateExercise[] };

export async function listWorkouts(db: SQLiteDatabase) {
  return db.getAllAsync<WorkoutSummary>(`SELECT w.id, w.name, w.performed_at, w.note, COUNT(DISTINCT we.id) AS exercise_count, COUNT(s.id) AS set_count, COALESCE(SUM(s.weight * s.reps), 0) AS total_volume FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id = w.id LEFT JOIN sets s ON s.workout_exercise_id = we.id GROUP BY w.id ORDER BY w.created_at DESC, w.id DESC`);
}
export async function getWorkout(db: SQLiteDatabase, id: number): Promise<WorkoutDetail | null> {
  const workout = await db.getFirstAsync<Omit<WorkoutDetail, 'exercises'>>('SELECT id, name, performed_at, note FROM workouts WHERE id = ?', id);
  if (!workout) return null;
  const rows = await db.getAllAsync<{ id: number; exercise_id: number; name: string; entry_mode: EntryMode; exercise_note: string | null; set_id: number | null; set_number: number | null; weight: number | null; reps: number | null }>(`SELECT we.id, we.exercise_id, e.name, we.entry_mode, we.note AS exercise_note, s.id AS set_id, s.set_number, s.weight, s.reps FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id LEFT JOIN sets s ON s.workout_exercise_id = we.id WHERE we.workout_id = ? ORDER BY we.position, s.set_number`, id);
  const grouped = new Map<number, WorkoutDetail['exercises'][number]>();
  for (const row of rows) {
    if (!grouped.has(row.id)) grouped.set(row.id, { id: row.exercise_id, name: row.name, entry_mode: row.entry_mode, note: row.exercise_note, sets: [] });
    if (row.set_id !== null && row.set_number !== null && row.reps !== null) grouped.get(row.id)?.sets.push({ id: row.set_id, set_number: row.set_number, weight: row.weight, reps: row.reps });
  }
  return { ...workout, exercises: [...grouped.values()] };
}
export async function getExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<Exercise & { muscle_key: MuscleKey | null; muscle_name: string | null; muscle_role: 'primary' | 'secondary' | null }>(`SELECT e.*, m.key AS muscle_key, m.name AS muscle_name, em.role AS muscle_role FROM exercises e LEFT JOIN exercise_muscles em ON em.exercise_id=e.id LEFT JOIN muscle_groups m ON m.id=em.muscle_id ORDER BY e.is_custom, e.name`);
  const grouped = new Map<number, Exercise>();
  for (const row of rows) {
    if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, name: row.name, is_custom: row.is_custom, primary_muscle: null, secondary_muscles: [] });
    if (row.muscle_key && row.muscle_name && row.muscle_role) {
      const tag = { key: row.muscle_key, name: row.muscle_name };
      const exercise = grouped.get(row.id)!;
      if (row.muscle_role === 'primary') exercise.primary_muscle = tag; else exercise.secondary_muscles.push(tag);
    }
  }
  return [...grouped.values()];
}
export async function getLastExerciseEntry(db: SQLiteDatabase, exerciseId: number, excludeWorkoutId?: number): Promise<LastExerciseEntry | null> {
  const link = await db.getFirstAsync<{ id: number; entry_mode: EntryMode; note: string | null }>(`SELECT we.id, we.entry_mode, we.note FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id WHERE we.exercise_id=? AND (? IS NULL OR w.id != ?) ORDER BY w.performed_at DESC, w.created_at DESC, w.id DESC LIMIT 1`, exerciseId, excludeWorkoutId ?? null, excludeWorkoutId ?? null);
  if (!link) return null;
  const sets = await db.getAllAsync<{ weight: number | null; reps: number }>('SELECT weight,reps FROM sets WHERE workout_exercise_id=? ORDER BY set_number', link.id);
  return { entry_mode: link.entry_mode, note: link.note, sets };
}

export async function saveWorkout(db: SQLiteDatabase, input: { id?: number; name: string; date: string; note: string; exercises: { id?: number; name: string; entry_mode: EntryMode; note: string; sets: { weight: number | null; reps: number }[] }[] }) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    let workoutId = input.id;
    if (workoutId) {
      await tx.runAsync('UPDATE workouts SET name=?, performed_at=?, note=?, created_at=CURRENT_TIMESTAMP WHERE id=?', input.name, input.date, input.note || null, workoutId);
      await tx.runAsync('DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id=?)', workoutId);
      await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id=?', workoutId);
    } else {
      const result = await tx.runAsync('INSERT INTO workouts (name,performed_at,note) VALUES (?,?,?)', input.name, input.date, input.note || null);
      workoutId = result.lastInsertRowId;
    }
    for (const [position, exercise] of input.exercises.entries()) {
      let exerciseId = exercise.id;
      if (!exerciseId) {
        await tx.runAsync('INSERT OR IGNORE INTO exercises (name,is_custom) VALUES (?,1)', exercise.name);
        exerciseId = (await tx.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name=?', exercise.name))?.id;
      }
      if (!exerciseId) throw new Error('Nie udało się zapisać ćwiczenia.');
      const link = await tx.runAsync('INSERT INTO workout_exercises (workout_id,exercise_id,position,entry_mode,note) VALUES (?,?,?,?,?)', workoutId, exerciseId, position, exercise.entry_mode, exercise.entry_mode === 'note' ? exercise.note.trim() || null : null);
      for (const [index, set] of exercise.sets.entries()) await tx.runAsync('INSERT INTO sets (workout_exercise_id,set_number,weight,reps) VALUES (?,?,?,?)', link.lastInsertRowId, index + 1, exercise.entry_mode === 'weight' ? set.weight : null, set.reps);
    }
  });
}
export async function deleteWorkout(db: SQLiteDatabase, id: number) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id=?)', id);
    await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id=?', id);
    await tx.runAsync('DELETE FROM workouts WHERE id=?', id);
  });
}

export async function listTemplates(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; name: string; exercise_count: number }>('SELECT t.id,t.name,COUNT(te.id) AS exercise_count FROM workout_templates t LEFT JOIN workout_template_exercises te ON te.template_id=t.id GROUP BY t.id ORDER BY t.name COLLATE NOCASE');
}
export async function getWorkoutTemplate(db: SQLiteDatabase, id: number): Promise<WorkoutTemplate | null> {
  const template = await db.getFirstAsync<{ id: number; name: string }>('SELECT id,name FROM workout_templates WHERE id=?', id);
  if (!template) return null;
  const exercises = await db.getAllAsync<TemplateExercise>(`SELECT te.exercise_id AS id,e.name,te.position,te.entry_mode,te.set_count FROM workout_template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=? ORDER BY te.position`, id);
  return { ...template, exercises };
}
export async function saveWorkoutTemplate(db: SQLiteDatabase, input: { id?: number; name: string; exercises: TemplateExercise[] }) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    let templateId = input.id;
    if (templateId) { await tx.runAsync('UPDATE workout_templates SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', input.name.trim(), templateId); await tx.runAsync('DELETE FROM workout_template_exercises WHERE template_id=?', templateId); }
    else { templateId = (await tx.runAsync('INSERT INTO workout_templates (name) VALUES (?)', input.name.trim())).lastInsertRowId; }
    for (const [position, exercise] of input.exercises.entries()) {
      let exerciseId = exercise.id;
      if (!exerciseId) { await tx.runAsync('INSERT OR IGNORE INTO exercises (name,is_custom) VALUES (?,1)', exercise.name); exerciseId = (await tx.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name=?', exercise.name))?.id; }
      if (!exerciseId) throw new Error('Nie udało się dodać ćwiczenia do szablonu.');
      await tx.runAsync('INSERT INTO workout_template_exercises (template_id,exercise_id,position,entry_mode,set_count) VALUES (?,?,?,?,?)', templateId, exerciseId, position, exercise.entry_mode, exercise.set_count);
    }
  });
}
export async function deleteWorkoutTemplate(db: SQLiteDatabase, id: number) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM workout_template_exercises WHERE template_id=?', id);
    await tx.runAsync('DELETE FROM workout_templates WHERE id=?', id);
  });
}
