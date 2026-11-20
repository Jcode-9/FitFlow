import { Pressable, Text, View } from 'react-native';
import { palette as c } from '@/constants/app-theme';
import type { MonthProgress, MuscleWorkload } from '@/data/database';

const weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const weekdayNames = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const monthLabel = (year: number, month: number) => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
const workoutCountLabel = (count: number) => count === 1 ? '1 trening' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? `${count} treningi` : `${count} treningów`;
const volumeLabel = (value: number) => `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg`;

export function MonthCalendar({ year, month, workoutDays, selectedDate, onDayPress, compact = false }: { year: number; month: number; workoutDays: Record<string, number>; selectedDate?: string | null; onDayPress?: (date: string) => void; compact?: boolean }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const today = dateKey(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  return <View accessibilityLabel={`Kalendarz: ${monthLabel(year, month)}`}>
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>{weekdays.map((label, index) => <Text key={label} accessibilityLabel={weekdayNames[index]} style={{ flex: 1, textAlign: 'center', color: c.muted, fontSize: 12, fontWeight: '700', paddingVertical: 5 }}>{label}</Text>)}</View>
    {rows.map((week, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row' }}>{week.map((day, columnIndex) => {
      if (day === null) return <View key={`empty-${rowIndex}-${columnIndex}`} style={{ flex: 1, height: compact ? 38 : 48 }} />;
      const key = dateKey(year, month, day); const count = workoutDays[key] ?? 0; const selected = selectedDate === key; const dateLabel = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
      const cell = <View style={{ height: compact ? 38 : 48, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <Text style={{ color: selected ? c.background : c.text, fontSize: 14, fontWeight: count || selected || key === today ? '800' : '500', width: compact ? 28 : 32, height: compact ? 22 : 28, textAlign: 'center', textAlignVertical: 'center', borderRadius: 16, overflow: 'hidden', backgroundColor: selected ? c.accent : key === today ? c.surfaceRaised : 'transparent' }}>{day}</Text>
        <View style={{ height: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
          {count === 1 ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent }} /> : count > 1 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.accentDark, paddingHorizontal: 4, borderRadius: 6 }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent }} /><Text style={{ color: c.accent, fontSize: 8, lineHeight: 10, fontWeight: '800' }}>{count}</Text></View> : null}
        </View>
      </View>;
      return <View key={key} style={{ flex: 1 }}>{onDayPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${weekdayNames[columnIndex]}, ${dateLabel}${count ? `, ${workoutCountLabel(count)}` : ', brak treningu'}`} accessibilityState={{ selected }} onPress={() => onDayPress(key)}>{cell}</Pressable> : <View accessible={!compact} accessibilityLabel={compact ? undefined : `${weekdayNames[columnIndex]}, ${dateLabel}${count ? `, ${workoutCountLabel(count)}` : ', brak treningu'}`}>{cell}</View>}</View>;
    })}</View>)}
  </View>;
}

export function MonthSnapshot({ progress }: { progress: MonthProgress }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    <Metric value={String(progress.workout_count)} label={progress.workout_count === 1 ? 'trening' : progress.workout_count % 10 >= 2 && progress.workout_count % 10 <= 4 && (progress.workout_count % 100 < 12 || progress.workout_count % 100 > 14) ? 'treningi' : 'treningów'} />
    <Metric value={String(progress.set_count)} label="serii" />
    <Metric value={volumeLabel(progress.total_volume)} label="łączny tonaż" />
  </View>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View accessible accessibilityLabel={`${value}, ${label}`} style={{ flex: 1, minHeight: 76, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surfaceRaised, borderRadius: 14, padding: 8, gap: 3 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>{value}</Text><Text style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>{label}</Text></View>;
}

export function MuscleWorkloadCard({ muscles }: { muscles: MuscleWorkload[] }) {
  const ordered = [...muscles].sort((a, b) => b.set_equivalents - a.set_equivalents || a.name.localeCompare(b.name, 'pl-PL'));
  const maximum = Math.max(1, ...ordered.map((item) => item.set_equivalents));
  if (!ordered.some((item) => item.set_equivalents > 0)) return <Text style={{ color: c.muted }}>Brak ćwiczeń z przypisanymi mięśniami w tym miesiącu.</Text>;
  return <View style={{ gap: 12 }}>
    <Text style={{ color: c.muted, fontSize: 12 }}>Mięsień główny: 1 seria · pomocniczy: 0,5 serii</Text>
    {ordered.map((muscle) => <MuscleRow key={muscle.key} muscle={muscle} maximum={maximum} />)}
  </View>;
}

function MuscleRow({ muscle, maximum }: { muscle: MuscleWorkload; maximum: number }) {
  const value = muscle.set_equivalents.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  return <View accessible accessibilityLabel={`${muscle.name}: ${value} serii mięśniowych`} style={{ gap: 5 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: c.text, fontSize: 13, flex: 1 }}>{muscle.name}</Text><Text style={{ color: muscle.set_equivalents ? c.accent : c.muted, fontSize: 13, fontWeight: '700' }}>{value}</Text></View>
    <View style={{ height: 7, backgroundColor: c.surfaceRaised, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${muscle.set_equivalents / maximum * 100}%`, height: '100%', backgroundColor: muscle.set_equivalents ? c.accent : 'transparent', borderRadius: 5 }} /></View>
  </View>;
}
