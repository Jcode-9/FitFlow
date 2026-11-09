import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, Text, View } from 'react-native';
import Sortable from 'react-native-sortables';
import { Action, Card, EmptyState, Field, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { getExercises, getLastWorkoutSets, getWorkout, saveWorkout, type Exercise } from '@/data/database';

type PreviousSet = { weight: number; reps: number };
type DraftExercise = { key: string; id?: number; name: string; previousSets: PreviousSet[]; sets: { weight: string; reps: string }[] };
const newDraftKey = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const defaultWorkoutName = (date: string) => `Trening siłowy - ${date.split('-').reverse().join('.')}`;

export default function WorkoutForm() {
  const db = useSQLiteContext(); const { id } = useLocalSearchParams<{ id?: string }>();
  const [library, setLibrary] = useState<Exercise[]>([]); const [search, setSearch] = useState('');
  const [date, setDate] = useState(localDate); const [name, setName] = useState(() => defaultWorkoutName(localDate())); const [nameEdited, setNameEdited] = useState(false);
  const [note, setNote] = useState(''); const [drafts, setDrafts] = useState<DraftExercise[]>([]); const [customName, setCustomName] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getExercises(db).then((items) => active && setLibrary(items)).catch(() => Alert.alert('Błąd', 'Nie udało się wczytać ćwiczeń.'));
    if (id) getWorkout(db, Number(id)).then(async (workout) => {
      if (!active || !workout) return;
      setDate(workout.performed_at); setName(workout.name); setNameEdited(workout.name !== defaultWorkoutName(workout.performed_at)); setNote(workout.note ?? '');
      const exercises = await Promise.all(workout.exercises.map(async (exercise) => ({
        key: `exercise-${exercise.id}`,
        id: exercise.id,
        name: exercise.name,
        previousSets: await getLastWorkoutSets(db, exercise.id, Number(id)),
        sets: exercise.sets.map((set) => ({ weight: String(set.weight), reps: String(set.reps) })),
      })));
      if (active) setDrafts(exercises);
    }).catch(() => Alert.alert('Błąd', 'Nie udało się wczytać treningu.'));
    return () => { active = false; };
  }, [db, id]);

  const addExercise = async (exercise: Exercise) => {
    if (drafts.some((draft) => draft.id === exercise.id)) return;
    setDrafts((current) => [...current, { key: `exercise-${exercise.id}`, id: exercise.id, name: exercise.name, previousSets: [], sets: [{ weight: '', reps: '' }] }]);
    try {
      const previousSets = await getLastWorkoutSets(db, exercise.id, id ? Number(id) : undefined);
      setDrafts((current) => current.map((draft) => draft.id === exercise.id ? { ...draft, previousSets } : draft));
    } catch { /* The exercise can still be entered if previous history cannot be read. */ }
    setSearch('');
  };
  const addCustom = () => {
    const value = customName.trim(); if (!value) return;
    if (drafts.some((item) => item.name.toLocaleLowerCase() === value.toLocaleLowerCase())) { setCustomName(''); return; }
    const existing = library.find((exercise) => exercise.name.toLocaleLowerCase('pl-PL') === value.toLocaleLowerCase('pl-PL'));
    if (existing) { void addExercise(existing); setCustomName(''); return; }
    setDrafts((current) => [...current, { key: newDraftKey(), name: value, previousSets: [], sets: [{ weight: '', reps: '' }] }]); setCustomName('');
  };
  const updateSet = (exerciseIndex: number, setIndex: number, key: 'weight' | 'reps', value: string) => setDrafts((items) => items.map((item, i) => i === exerciseIndex ? { ...item, sets: item.sets.map((set, j) => j === setIndex ? { ...set, [key]: value.replace(',', '.') } : set) } : item));
  const removeSet = (exerciseIndex: number, setIndex: number) => setDrafts((items) => items.flatMap((item, i) => {
    if (i !== exerciseIndex) return [item];
    const sets = item.sets.filter((_, j) => j !== setIndex);
    return sets.length ? [{ ...item, sets }] : [];
  }));
  const searchResults = search.trim() ? library.filter((exercise) => exercise.name.toLocaleLowerCase('pl-PL').includes(search.trim().toLocaleLowerCase('pl-PL'))).slice(0, 12) : [];

  const save = async () => {
    const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsedDate = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])) : null;
    if (!parsedDate || parsedDate.getFullYear() !== Number(dateParts?.[1]) || parsedDate.getMonth() !== Number(dateParts?.[2]) - 1 || parsedDate.getDate() !== Number(dateParts?.[3])) return Alert.alert('Sprawdź datę', 'Wpisz prawidłową datę w formacie RRRR-MM-DD.');
    if (!drafts.length) return Alert.alert('Dodaj ćwiczenie', 'Trening musi zawierać co najmniej jedno ćwiczenie i serię.');
    const exercises = drafts.map((exercise) => ({ id: exercise.id, name: exercise.name, sets: exercise.sets.map((set) => ({ weight: Number(set.weight), reps: Number(set.reps) })) }));
    if (exercises.some((exercise) => !exercise.sets.length || exercise.sets.some((set) => !Number.isFinite(set.weight) || set.weight < 0 || !Number.isInteger(set.reps) || set.reps <= 0))) return Alert.alert('Sprawdź serie', 'Ciężar musi być nieujemną liczbą, a powtórzenia dodatnią liczbą całkowitą.');
    setSaving(true);
    try { await saveWorkout(db, { id: id ? Number(id) : undefined, name: name.trim() || defaultWorkoutName(date), date, note: note.trim(), exercises }); router.back(); }
    catch { Alert.alert('Nie zapisano', 'Spróbuj ponownie. Twoje dane nie zostały zmienione.'); }
    finally { setSaving(false); }
  };

  return <Page>
    <Heading eyebrow={id ? 'Edycja' : 'Nowy trening'} title={id ? 'Popraw zapis.' : 'Zaczynamy.'} subtitle="Uzupełnij nazwę, datę, ćwiczenia i serie." />
    <Field label="Nazwa treningu" value={name} onChangeText={(value) => { setName(value); setNameEdited(value.trim() !== defaultWorkoutName(date)); }} placeholder={defaultWorkoutName(date)} returnKeyType="done" />
    <Field label="Data · RRRR-MM-DD" value={date} onChangeText={(value) => { setDate(value); if (!nameEdited) setName(defaultWorkoutName(value)); }} placeholder="2026-11-09" keyboardType="numbers-and-punctuation" />
    <View style={{ gap: 10 }}>
      <SectionTitle title="Dodaj ćwiczenie" />
      <Field label="Szukaj ćwiczeń" value={search} onChangeText={setSearch} placeholder="np. przysiad, wyciskanie…" returnKeyType="search" />
      {!search.trim() ? <Text style={{ color: c.muted, lineHeight: 20 }}>Wpisz nazwę, aby znaleźć ćwiczenie na liście.</Text> : searchResults.length ? searchResults.map((exercise) => {
        const selected = drafts.some((item) => item.id === exercise.id);
        return <Pressable key={exercise.id} accessibilityRole="button" accessibilityState={{ selected, disabled: selected }} onPress={() => { void addExercise(exercise); }} disabled={selected}><Card style={{ padding: 13, borderColor: selected ? c.accent : c.border }}><Text style={{ color: selected ? c.accent : c.text, fontWeight: '600' }}>{selected ? '✓  ' : '+  '}{exercise.name}</Text></Card></Pressable>;
      }) : <EmptyState title="Brak wyników" body="Sprawdź pisownię albo dodaj własne ćwiczenie poniżej." />}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}><Field label="Własne ćwiczenie" value={customName} onChangeText={setCustomName} placeholder="np. Wznosy bokiem" style={{ flex: 1 }} returnKeyType="done" onSubmitEditing={addCustom} /><Action label="Dodaj" secondary onPress={addCustom} /></View>
    </View>
    {drafts.length ? <View style={{ gap: 8 }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>Przytrzymaj uchwyt i przeciągnij kafelek, aby zmienić kolejność.</Text>
      <Sortable.Flex
        flexDirection="column"
        alignItems="flex-start"
        width="fill"
        gap={12}
        customHandle
        dragActivationDelay={180}
        onDragEnd={({ order }) => setDrafts((current) => order(current))}
      >
        {drafts.map((exercise, exerciseIndex) => <Card key={exercise.key} style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Sortable.Handle style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised }}>
              <View accessible accessibilityRole="button" accessibilityLabel={`Przesuń ćwiczenie ${exercise.name}`} accessibilityHint="Przytrzymaj uchwyt i przeciągnij kafelek w nowe miejsce."><Text style={{ color: c.muted, fontSize: 20 }}>⠿</Text></View>
            </Sortable.Handle>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{exercise.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Usuń ćwiczenie ${exercise.name}`} onPress={() => setDrafts((current) => current.filter((item) => item.key !== exercise.key))}><Text style={{ color: c.danger }}>Usuń</Text></Pressable>
          </View>
          {exercise.sets.map((set, j) => <View key={j} style={{ gap: 5 }}>
            {exercise.previousSets[j] ? <Text accessibilityLabel={`Podpowiedź: ${exercise.previousSets[j].weight} kilogramów, ${exercise.previousSets[j].reps} powtórzeń`} style={{ color: c.accent, fontSize: 12, fontWeight: '700', paddingLeft: 2 }}>Ostatnio: {exercise.previousSets[j].weight.toLocaleString('pl-PL')} kg × {exercise.previousSets[j].reps} powt.</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}><Field style={{ flex: 1 }} label={`Seria ${j + 1} · kg`} value={set.weight} onChangeText={(value) => updateSet(exerciseIndex, j, 'weight', value)} keyboardType="decimal-pad" placeholder="0" /><Field style={{ flex: 1 }} label="Powtórzenia" value={set.reps} onChangeText={(value) => updateSet(exerciseIndex, j, 'reps', value)} keyboardType="number-pad" placeholder="8" /><Pressable accessibilityRole="button" accessibilityLabel={`Usuń serię ${j + 1} ćwiczenia ${exercise.name}`} onPress={() => removeSet(exerciseIndex, j)} hitSlop={8} style={{ padding: 12, marginBottom: 2 }}><Text style={{ color: c.danger, fontSize: 18 }}>×</Text></Pressable></View>
          </View>)}
          <Action label="＋ Dodaj serię" secondary onPress={() => setDrafts((items) => items.map((item) => item.key === exercise.key ? { ...item, sets: [...item.sets, { weight: '', reps: '' }] } : item))} />
        </Card>)}
      </Sortable.Flex>
    </View> : null}
    <Field label="Notatka (opcjonalnie)" value={note} onChangeText={setNote} placeholder="Jak się czułeś?" multiline numberOfLines={3} />
    <Action label={saving ? 'Zapisywanie…' : id ? 'Zapisz zmiany' : 'Zapisz trening'} onPress={save} disabled={saving} />
  </Page>;
}
