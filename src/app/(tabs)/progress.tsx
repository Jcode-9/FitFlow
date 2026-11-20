import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { MonthCalendar, MonthSnapshot, MuscleWorkloadCard } from '@/components/progress/monthly';
import { palette as c } from '@/constants/app-theme';
import { getMonthProgress, type MonthProgress } from '@/data/database';

type ExerciseStat = { id: number; name: string; sessions: number; best_load: number; best_reps: number; date: string };
type Point = { id: number; performed_at: string; best: number };
const getCurrentMonth = () => { const date = new Date(); return { year: date.getFullYear(), month: date.getMonth() + 1 }; };
const monthLabel = (year: number, month: number) => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));

export default function ProgressScreen() {
  const db = useSQLiteContext(); const [monthly, setMonthly] = useState<MonthProgress | null>(null); const [stats, setStats] = useState<ExerciseStat[]>([]); const [selected, setSelected] = useState<number | null>(null); const [points, setPoints] = useState<Point[]>([]); const [monthError, setMonthError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true; const { year, month } = getCurrentMonth();
    getMonthProgress(db, year, month).then((value) => { if (active) { setMonthly(value); setMonthError(false); } }).catch(() => active && setMonthError(true));
    db.getAllAsync<ExerciseStat>(`SELECT e.id,e.name,COUNT(DISTINCT w.id) AS sessions,MAX(s.weight) AS best_load,MAX(s.reps) AS best_reps,MAX(w.performed_at) AS date FROM exercises e JOIN workout_exercises we ON we.exercise_id=e.id JOIN workouts w ON w.id=we.workout_id JOIN sets s ON s.workout_exercise_id=we.id WHERE s.weight IS NOT NULL GROUP BY e.id ORDER BY date DESC`).then((rows) => { if (active) { setStats(rows); setSelected((old) => old ?? rows[0]?.id ?? null); } });
    return () => { active = false; };
  }, [db]));
  useFocusEffect(useCallback(() => { let active = true; if (selected) db.getAllAsync<Point>(`SELECT w.id,w.performed_at,MAX(s.weight) AS best FROM workouts w JOIN workout_exercises we ON we.workout_id=w.id JOIN sets s ON s.workout_exercise_id=we.id WHERE we.exercise_id=? AND s.weight IS NOT NULL GROUP BY w.id ORDER BY w.performed_at,w.id`, selected).then((rows) => active && setPoints(rows)); else setPoints([]); return () => { active = false; }; }, [db, selected]));

  const current = stats.find((item) => item.id === selected); const chartWidth = 300; const chartHeight = 160; const values = points.map((point) => point.best); const min = Math.min(...values, 0); const max = Math.max(...values, 1); const coords = points.map((point, index) => `${16 + (index / Math.max(points.length - 1, 1)) * 268},${chartHeight - 18 - ((point.best - min) / (max - min || 1)) * 118}`).join(' ');
  const { year, month } = getCurrentMonth(); const heading = monthLabel(year, month);

  return <Page><Heading eyebrow="Analiza" title="Małe kroki. Siła." subtitle="Zobacz regularność treningów i rozkład pracy mięśni." />
    <Pressable accessibilityRole="button" accessibilityLabel={`Otwórz pełny kalendarz treningów. ${heading}`} onPress={() => router.push('/progress-history')}>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><SectionTitle title={heading} /><Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>Pełny kalendarz ›</Text></View>{monthly ? <MonthCalendar year={year} month={month} workoutDays={monthly.workout_days} compact /> : null}</Card>
    </Pressable>
    {monthError ? <EmptyState title="Nie udało się wczytać podsumowania" body="Spróbuj ponownie otworzyć zakładkę Postępy." /> : monthly ? <>
      <Card><SectionTitle title="Podsumowanie miesiąca" /><MonthSnapshot progress={monthly} /><Text style={{ color: c.muted, fontSize: 12 }}>Tonaż to suma ciężaru × powtórzeń; serie z trybu notatki nie zwiększają tonażu.</Text></Card>
      {monthly.workout_count ? <Card><SectionTitle title="Praca partii mięśniowych" /><MuscleWorkloadCard muscles={monthly.muscles} /></Card> : <EmptyState title="Ten miesiąc dopiero się zaczyna" body="Zapisz trening, a pojawią się tu jego podsumowanie i rozkład pracy mięśni." />}
    </> : null}
    <SectionTitle title="Postęp ćwiczeń" />
    {!stats.length ? <EmptyState title="Wykres pojawi się po treningu" body="Zapisz serię z ciężarem, a pokażemy historię wyników tego ćwiczenia." /> : <>
      <Text style={{ color: c.muted, fontSize: 13 }}>Wybierz ćwiczenie</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{stats.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === selected }} onPress={() => setSelected(item.id)} style={{ overflow: 'hidden', backgroundColor: item.id === selected ? c.accent : c.surfaceRaised, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 }}><Text style={{ color: item.id === selected ? c.background : c.text, fontWeight: '600' }}>{item.name}</Text></Pressable>)}</ScrollView>
      {current ? <Card><SectionTitle title={current.name} /><View accessibilityRole="image" accessibilityLabel={`Wykres ciężaru dla ${current.name}; ${points.length} treningów`}><Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}><Line x1="16" y1={chartHeight - 18} x2="284" y2={chartHeight - 18} stroke={c.border} strokeWidth="1" /><Line x1="16" y1="22" x2="284" y2="22" stroke={c.border} strokeWidth="1" /><Polyline points={coords} fill="none" stroke={c.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => { const [cx, cy] = coords.split(' ')[index].split(','); return <Circle key={point.id} cx={cx} cy={cy} r="4" fill={c.accent} />; })}</Svg></View><Text style={{ color: c.muted }}>{points.length} treningów · najwyższy ciężar {current.best_load} kg · do {current.best_reps} powtórzeń</Text><Text style={{ color: c.muted, fontSize: 12 }}>Sam większy ciężar nie przesądza o postępie — uwzględnij też powtórzenia i jakość wykonania.</Text></Card> : null}
    </>}
  </Page>;
}
