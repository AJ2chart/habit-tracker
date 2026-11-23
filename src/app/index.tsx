import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddHabitSheet, AddSlotSheet, ManageHabitsSheet, SlotDetailSheet, type NewSlot } from '@/components/today/sheets';
import { HabitsCard } from '@/components/today/habits-card';
import { JournalCard } from '@/components/today/journal-card';
import { ScheduleCard } from '@/components/today/schedule-card';
import { SleepCard } from '@/components/today/sleep-card';
import { Body, Button, Card, IconButton, Muted, Screen } from '@/components/ui';
import { MoodColors, Spacing } from '@/constants/theme';
import {
  addHabit,
  addRule,
  addSlot,
  archiveHabit,
  deleteSleep,
  deleteSlot,
  ensureOccurrences,
  saveJournal,
  saveSleep,
  saveSlotNote,
  setHabitChecked,
  setSlotDone,
  stopRule,
  updateHabit,
  updateRule,
} from '@/db/actions';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { addDays, brokenStreaks, fromKey, mondayOf, sameDayLastYear, type RecurringRule, type Slot } from '@/logic';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (k: string) => fromKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function TodayScreen() {
  const c = useTheme();
  const { db, data, today, reload } = useAppData();
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingHabit, setAddingHabit] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Jour demandé depuis un autre onglet (Journal) : ?day=YYYY-MM-DD, t = horodatage pour rouvrir le même jour.
  const params = useLocalSearchParams<{ day?: string; t?: string }>();
  useEffect(() => {
    if (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)) setPicked(params.day);
  }, [params.day, params.t]);

  const day = picked ?? today;
  const isToday = day === today;

  // Crée les occurrences des tâches répétées du jour affiché, puis recharge.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      const n = await ensureOccurrences(db, data, day);
      if (n && !cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [data, day, db, reload]);

  if (!data) return <Screen title="Aujourd'hui" subtitle="Chargement…" />;

  const run = async (fn: () => Promise<unknown>) => {
    await fn();
    await reload();
  };

  const detail: Slot | null = detailId ? (data.slots[day] ?? []).find((s) => s.id === detailId) ?? null : null;

  const submitSlot = (s: NewSlot) =>
    run(async () => {
      if (editingRule) {
        if (s.repeat !== 'once')
          await updateRule(db, editingRule.id, { title: s.title, start: s.start, end: s.end, habitId: s.habitId, type: s.repeat, days: s.repeat === 'custom' ? s.days : [] }, today);
        setEditingRule(null);
        return;
      }
      if (s.repeat === 'once') await addSlot(db, { date: day, start: s.start, end: s.end, title: s.title, habitId: s.habitId }, data);
      else await addRule(db, { title: s.title, start: s.start, end: s.end, habitId: s.habitId, type: s.repeat, days: s.repeat === 'custom' ? s.days : [], from: day });
      setAdding(false);
    });

  const alerts = isToday ? brokenStreaks(data, today) : [];
  const showReview = isToday && fromKey(today).getDay() === 0 && !data.reviews[mondayOf(today)]?.change;

  const lyKey = sameDayLastYear(day);
  const lastYear = data.journal[lyKey];

  return (
    <>
      <Screen
        title={isToday ? "Aujourd'hui" : capitalize(longDate(day))}
        subtitle={isToday ? longDate(day) : day < today ? 'Journée passée' : 'À venir'}
        left={<IconButton label="Jour précédent" glyph="‹" onPress={() => setPicked(addDays(day, -1))} />}
        right={<IconButton label="Jour suivant" glyph="›" onPress={() => setPicked(addDays(day, 1))} />}>
        {!isToday ? <Button label="Revenir à aujourd'hui" variant="small" onPress={() => setPicked(null)} style={{ alignSelf: 'center' }} /> : null}

        {alerts.map((h) => (
          <View key={h.id} style={[styles.alert, { backgroundColor: c.backgroundElement, borderColor: c.line, borderLeftColor: c.warn }]}>
            <Body style={{ fontWeight: '600' }}>{`2 jours sans « ${h.name} »`}</Body>
            <Muted>Une version courte aujourd'hui suffit à relancer la série avant qu'elle se perde.</Muted>
            <Button label="C'est fait aujourd'hui" variant="small" onPress={() => run(() => setHabitChecked(db, today, h.id, true))} />
          </View>
        ))}
        {showReview ? (
          <View style={[styles.alert, { backgroundColor: c.backgroundElement, borderColor: c.line, borderLeftColor: c.goal }]}>
            <Body style={{ fontWeight: '600' }}>C'est dimanche : revue de la semaine</Body>
            <Muted>Trois questions, trois minutes.</Muted>
            <Button label="Faire ma revue" variant="small" onPress={() => router.navigate('/semaine')} />
          </View>
        ) : null}

        {day <= today ? (
          <SleepCard
            day={day}
            isToday={isToday}
            entry={data.sleep[day]}
            onSave={(n) => run(() => saveSleep(db, { date: day, ...n }))}
            onDelete={() => run(() => deleteSleep(db, day))}
          />
        ) : null}

        <ScheduleCard
          data={data}
          day={day}
          isToday={isToday}
          onToggle={(s) => run(() => setSlotDone(db, s, !s.done))}
          onOpen={(s) => setDetailId(s.id)}
          onAdd={() => setAdding(true)}
        />

        <HabitsCard
          data={data}
          day={day}
          today={today}
          onToggle={(id, on) => run(() => setHabitChecked(db, day, id, on))}
          onAdd={() => setAddingHabit(true)}
          onManage={() => setManaging(true)}
        />

        <JournalCard day={day} entry={data.journal[day]} onSave={(e) => run(() => saveJournal(db, day, e))} />

        {lastYear && (lastYear.text || lastYear.mood !== null) ? (
          <Card title="Il y a un an" right={<Muted>{fromKey(lyKey).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Muted>}>
            <Pressable style={styles.lastYear} onPress={() => setPicked(lyKey)} accessibilityRole="button" accessibilityLabel="Ouvrir cette journée">
              <View style={[styles.dot, { backgroundColor: lastYear.mood !== null ? MoodColors[lastYear.mood] : c.line }]} />
              <Text style={{ color: lastYear.text ? c.text : c.textSecondary, flex: 1, fontSize: 15, lineHeight: 21 }}>
                {lastYear.text || 'Pas de note'}
              </Text>
            </Pressable>
          </Card>
        ) : null}
      </Screen>

      <AddSlotSheet
        visible={adding || !!editingRule}
        day={day}
        data={data}
        rule={editingRule}
        onClose={() => {
          setAdding(false);
          setEditingRule(null);
        }}
        onSubmit={submitSlot}
      />
      <SlotDetailSheet
        slot={detail}
        data={data}
        onClose={() => setDetailId(null)}
        onSaveNote={(note) => detail && run(() => saveSlotNote(db, detail.id, note))}
        onDelete={() =>
          detail &&
          run(async () => {
            await deleteSlot(db, detail.id);
            setDetailId(null);
          })
        }
        onEditRule={(rule) => {
          setDetailId(null);
          // Laisse la première feuille se fermer avant d'ouvrir la suivante (iOS n'en affiche qu'une à la fois).
          setTimeout(() => setEditingRule(rule), 350);
        }}
        onStopRule={(rule) =>
          run(async () => {
            await stopRule(db, rule.id, today);
            setDetailId(null);
          })
        }
      />
      <ManageHabitsSheet
        visible={managing}
        data={data}
        onClose={() => setManaging(false)}
        onUpdate={(id, name, perWeek) => run(() => updateHabit(db, id, name, perWeek))}
        onArchive={(id) => run(() => archiveHabit(db, id))}
      />
      <AddHabitSheet
        visible={addingHabit}
        onClose={() => setAddingHabit(false)}
        onSubmit={(name, perWeek) =>
          run(async () => {
            await addHabit(db, name, perWeek);
            setAddingHabit(false);
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  alert: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  lastYear: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
