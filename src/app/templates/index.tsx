import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Action, Card, EmptyState, Heading, Page } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
import { deleteWorkoutTemplate, listTemplates } from '@/data/database';

export default function TemplatesScreen() {
  const db = useSQLiteContext(); const [templates, setTemplates] = useState<{id:number;name:string;exercise_count:number}[]>([]);
  const refresh = useCallback(() => { let active = true; listTemplates(db).then((rows) => active && setTemplates(rows)).catch(() => undefined); return () => { active = false; }; }, [db]);
  useFocusEffect(refresh);
  const remove = (id: number, name: string) => Alert.alert('Usunąć szablon?', `„${name}” zostanie usunięty. Zapisane treningi pozostaną bez zmian.`, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Usuń', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(db, id); setTemplates((items) => items.filter((item) => item.id !== id)); } }]);
  return <Page><Heading eyebrow="Twoje plany" title="Szablony treningów" subtitle="Zapisz układ ćwiczeń i serii, a wartości uzupełnij podczas treningu." />
    <Action label="＋  Utwórz szablon" onPress={() => router.push('/templates/edit')} />
    {!templates.length ? <EmptyState title="Brak szablonów" body="Utwórz pierwszy szablon, aby szybciej rozpoczynać regularne treningi." /> : templates.map((template) => <Card key={template.id}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{template.name}</Text><Text style={{ color: c.muted }}>{template.exercise_count} ćwiczeń</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Action label="Edytuj" secondary onPress={() => router.push(`/templates/edit?id=${template.id}`)} /></View><Pressable accessibilityRole="button" accessibilityLabel={`Usuń szablon ${template.name}`} onPress={() => remove(template.id, template.name)} style={{ justifyContent: 'center', paddingHorizontal: 12 }}><Text style={{ color: c.danger, fontWeight: '700' }}>Usuń</Text></Pressable></View>
    </Card>)}
  </Page>;
}
