import type { SQLiteDatabase } from 'expo-sqlite';
export type WorkoutSummary = { id: number; name: string; performed_at: string; note: string | null; exercise_count: number; set_count: number; total_volume: number };
export type Exercise = { id: number; name: string; is_custom: number };
export type WorkoutDetail = { id: number; name: string; performed_at: string; note: string | null; exercises: { id: number; name: string; sets: { id: number; set_number: number; weight: number; reps: number }[] }[] };
export async function listWorkouts(db: SQLiteDatabase) { return db.getAllAsync<WorkoutSummary>(`SELECT w.id, w.name, w.performed_at, w.note, COUNT(DISTINCT we.id) AS exercise_count, COUNT(s.id) AS set_count, COALESCE(SUM(s.weight * s.reps), 0) AS total_volume FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id = w.id LEFT JOIN sets s ON s.workout_exercise_id = we.id GROUP BY w.id ORDER BY w.created_at DESC, w.id DESC`); }
export async function getWorkout(db: SQLiteDatabase, id: number): Promise<WorkoutDetail | null> {
  const workout = await db.getFirstAsync<Omit<WorkoutDetail, 'exercises'>>('SELECT id, name, performed_at, note FROM workouts WHERE id = ?', id);
  if (!workout) return null;
  const rows = await db.getAllAsync<{ id: number; exercise_id: number; name: string; set_id: number | null; set_number: number | null; weight: number | null; reps: number | null }>(`SELECT we.id, we.exercise_id, e.name, s.id AS set_id, s.set_number, s.weight, s.reps FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id LEFT JOIN sets s ON s.workout_exercise_id = we.id WHERE we.workout_id = ? ORDER BY we.position, s.set_number`, id);
  const grouped = new Map<number, WorkoutDetail['exercises'][number]>();
  for (const row of rows) { if (!grouped.has(row.id)) grouped.set(row.id, { id: row.exercise_id, name: row.name, sets: [] }); if (row.set_id !== null && row.set_number !== null && row.weight !== null && row.reps !== null) grouped.get(row.id)?.sets.push({ id: row.set_id, set_number: row.set_number, weight: row.weight, reps: row.reps }); }
  return { ...workout, exercises: [...grouped.values()] };
}
export async function getExercises(db: SQLiteDatabase) { return db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY is_custom, name'); }
export async function saveWorkout(db: SQLiteDatabase, input: { id?: number; name: string; date: string; note: string; exercises: { id?: number; name: string; sets: { weight: number; reps: number }[] }[] }) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    let workoutId = input.id;
    if (workoutId) { await tx.runAsync('UPDATE workouts SET name = ?, performed_at = ?, note = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?', input.name, input.date, input.note || null, workoutId); await tx.runAsync('DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', workoutId); await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId); }
    else { const result = await tx.runAsync('INSERT INTO workouts (name, performed_at, note) VALUES (?, ?, ?)', input.name, input.date, input.note || null); workoutId = result.lastInsertRowId; }
    for (const [position, exercise] of input.exercises.entries()) {
      let exerciseId = exercise.id;
      if (!exerciseId) { await tx.runAsync('INSERT OR IGNORE INTO exercises (name, is_custom) VALUES (?, 1)', exercise.name); exerciseId = (await tx.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', exercise.name))?.id; }
      if (!exerciseId) throw new Error('Nie udało się zapisać ćwiczenia.');
      const link = await tx.runAsync('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)', workoutId, exerciseId, position);
      for (const [index, set] of exercise.sets.entries()) await tx.runAsync('INSERT INTO sets (workout_exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?)', link.lastInsertRowId, index + 1, set.weight, set.reps);
    }
  });
}
export async function deleteWorkout(db: SQLiteDatabase, id: number) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', id);
    await tx.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', id);
    await tx.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}
