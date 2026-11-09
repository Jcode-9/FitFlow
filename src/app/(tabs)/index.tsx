import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';
import { Action, Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { listWorkouts, type WorkoutSummary } from '@/data/database';

const dateLabel = (value: string) => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value + 'T12:00:00'));
export default function JournalScreen() {
  const db = useSQLiteContext(); const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]); const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { let active = true; listWorkouts(db).then((rows) => { if (active) { setWorkouts(rows); setError(''); } }).catch(() => active && setError('Nie udało się wczytać dziennika. Spróbuj ponownie.')); return () => { active = false; }; }, [db]));
  return <Page><Heading eyebrow="FitFlow · dziennik" title="Twój trening." subtitle="Zapisuj swoje serie. Postępy zostają z Tobą, także offline." />
    <Action label="＋  Zapisz trening" onPress={() => router.push('/workout/new')} />
    <View style={{ gap: 12 }}><SectionTitle title="Historia" />{error ? <EmptyState title="Wystąpił problem" body={error} /> : workouts.length === 0 ? <EmptyState title="Pierwszy trening czeka" body="Dodaj ćwiczenia, serie, ciężar i powtórzenia. Wszystko zapisze się na tym urządzeniu." /> : workouts.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Trening ${dateLabel(item.performed_at)}, ${item.exercise_count} ćwiczeń`} onPress={() => router.push(`/workout/${item.id}`)}><Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{dateLabel(item.performed_at)}</Text><Text style={{ color: c.accent, fontWeight: '700' }}>{Math.round(item.total_volume).toLocaleString('pl-PL')} kg</Text></View><Text style={{ color: c.muted }}>{item.exercise_count} ćw. · {item.set_count} serii{item.note ? ` · ${item.note}` : ''}</Text></Card></Pressable>)}</View>
  </Page>;
}
