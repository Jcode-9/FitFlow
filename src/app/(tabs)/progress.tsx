import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
type ExerciseStat = { id: number; name: string; sessions: number; best_load: number; best_reps: number; date: string };
type Point = { performed_at: string; best: number };
export default function ProgressScreen() {
  const db = useSQLiteContext(); const [stats, setStats] = useState<ExerciseStat[]>([]); const [selected, setSelected] = useState<number | null>(null); const [points, setPoints] = useState<Point[]>([]);
  useFocusEffect(useCallback(() => { let active = true; db.getAllAsync<ExerciseStat>(`SELECT e.id, e.name, COUNT(DISTINCT w.id) AS sessions, MAX(s.weight) AS best_load, MAX(s.reps) AS best_reps, MAX(w.performed_at) AS date FROM exercises e JOIN workout_exercises we ON we.exercise_id=e.id JOIN workouts w ON w.id=we.workout_id JOIN sets s ON s.workout_exercise_id=we.id WHERE s.weight IS NOT NULL GROUP BY e.id ORDER BY date DESC`).then((rows) => { if (active) { setStats(rows); setSelected((old) => old ?? rows[0]?.id ?? null); } }); return () => { active = false; }; }, [db]));
  useFocusEffect(useCallback(() => { let active = true; if (selected) db.getAllAsync<Point>(`SELECT w.performed_at, MAX(s.weight) AS best FROM workouts w JOIN workout_exercises we ON we.workout_id=w.id JOIN sets s ON s.workout_exercise_id=we.id WHERE we.exercise_id=? AND s.weight IS NOT NULL GROUP BY w.id ORDER BY w.performed_at`, selected).then((rows) => active && setPoints(rows)); return () => { active = false; }; }, [db, selected]));
  const current = stats.find((item) => item.id === selected); const width = 300; const height = 160; const values = points.map((p) => p.best); const min = Math.min(...values, 0); const max = Math.max(...values, 1); const coords = points.map((point, i) => `${16 + (i / Math.max(points.length - 1, 1)) * 268},${height - 18 - ((point.best - min) / (max - min || 1)) * 118}`).join(' ');
  return <Page><Heading eyebrow="Analiza" title="Małe kroki. Siła." subtitle="Porównuj wyniki w kontekście ciężaru i powtórzeń." />
    {stats.length === 0 ? <EmptyState title="Wykres pojawi się po treningu" body="Zapisz ćwiczenie i serie, a pokażemy jego historię." /> : <>
      <SectionTitle title="Wybierz ćwiczenie"/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{stats.map((item) => <Text key={item.id} onPress={() => setSelected(item.id)} accessibilityRole="button" style={{ overflow: 'hidden', color: item.id === selected ? c.background : c.text, backgroundColor: item.id === selected ? c.accent : c.surfaceRaised, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, fontWeight: '600' }}>{item.name}</Text>)}</ScrollView>
      {current && <Card><SectionTitle title={current.name}/><View accessibilityRole="image" accessibilityLabel={`Wykres ciężaru dla ${current.name}; ${points.length} treningów`}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Line x1="16" y1={height - 18} x2="284" y2={height - 18} stroke={c.border} strokeWidth="1"/><Line x1="16" y1="22" x2="284" y2="22" stroke={c.border} strokeWidth="1"/><Polyline points={coords} fill="none" stroke={c.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p, i) => { const [cx, cy] = coords.split(' ')[i].split(','); return <Circle key={p.performed_at} cx={cx} cy={cy} r="4" fill={c.accent}/>; })}</Svg></View><Text style={{ color: c.muted }}>{points.length} treningów · najwyższy ciężar {current.best_load} kg · do {current.best_reps} powtórzeń</Text></Card>}
      <Card><SectionTitle title="Jak czytać wynik?"/><Text style={{ color: c.muted, lineHeight: 21 }}>Wykres pokazuje najwyższy użyty ciężar. Zawsze porównuj go również z liczbą powtórzeń i jakością wykonania — sam większy ciężar nie oznacza postępu.</Text></Card>
    </>}
  </Page>;
}
