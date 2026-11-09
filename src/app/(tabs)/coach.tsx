import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActivityIndicator, Text } from 'react-native';
import { Action, Card, EmptyState, Heading, Page } from '@/components/ui/primitives';
import { palette as c } from '@/constants/app-theme';
type Summary = { name: string; sessions: number; date: string; best_weight: number; best_reps: number };
export default function CoachScreen() {
  const db = useSQLiteContext(); const [summary, setSummary] = useState<Summary[]>([]); const [consented, setConsented] = useState(false); const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => { let active = true; db.getAllAsync<Summary>(`SELECT e.name, COUNT(DISTINCT w.id) AS sessions, MAX(w.performed_at) AS date, MAX(s.weight) AS best_weight, MAX(s.reps) AS best_reps FROM exercises e JOIN workout_exercises we ON we.exercise_id=e.id JOIN workouts w ON w.id=we.workout_id JOIN sets s ON s.workout_exercise_id=we.id WHERE s.weight IS NOT NULL GROUP BY e.id ORDER BY date DESC`).then((rows) => active && setSummary(rows)); return () => { active = false; }; }, [db]));
  const ask = async () => { const endpoint = process.env.EXPO_PUBLIC_AI_API_URL; if (!endpoint) { setMessage('Moduł AI nie jest jeszcze skonfigurowany. Dziennik i analiza działają lokalnie.'); return; } setLoading(true); setMessage(''); try { const response = await fetch(`${endpoint.replace(/\/$/, '')}/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: summary }) }); if (!response.ok) throw new Error(); const result = await response.json() as { suggestion?: string }; setMessage(result.suggestion || 'Nie udało się przygotować sugestii.'); } catch { setMessage('Nie udało się połączyć z usługą AI. Spróbuj później.'); } finally { setLoading(false); } };
  return <Page><Heading eyebrow="Twój asystent" title="Sugestie z wyczuciem." subtitle="Krótka podpowiedź oparta na Twoim dzienniku. Ty decydujesz, co z nią zrobić." />
    {!summary.length ? <EmptyState title="Najpierw zapisz kilka serii" body="Gdy pojawi się historia, będzie można poprosić o komentarz do treningów." /> : <>
      <Card><Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Co zostanie wysłane</Text><Text style={{ color: c.muted, lineHeight: 21 }}>Tylko nazwy ćwiczeń, daty sesji i podsumowanie ciężarów oraz powtórzeń. Bez imienia, nazwiska i notatek.</Text><Text style={{ color: c.muted, lineHeight: 21 }}>Dane trafią do zewnętrznej usługi AI. Sugestia ma charakter informacyjny i nie zmieni Twoich zapisów.</Text></Card>
      {consented ? <Action label={loading ? 'Analizuję…' : 'Poproś o sugestię'} onPress={ask} disabled={loading} /> : <Action label="Rozumiem — przejdź dalej" onPress={() => setConsented(true)} />}
      {loading ? <ActivityIndicator color={c.accent} accessibilityLabel="Trwa przygotowanie sugestii"/> : null}{message ? <Card><Text style={{ color: c.text, lineHeight: 23 }}>{message}</Text></Card> : null}
    </>}
  </Page>;
}
