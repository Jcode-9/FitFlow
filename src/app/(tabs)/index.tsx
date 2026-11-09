import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';
import { Action, Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { listWorkouts, type WorkoutSummary } from '@/data/database';

const dateLabel = (value: string) => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
function WorkoutCard({ workout, featured = false }: { workout: WorkoutSummary; featured?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${workout.name}, ${dateLabel(workout.performed_at)}, ${workout.exercise_count} ćwiczeń`} onPress={() => router.push(`/workout/${workout.id}`)}>
    <Card style={featured ? { borderColor: c.accent, borderWidth: 1.5, padding: 20 } : undefined}>
      {featured ? <Text style={{ color: c.accent, fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>OSTATNI ZAPISANY TRENING</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, color: c.text, fontWeight: '700', fontSize: featured ? 19 : 16 }}>{workout.name}</Text>
        <Text style={{ color: c.accent, fontWeight: '700' }}>{Math.round(workout.total_volume).toLocaleString('pl-PL')} kg</Text>
      </View>
      <Text style={{ color: c.muted }}>{dateLabel(workout.performed_at)} · {workout.exercise_count} ćw. · {workout.set_count} serii</Text>
    </Card>
  </Pressable>;
}
export default function JournalScreen() {
  const db = useSQLiteContext(); const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]); const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { let active = true; listWorkouts(db).then((rows) => { if (active) { setWorkouts(rows); setError(''); } }).catch(() => active && setError('Nie udało się wczytać dziennika. Spróbuj ponownie.')); return () => { active = false; }; }, [db]));
  const [latest, ...older] = workouts;
  return <Page><Heading eyebrow="FitFlow · dziennik" title="Twój trening." subtitle="Zapisuj swoje serie. Postępy zostają z Tobą, także offline." />
    <Action label="＋  Zapisz trening" onPress={() => router.push('/workout/new')} />
    <Action label="Szablony treningów" secondary onPress={() => router.push('/templates')} />
    {error ? <EmptyState title="Wystąpił problem" body={error} /> : latest ? <WorkoutCard workout={latest} featured /> : <EmptyState title="Pierwszy trening czeka" body="Dodaj ćwiczenia, serie, ciężar i powtórzenia. Wszystko zapisze się na tym urządzeniu." />}
    {older.length > 0 ? <View style={{ gap: 12 }}><SectionTitle title="Wcześniejsze treningi" />{older.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)}</View> : null}
  </Page>;
}
