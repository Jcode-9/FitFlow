import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { Action, Card, EmptyState, Field, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { getExercises, getLastExerciseEntry, getWorkout, getWorkoutTemplate, listTemplates, saveWorkout, type EntryMode, type Exercise } from '@/data/database';

type DraftSet = { weight: string; reps: string };
type DraftExercise = { key: string; id?: number; name: string; mode: EntryMode; note: string; previousNote: string | null; previousWeights: (number | null)[]; sets: DraftSet[] };
const newDraftKey = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const defaultWorkoutName = (date: string) => `Trening siłowy - ${date.split('-').reverse().join('.')}`;
const blankSets = (count = 1): DraftSet[] => Array.from({ length: count }, () => ({ weight: '', reps: '8' }));

export default function WorkoutForm() {
  const db = useSQLiteContext(); const { id } = useLocalSearchParams<{ id?: string }>();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const [library, setLibrary] = useState<Exercise[]>([]); const [search, setSearch] = useState('');
  const [date, setDate] = useState(localDate); const [name, setName] = useState(() => defaultWorkoutName(localDate())); const [nameEdited, setNameEdited] = useState(false);
  const [note, setNote] = useState(''); const [drafts, setDrafts] = useState<DraftExercise[]>([]); const [customName, setCustomName] = useState(''); const [saving, setSaving] = useState(false);
  const [exerciseListWidth, setExerciseListWidth] = useState(0); const [templates, setTemplates] = useState<{id:number;name:string;exercise_count:number}[]>([]); const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    let active = true;
    getExercises(db).then((items) => active && setLibrary(items)).catch(() => Alert.alert('Błąd', 'Nie udało się wczytać ćwiczeń.'));
    if (!id) listTemplates(db).then((items) => active && setTemplates(items)).catch(() => undefined);
    if (id) getWorkout(db, Number(id)).then(async (workout) => {
      if (!active || !workout) return;
      setDate(workout.performed_at); setName(workout.name); setNameEdited(workout.name !== defaultWorkoutName(workout.performed_at)); setNote(workout.note ?? '');
      const exercises = await Promise.all(workout.exercises.map(async (exercise) => {
        const previous = await getLastExerciseEntry(db, exercise.id, Number(id));
        return { key: `exercise-${exercise.id}`, id: exercise.id, name: exercise.name, mode: exercise.entry_mode, note: exercise.note ?? '', previousNote: previous?.note ?? null, previousWeights: previous?.sets.map((set) => set.weight) ?? [], sets: exercise.sets.map((set) => ({ weight: set.weight === null ? '' : String(set.weight), reps: String(set.reps) })) };
      }));
      if (active) setDrafts(exercises);
    }).catch(() => Alert.alert('Błąd', 'Nie udało się wczytać treningu.'));
    return () => { active = false; };
  }, [db, id]);

  const addExercise = async (exercise: Exercise) => {
    if (drafts.some((draft) => draft.id === exercise.id)) return;
    const previous = await getLastExerciseEntry(db, exercise.id, id ? Number(id) : undefined).catch(() => null);
    setDrafts((current) => [...current, { key: `exercise-${exercise.id}`, id: exercise.id, name: exercise.name, mode: previous?.entry_mode ?? 'weight', note: '', previousNote: previous?.note ?? null, previousWeights: previous?.sets.map((set) => set.weight) ?? [], sets: blankSets() }]);
    setSearch('');
  };
  const addCustom = () => {
    const value = customName.trim(); if (!value) return;
    if (drafts.some((item) => item.name.toLocaleLowerCase('pl-PL') === value.toLocaleLowerCase('pl-PL'))) { setCustomName(''); return; }
    const existing = library.find((exercise) => exercise.name.toLocaleLowerCase('pl-PL') === value.toLocaleLowerCase('pl-PL'));
    if (existing) { void addExercise(existing); setCustomName(''); return; }
    setDrafts((current) => [...current, { key: newDraftKey(), name: value, mode: 'weight', note: '', previousNote: null, previousWeights: [], sets: blankSets() }]); setCustomName('');
  };
  const updateSet = (exerciseIndex: number, setIndex: number, key: keyof DraftSet, value: string) => setDrafts((items) => items.map((item, i) => i === exerciseIndex ? { ...item, sets: item.sets.map((set, j) => j === setIndex ? { ...set, [key]: key === 'weight' ? value.replace(',', '.') : value.replace(/[^0-9]/g, '') } : set) } : item));
  const updateExercise = (key: string, changes: Partial<DraftExercise>) => setDrafts((items) => items.map((item) => item.key === key ? { ...item, ...changes } : item));
  const removeSet = (exerciseIndex: number, setIndex: number) => setDrafts((items) => items.map((item, i) => i === exerciseIndex ? { ...item, sets: item.sets.filter((_, j) => j !== setIndex) } : item));
  const applyTemplate = async (summary: {id:number;name:string}) => {
    const load = async () => {
      const template = await getWorkoutTemplate(db, summary.id);
      if (!template) return;
      const next = await Promise.all(template.exercises.map(async (exercise) => {
        const previous = exercise.id ? await getLastExerciseEntry(db, exercise.id).catch(() => null) : null;
        return { key: `template-${newDraftKey()}`, id: exercise.id, name: exercise.name, mode: exercise.entry_mode, note: '', previousNote: previous?.note ?? null, previousWeights: previous?.sets.map((set) => set.weight) ?? [], sets: blankSets(exercise.set_count) };
      }));
      setDrafts(next); setShowTemplates(false);
    };
    if (drafts.length) Alert.alert('Zastąpić ćwiczenia?', `Wczytanie szablonu „${summary.name}” zastąpi listę ćwiczeń w tym treningu.`, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Zastąp', style: 'destructive', onPress: () => { void load(); } }]); else await load();
  };
  const searchResults = search.trim() ? library.filter((exercise) => exercise.name.toLocaleLowerCase('pl-PL').includes(search.trim().toLocaleLowerCase('pl-PL'))).slice(0, 12) : [];

  const save = async () => {
    const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/); const parsedDate = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])) : null;
    if (!parsedDate || parsedDate.getFullYear() !== Number(dateParts?.[1]) || parsedDate.getMonth() !== Number(dateParts?.[2]) - 1 || parsedDate.getDate() !== Number(dateParts?.[3])) return Alert.alert('Sprawdź datę', 'Wpisz prawidłową datę w formacie RRRR-MM-DD.');
    if (!drafts.length || drafts.some((exercise) => !exercise.sets.length)) return Alert.alert('Dodaj ćwiczenie', 'Trening musi zawierać co najmniej jedno ćwiczenie i serię.');
    const exercises = drafts.map((exercise) => ({ id: exercise.id, name: exercise.name, entry_mode: exercise.mode, note: exercise.note, sets: exercise.sets.map((set) => ({ weight: exercise.mode === 'weight' && set.weight.trim() ? Number(set.weight) : null, reps: Number(set.reps) })) }));
    if (exercises.some((exercise) => exercise.sets.some((set) => (exercise.entry_mode === 'weight' && (set.weight === null || !Number.isFinite(set.weight) || set.weight < 0)) || !Number.isInteger(set.reps) || set.reps < 1))) return Alert.alert('Sprawdź serie', 'Uzupełnij nieujemny ciężar oraz co najmniej 1 powtórzenie w każdej serii.');
    if (exercises.some((exercise) => exercise.entry_mode === 'note' && !exercise.note.trim())) return Alert.alert('Dodaj notatkę', 'Wpisz notatkę dla każdego ćwiczenia w trybie Notatka.');
    setSaving(true);
    try { await saveWorkout(db, { id: id ? Number(id) : undefined, name: name.trim() || defaultWorkoutName(date), date, note: note.trim(), exercises }); router.back(); }
    catch { Alert.alert('Nie zapisano', 'Spróbuj ponownie. Twoje dane nie zostały zmienione.'); }
    finally { setSaving(false); }
  };

  return <Page scrollableRef={scrollableRef}>
    <Heading eyebrow={id ? 'Edycja' : 'Nowy trening'} title={id ? 'Popraw zapis.' : 'Zaczynamy.'} subtitle="Uzupełnij nazwę, datę, ćwiczenia i serie." />
    <Field label="Nazwa treningu" value={name} onChangeText={(value) => { setName(value); setNameEdited(value.trim() !== defaultWorkoutName(date)); }} placeholder={defaultWorkoutName(date)} returnKeyType="done" />
    <Field label="Data · RRRR-MM-DD" value={date} onChangeText={(value) => { setDate(value); if (!nameEdited) setName(defaultWorkoutName(value)); }} placeholder="2026-11-09" keyboardType="numbers-and-punctuation" />
    {!id ? <View style={{ gap: 8 }}><Action label={showTemplates ? 'Ukryj szablony' : 'Wczytaj szablon treningu'} secondary onPress={() => setShowTemplates((value) => !value)} />{showTemplates ? templates.length ? templates.map((template) => <Pressable key={template.id} accessibilityRole="button" onPress={() => { void applyTemplate(template); }}><Card style={{ padding: 14 }}><Text style={{ color: c.text, fontWeight: '700' }}>{template.name}</Text><Text style={{ color: c.muted }}>{template.exercise_count} ćwiczeń</Text></Card></Pressable>) : <EmptyState title="Brak szablonów" body="Utwórz szablon na ekranie głównym." /> : null}</View> : null}
    <View style={{ gap: 10 }}>
      <SectionTitle title="Dodaj ćwiczenie" />
      <Field label="Szukaj ćwiczeń" value={search} onChangeText={setSearch} placeholder="np. przysiad, wyciskanie…" returnKeyType="search" />
      {!search.trim() ? <Text style={{ color: c.muted, lineHeight: 20 }}>Wpisz nazwę, aby znaleźć ćwiczenie na liście.</Text> : searchResults.length ? searchResults.map((exercise) => {
        const selected = drafts.some((item) => item.id === exercise.id);
        return <Pressable key={exercise.id} accessibilityRole="button" accessibilityState={{ selected, disabled: selected }} onPress={() => { void addExercise(exercise); }} disabled={selected}><Card style={{ padding: 13, borderColor: selected ? c.accent : c.border }}><Text style={{ color: selected ? c.accent : c.text, fontWeight: '600' }}>{selected ? '✓  ' : '+  '}{exercise.name}</Text>{exercise.primary_muscle ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{exercise.primary_muscle.name}</Text> : null}</Card></Pressable>;
      }) : <EmptyState title="Brak wyników" body="Sprawdź pisownię albo dodaj własne ćwiczenie poniżej." />}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}><Field label="Własne ćwiczenie" value={customName} onChangeText={setCustomName} placeholder="np. Wznosy bokiem" style={{ flex: 1 }} returnKeyType="done" onSubmitEditing={addCustom} /><Action label="Dodaj" secondary onPress={addCustom} /></View>
    </View>
    {drafts.length ? <View style={{ gap: 8, alignSelf: 'stretch' }} onLayout={({ nativeEvent: { layout } }) => setExerciseListWidth((current) => current === layout.width ? current : layout.width)}>
      <Text style={{ color: c.muted, fontSize: 13 }}>Przytrzymaj uchwyt i przeciągnij kafelek, aby zmienić kolejność.</Text>
      <Sortable.Flex flexDirection="column" flexWrap="nowrap" alignItems="flex-start" width={exerciseListWidth || 'fill'} gap={12} customHandle dragActivationDelay={180} reorderTriggerOrigin="touch" inactiveItemScale={0.88} activeItemScale={1.03} dimensionsAnimationType="worklet" itemsLayoutTransitionMode="all" scrollableRef={scrollableRef} autoScrollActivationOffset={110} autoScrollMaxVelocity={700} onDragEnd={({ order }) => setDrafts((current) => order(current))}>
        {drafts.map((exercise, exerciseIndex) => <Card key={exercise.key} style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Sortable.Handle style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised }}><View accessible accessibilityRole="button" accessibilityLabel={`Przesuń ćwiczenie ${exercise.name}`}><Text style={{ color: c.muted, fontSize: 20 }}>⠿</Text></View></Sortable.Handle><Text style={{ color: c.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{exercise.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Usuń ćwiczenie ${exercise.name}`} onPress={() => setDrafts((current) => current.filter((item) => item.key !== exercise.key))}><Text style={{ color: c.danger }}>Usuń</Text></Pressable></View>
          <View accessibilityRole="radiogroup" accessibilityLabel={`Tryb wpisu dla ${exercise.name}`} style={{ flexDirection: 'row', gap: 8 }}>
            {(['weight','note'] as EntryMode[]).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: exercise.mode === mode }} accessibilityLabel={mode === 'weight' ? 'Ciężar' : 'Notatka'} onPress={() => updateExercise(exercise.key, { mode })} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: exercise.mode === mode ? c.accent : c.surfaceRaised }}><Text style={{ color: exercise.mode === mode ? c.background : c.text, fontWeight: '700' }}>{mode === 'weight' ? 'Ciężar' : 'Notatka'}</Text></Pressable>)}
          </View>
          {exercise.mode === 'note' ? <>{exercise.previousNote ? <Text accessibilityLabel={`Ostatnia notatka: ${exercise.previousNote}`} style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>Ostatnio: {exercise.previousNote}</Text> : null}<Field label="Notatka do ćwiczenia" value={exercise.note} onChangeText={(value) => updateExercise(exercise.key, { note: value })} placeholder="np. RPE 8, spokojne tempo…" multiline /></> : null}
          {exercise.sets.map((set, j) => <View key={j} style={{ gap: 5 }}>
            {exercise.mode === 'weight' && exercise.previousWeights[j] !== undefined && exercise.previousWeights[j] !== null ? <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700', paddingLeft: 2 }}>Ostatnio: {exercise.previousWeights[j]} kg</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>{exercise.mode === 'weight' ? <Field style={{ flex: 1 }} label={`Seria ${j + 1} · kg`} value={set.weight} onChangeText={(value) => updateSet(exerciseIndex, j, 'weight', value)} keyboardType="decimal-pad" placeholder="0" /> : <Text accessibilityRole="text" style={{ color: c.muted, flex: 1, paddingBottom: 15 }}>Seria {j + 1}</Text>}
              <View style={{ flex: 1 }}><Field label="Powtórzenia" value={set.reps} onChangeText={(value) => updateSet(exerciseIndex, j, 'reps', value)} keyboardType="number-pad" placeholder="8" /><View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}><Pressable accessibilityRole="button" accessibilityLabel={`Zmniejsz liczbę powtórzeń w serii ${j + 1}`} onPress={() => updateSet(exerciseIndex, j, 'reps', String(Math.max(1, (Number(set.reps) || 1) - 1)))} style={{ flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.surfaceRaised }}><Text style={{ color: c.text, fontSize: 20 }}>−</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Zwiększ liczbę powtórzeń w serii ${j + 1}`} onPress={() => updateSet(exerciseIndex, j, 'reps', String((Number(set.reps) || 0) + 1))} style={{ flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.surfaceRaised }}><Text style={{ color: c.text, fontSize: 20 }}>+</Text></Pressable></View></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Usuń serię ${j + 1} ćwiczenia ${exercise.name}`} onPress={() => removeSet(exerciseIndex, j)} hitSlop={8} style={{ padding: 12, marginBottom: 2 }}><Text style={{ color: c.danger, fontSize: 18 }}>×</Text></Pressable>
            </View>
          </View>)}
          <Action label="＋ Dodaj serię" secondary onPress={() => updateExercise(exercise.key, { sets: [...exercise.sets, { weight: '', reps: '8' }] })} />
        </Card>)}
      </Sortable.Flex>
    </View> : null}
    <Field label="Notatka do treningu (opcjonalnie)" value={note} onChangeText={setNote} placeholder="Jak się czułeś?" multiline numberOfLines={3} />
    <Action label={saving ? 'Zapisywanie…' : id ? 'Zapisz zmiany' : 'Zapisz trening'} onPress={save} disabled={saving} />
  </Page>;
}
