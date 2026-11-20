import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Action, Card, EmptyState, Heading, Page, SectionTitle } from '@/components/ui/primitives';
import { MonthCalendar, MonthSnapshot, MuscleWorkloadCard } from '@/components/progress/monthly';
import { palette as c } from '@/constants/app-theme';
import { getEarliestWorkoutMonth, getMonthProgress, getWorkoutsForDate, type MonthProgress, type WorkoutSummary } from '@/data/database';

type Month = { year: number; month: number };
const currentMonth = (): Month => { const date = new Date(); return { year: date.getFullYear(), month: date.getMonth() + 1 }; };
const monthOrdinal = ({ year, month }: Month) => year * 12 + month - 1;
const monthFromOrdinal = (ordinal: number): Month => ({ year: Math.floor(ordinal / 12), month: ordinal % 12 + 1 });
const monthLabel = ({ year, month }: Month) => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('pl-PL', { month: 'long' }).format(new Date(2026, index, 1)));
const formatDate = (date: string) => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));

export default function ProgressHistoryScreen() {
  const db = useSQLiteContext(); const [month, setMonth] = useState<Month>(currentMonth); const [earliestMonth, setEarliestMonth] = useState<Month>(currentMonth); const [hasHistory, setHasHistory] = useState(false);
  const [monthResult, setMonthResult] = useState<{ key: string; data: MonthProgress } | null>(null); const [failedMonth, setFailedMonth] = useState<string | null>(null); const [selectedDate, setSelectedDate] = useState<string | null>(null); const [dayWorkouts, setDayWorkouts] = useState<WorkoutSummary[]>([]); const [showMonthPicker, setShowMonthPicker] = useState(false); const [pickerYear, setPickerYear] = useState(month.year);
  const latestOrdinal = monthOrdinal(currentMonth()); const earliestOrdinal = hasHistory ? Math.min(monthOrdinal(earliestMonth), latestOrdinal) : latestOrdinal; const activeOrdinal = monthOrdinal(month); const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`;
  const progress = monthResult?.key === monthKey ? monthResult.data : null; const loadingError = failedMonth === monthKey;
  const canGoPrevious = activeOrdinal > earliestOrdinal; const canGoNext = activeOrdinal < latestOrdinal;
  const monthName = monthLabel(month);

  useFocusEffect(useCallback(() => {
    let active = true;
    getEarliestWorkoutMonth(db).then((first) => {
      if (!active) return;
      setHasHistory(Boolean(first));
      if (first) {
        const [year, monthNumber] = first.split('-').map(Number);
        setEarliestMonth({ year, month: monthNumber });
      } else setEarliestMonth(currentMonth());
    }).catch(() => active && setFailedMonth(monthKey));
    getMonthProgress(db, month.year, month.month).then((result) => { if (active) { setMonthResult({ key: monthKey, data: result }); setFailedMonth(null); } }).catch(() => active && setFailedMonth(monthKey));
    return () => { active = false; };
  }, [db, month.year, month.month, monthKey]));

  useEffect(() => {
    let active = true;
    if (!selectedDate) return () => { active = false; };
    getWorkoutsForDate(db, selectedDate).then((items) => active && setDayWorkouts(items)).catch(() => active && setDayWorkouts([]));
    return () => { active = false; };
  }, [db, selectedDate]);

  const changeMonth = (next: Month) => { setMonth(next); setSelectedDate(null); setShowMonthPicker(false); };
  const shiftMonth = (amount: number) => changeMonth(monthFromOrdinal(activeOrdinal + amount));
  const chooseYear = (amount: number) => setPickerYear((value) => Math.min(currentMonth().year, Math.max(earliestMonth.year, value + amount)));
  const selectMonth = (monthNumber: number) => {
    const candidate = { year: pickerYear, month: monthNumber }; const ordinal = monthOrdinal(candidate);
    if (ordinal >= earliestOrdinal && ordinal <= latestOrdinal) changeMonth(candidate);
  };
  const selectedMonthDayCounts = progress?.workout_days ?? {};
  const formattedSelectedDate = selectedDate ? formatDate(selectedDate) : null;

  return <Page><Heading eyebrow="Historia" title="Kalendarz treningów." subtitle="Przeglądaj miesiące i otwieraj zapisane sesje." />
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc" accessibilityState={{ disabled: !canGoPrevious }} disabled={!canGoPrevious} onPress={() => shiftMonth(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised, opacity: canGoPrevious ? 1 : 0.4 }}><Text style={{ color: c.text, fontSize: 22 }}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Wybierz miesiąc i rok. ${monthName}`} accessibilityState={{ expanded: showMonthPicker }} onPress={() => { setPickerYear(month.year); setShowMonthPicker((visible) => !visible); }} style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 18, fontWeight: '800', textTransform: 'capitalize' }}>{monthName}⌄</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Następny miesiąc" accessibilityState={{ disabled: !canGoNext }} disabled={!canGoNext} onPress={() => shiftMonth(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised, opacity: canGoNext ? 1 : 0.4 }}><Text style={{ color: c.text, fontSize: 22 }}>›</Text></Pressable>
      </View>
      {showMonthPicker ? <View style={{ gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.surfaceRaised }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Pressable accessibilityRole="button" accessibilityLabel="Poprzedni rok" disabled={pickerYear <= earliestMonth.year} onPress={() => chooseYear(-1)} style={{ minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: pickerYear <= earliestMonth.year ? 0.4 : 1 }}><Text style={{ color: c.text, fontSize: 20 }}>‹</Text></Pressable><Text accessibilityRole="header" style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{pickerYear}</Text><Pressable accessibilityRole="button" accessibilityLabel="Następny rok" disabled={pickerYear >= currentMonth().year} onPress={() => chooseYear(1)} style={{ minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: pickerYear >= currentMonth().year ? 0.4 : 1 }}><Text style={{ color: c.text, fontSize: 20 }}>›</Text></Pressable></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{monthNames.map((label, index) => {
          const monthNumber = index + 1; const ordinal = monthOrdinal({ year: pickerYear, month: monthNumber }); const enabled = ordinal >= earliestOrdinal && ordinal <= latestOrdinal; const selected = month.year === pickerYear && month.month === monthNumber;
          return <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label} ${pickerYear}`} accessibilityState={{ selected, disabled: !enabled }} disabled={!enabled} onPress={() => selectMonth(monthNumber)} style={{ width: '31.5%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: selected ? c.accent : c.surface, opacity: enabled ? 1 : 0.35 }}><Text style={{ color: selected ? c.background : c.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{label}</Text></Pressable>;
        })}</View>
      </View> : null}
      <MonthCalendar year={month.year} month={month.month} workoutDays={selectedMonthDayCounts} selectedDate={selectedDate} onDayPress={(date) => { if (selectedDate !== date) { setDayWorkouts([]); setSelectedDate(date); } }} />
      <Text style={{ color: c.muted, fontSize: 12 }}>Zaznaczone dni to treningi. Liczba przy kropce oznacza kilka sesji.</Text>
    </Card>

    <View style={{ gap: 10 }}><SectionTitle title={formattedSelectedDate ? `Treningi · ${formattedSelectedDate}` : 'Treningi z wybranego dnia'} />
      {!selectedDate ? <Text style={{ color: c.muted }}>Wybierz dzień w kalendarzu, aby zobaczyć zapisane sesje.</Text> : dayWorkouts.length ? dayWorkouts.map((workout) => <Pressable key={workout.id} accessibilityRole="button" accessibilityLabel={`${workout.name}, ${workout.exercise_count} ćwiczeń, ${workout.set_count} serii`} onPress={() => router.push(`/workout/${workout.id}`)}><Card><Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{workout.name}</Text><Text style={{ color: c.muted }}>{workout.exercise_count} ćwiczeń · {workout.set_count} serii</Text><Text style={{ color: c.accent, fontWeight: '700' }}>{Math.round(workout.total_volume).toLocaleString('pl-PL')} kg</Text></Card></Pressable>) : <EmptyState title="Brak treningu" body="W tym dniu nie zapisano żadnej sesji." />}
    </View>

    {loadingError ? <EmptyState title="Nie udało się wczytać danych" body="Spróbuj ponownie otworzyć kalendarz." /> : progress ? <>
      <Card><SectionTitle title="Podsumowanie miesiąca" /><MonthSnapshot progress={progress} /><Text style={{ color: c.muted, fontSize: 12 }}>Tonaż to suma ciężaru × powtórzeń; serie z trybu notatki nie zwiększają tonażu.</Text></Card>
      {progress.workout_count ? <Card><SectionTitle title="Praca partii mięśniowych" /><MuscleWorkloadCard muscles={progress.muscles} /></Card> : <EmptyState title="Brak treningów w tym miesiącu" body="Zaznaczone sesje pojawią się w kalendarzu i miesięcznym podsumowaniu." />}
    </> : null}
    <Action label="Wróć do postępów" secondary onPress={() => router.back()} />
  </Page>;
}
