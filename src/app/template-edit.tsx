import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Sortable from 'react-native-sortables';
import { Action, Card, EmptyState, Field, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { getExercises, getWorkoutTemplate, saveWorkoutTemplate, type EntryMode, type Exercise, type TemplateExercise } from '@/data/database';

type Draft = TemplateExercise & { key: string };
const key = () => `template-exercise-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export default function EditTemplateScreen() {
  const db = useSQLiteContext(); const { id } = useLocalSearchParams<{ id?: string }>(); const { width: screenWidth } = useWindowDimensions(); const [name, setName] = useState(''); const [items, setItems] = useState<Draft[]>([]); const [library, setLibrary] = useState<Exercise[]>([]); const [search, setSearch] = useState(''); const [saving, setSaving] = useState(false);
  const exerciseCardWidth = Math.max(screenWidth - 44, 0);
  useEffect(() => { let active = true; getExercises(db).then((rows) => active && setLibrary(rows)); if (id) getWorkoutTemplate(db, Number(id)).then((template) => { if (active && template) { setName(template.name); setItems(template.exercises.map((item) => ({ ...item, key: key() }))); } }).catch(() => Alert.alert('Błąd', 'Nie udało się wczytać szablonu.')); return () => { active = false; }; }, [db, id]);
  const results = search.trim() ? library.filter((item) => item.name.toLocaleLowerCase('pl-PL').includes(search.trim().toLocaleLowerCase('pl-PL'))).slice(0, 12) : [];
  const add = (exercise: Exercise) => { if (items.some((item) => item.id === exercise.id)) return; setItems((current) => [...current, { key: key(), id: exercise.id, name: exercise.name, position: current.length, entry_mode: 'weight', set_count: 3 }]); setSearch(''); };
  const update = (itemKey: string, changes: Partial<Draft>) => setItems((current) => current.map((item) => item.key === itemKey ? { ...item, ...changes } : item));
  const save = async () => { if (!name.trim()) return Alert.alert('Podaj nazwę', 'Każdy szablon musi mieć nazwę.'); if (!items.length) return Alert.alert('Dodaj ćwiczenia', 'Szablon musi zawierać co najmniej jedno ćwiczenie.'); setSaving(true); try { await saveWorkoutTemplate(db, { id: id ? Number(id) : undefined, name, exercises: items.map(({ key: _key, ...item }, position) => ({ ...item, position })) }); router.back(); } catch { Alert.alert('Nie zapisano', 'Spróbuj ponownie.'); } finally { setSaving(false); } };
  return <Page><Heading eyebrow={id ? 'Edycja szablonu' : 'Nowy szablon'} title={id ? 'Dopracuj plan.' : 'Zaplanuj trening.'} subtitle="Szablon zapisuje ćwiczenia, ich kolejność, tryb oraz liczbę serii." />
    <Field label="Nazwa szablonu" value={name} onChangeText={setName} placeholder="np. Góra ciała A" returnKeyType="done" />
    <View style={{ gap: 10 }}><SectionTitle title="Ćwiczenia"/><Field label="Szukaj ćwiczeń" value={search} onChangeText={setSearch} placeholder="np. przysiad, wyciskanie…" returnKeyType="search"/>
      {results.map((exercise) => { const selected = items.some((item) => item.id === exercise.id); return <Pressable key={exercise.id} accessibilityRole="button" accessibilityState={{ selected, disabled: selected }} disabled={selected} onPress={() => add(exercise)}><Card style={{ padding: 13 }}><Text style={{ color: selected ? c.muted : c.text, fontWeight: '600' }}>{selected ? '✓  ' : '+  '}{exercise.name}</Text>{exercise.primary_muscle ? <Text style={{ color: c.muted, fontSize: 12 }}>{exercise.primary_muscle.name}</Text> : null}</Card></Pressable>; })}
      <View style={{ width: exerciseCardWidth }}>
        {items.length ? <Sortable.Flex flexDirection="column" flexWrap="nowrap" alignItems="flex-start" width={exerciseCardWidth} gap={10} customHandle dragActivationDelay={180} reorderTriggerOrigin="touch" onDragEnd={({ order }) => setItems((current) => order(current))}>
          {items.map((item) => <Card key={item.key} style={{ width: exerciseCardWidth }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Sortable.Handle style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised }}><View accessible accessibilityRole="button" accessibilityLabel={`Przesuń ${item.name}`}><Text style={{ color: c.muted, fontSize: 20 }}>⠿</Text></View></Sortable.Handle><Text style={{ color: c.text, flex: 1, fontWeight: '700' }}>{item.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Usuń ${item.name}`} onPress={() => setItems((current) => current.filter((value) => value.key !== item.key))}><Text style={{ color: c.danger }}>Usuń</Text></Pressable></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>{(['weight','note'] as EntryMode[]).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: item.entry_mode === mode }} accessibilityLabel={mode === 'weight' ? 'Ciężar' : 'Notatka'} onPress={() => update(item.key, { entry_mode: mode })} style={{ padding: 9, borderRadius: 18, backgroundColor: item.entry_mode === mode ? c.accent : c.surfaceRaised }}><Text style={{ color: item.entry_mode === mode ? c.background : c.text, fontWeight: '700' }}>{mode === 'weight' ? 'Ciężar' : 'Notatka'}</Text></Pressable>)}</View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: c.muted, fontWeight: '600' }}>Liczba serii: {item.set_count}</Text><View style={{ flexDirection: 'row', gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={`Zmniejsz liczbę serii dla ${item.name}`} onPress={() => update(item.key, { set_count: Math.max(1, item.set_count - 1) })} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: c.surfaceRaised }}><Text style={{ color: c.text }}>−</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Zwiększ liczbę serii dla ${item.name}`} onPress={() => update(item.key, { set_count: item.set_count + 1 })} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: c.surfaceRaised }}><Text style={{ color: c.text }}>+</Text></Pressable></View></View>
          </Card>)}
        </Sortable.Flex> : <EmptyState title="Dodaj pierwsze ćwiczenie" body="Wyszukaj je wyżej w katalogu."/>}
      </View>
    </View>
    <Action label={saving ? 'Zapisywanie…' : 'Zapisz szablon'} onPress={save} disabled={saving}/>
  </Page>;
}
