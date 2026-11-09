import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Action, Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { deleteWorkout, getWorkout, type WorkoutDetail } from '@/data/database';
export default function WorkoutDetails() {
  const { id } = useLocalSearchParams<{ id: string }>(); const db = useSQLiteContext(); const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  useFocusEffect(useCallback(() => { let active = true; getWorkout(db, Number(id)).then((value) => active && setWorkout(value)).catch(() => active && setWorkout(null)); return () => { active = false; }; }, [db, id]));
  const remove = () => Alert.alert('Usunąć trening?', 'Tego działania nie można cofnąć.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Usuń', style: 'destructive', onPress: async () => { await deleteWorkout(db, Number(id)); router.back(); } }]);
  if (!workout) return <Page><EmptyState title="Nie znaleziono treningu" body="Wpis mógł zostać usunięty." /></Page>;
  const totalSets = workout.exercises.reduce((sum, item) => sum + item.sets.length, 0);
  return <Page><Heading eyebrow={new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(workout.performed_at + 'T12:00:00'))} title={workout.name} subtitle={`${workout.exercises.length} ćwiczeń · ${totalSets} serii`} />
    {workout.exercises.map((exercise) => <Card key={exercise.id}><SectionTitle title={exercise.name} />{exercise.sets.map((set) => <View key={set.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.muted }}>Seria {set.set_number}</Text><Text style={{ color: c.text, fontWeight: '600' }}>{set.weight} kg × {set.reps}</Text></View>)}</Card>)}
    {workout.note ? <Card><Text style={{ color: c.muted }}>Notatka</Text><Text style={{ color: c.text }}>{workout.note}</Text></Card> : null}
    <Action label="Edytuj trening" onPress={() => router.push(`/workout/new?id=${workout.id}`)} /><Pressable accessibilityRole="button" onPress={remove} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: c.danger, fontWeight: '700' }}>Usuń trening</Text></Pressable>
  </Page>;
}
