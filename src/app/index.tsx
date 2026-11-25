import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddHabitSheet, AddSlotSheet, ManageHabitsSheet, SlotDetailSheet, type NewSlot } from '@/components/today/sheets';
import { HabitsCard } from '@/components/today/habits-card';
import { EveningMoodCard, MorningMoodCard } from '@/components/today/journal-card';
import { NotesCard } from '@/components/today/notes-card';
import { NowCard } from '@/components/today/now-card';
import { RoutineCard } from '@/components/today/routine-card';
import { ScheduleCard } from '@/components/today/schedule-card';
import { SleepCard } from '@/components/today/sleep-card';
import { Card, IconButton, Muted, Screen, TextButton } from '@/components/ui';
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
  addNote,
  updateNote,
  deleteNote,
  saveMorning,
  saveSleep,
  saveSlotNote,
  setHabitChecked,
  setPlanValidated,
  setSlotDone,
  stopRule,
  updateHabit,
  updateRule,
} from '@/db/actions';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { addDays, fromKey, isChallengeEnded, mondayOf, morningChecklist, nowHM, parseMorningSettings, sameDayLastYear, suggestTags, todayLayout, type TodayCard, type RecurringRule, type Slot } from '@/logic';
import { loadSettings } from '@/db/settings';
import { useOnChange } from '@/hooks/use-on-change';

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
  /** Afficher la carte du soir avant 17 h (sur demande) */
  const [writeEarly, setWriteEarly] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    void loadSettings(db).then(setSettings);
  }, [db, data]);

  // Jour demandé depuis un autre onglet (Journal) : ?day=YYYY-MM-DD, t = horodatage pour rouvrir le même jour.
  const params = useLocalSearchParams<{ day?: string; t?: string }>();
  useOnChange(`${params.day ?? ''}|${params.t ?? ''}`, () => {
    if (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)) setPicked(params.day);
  });

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

  // Challenge terminé depuis moins de 14 jours, dont le bilan n'a pas encore été ouvert.
  const endedChallenges = isToday
    ? data.goals.filter((g) => isChallengeEnded(g, today) && g.endDate! >= addDays(today, -14) && !settings[`challenge_${g.id}`])
    : [];
  const showReview = isToday && fromKey(today).getDay() === 0 && !data.reviews[mondayOf(today)]?.change;

  const morning = parseMorningSettings(settings);
  const routine = isToday && morning.enabled ? morningChecklist(data, day, morning) : [];
  const showRoutine = routine.length > 0 && routine.some((i) => !i.done);
  const showMorningMood = day <= today;

  const tags = suggestTags(data);
  // Après 17 h (ou un autre jour), le soir passe devant ; avant, la journée commence par le matin.
  const { showEvening, order: cards } = todayLayout(day, today, new Date().getHours(), { eveningFilled: !!data.journal[day], writeEarly });

  const cardViews: Record<TodayCard, ReactNode> = {
    routine: showRoutine ? <RoutineCard items={routine} onToggleHabit={(id, on) => run(() => setHabitChecked(db, day, id, on))} /> : null,
    now: isToday ? (
      <NowCard slots={data.slots[day] ?? []} now={nowHM()} onOpen={(s) => setDetailId(s.id)} onToggle={(s) => run(() => setSlotDone(db, s, true))} />
    ) : null,
    sleep:
      day <= today ? (
        <SleepCard
          day={day}
          isToday={isToday}
          entry={data.sleep[day]}
          previous={Object.keys(data.sleep).filter((k) => k < day).sort().map((k) => data.sleep[k]).pop()}
          onSave={(n) => run(() => saveSleep(db, { date: day, ...n }))}
          onDelete={() => run(() => deleteSleep(db, day))}
        />
      ) : null,
    morning: showMorningMood ? <MorningMoodCard key={day} day={day} entry={data.morning[day]} tags={tags} onSave={(e) => run(() => saveMorning(db, day, e))} /> : null,
    schedule: (
      <ScheduleCard
        key={day}
        data={data}
        day={day}
        isToday={isToday}
        onToggle={(s) => run(() => setSlotDone(db, s, !s.done))}
        onOpen={(s) => setDetailId(s.id)}
        onAdd={() => setAdding(true)}
        validated={!!data.plans[day]}
        onValidate={(morning.steps.includes('plan') && day >= today) || data.plans[day] ? (on) => run(() => setPlanValidated(db, day, on)) : undefined}
      />
    ),
    habits: (
      <HabitsCard
        key={day}
        data={data}
        day={day}
        today={today}
        onToggle={(id, on) => run(() => setHabitChecked(db, day, id, on))}
        onAdd={() => setAddingHabit(true)}
        onManage={() => setManaging(true)}
      />
    ),
    notes:
      day <= today ? (
        <NotesCard
          notes={data.notes[day] ?? []}
          onAdd={(text) => run(() => addNote(db, day, nowHM(), text))}
          onUpdate={(id, text) => run(() => updateNote(db, id, text))}
          onDelete={(id) => run(() => deleteNote(db, id))}
        />
      ) : null,
    evening: showEvening ? (
      <EveningMoodCard key={day} day={day} entry={data.journal[day]} tags={tags} onSave={(e) => run(() => saveJournal(db, day, e))} />
    ) : isToday ? (
      <View style={{ alignItems: 'center' }}>
        <TextButton label="Écrire dans le journal du soir" onPress={() => setWriteEarly(true)} />
      </View>
    ) : null,
  };

  const lyKey = sameDayLastYear(day);
  const lastYear = data.journal[lyKey];

  return (
    <>
      <Screen
        title={isToday ? "Aujourd'hui" : capitalize(longDate(day))}
        subtitle={isToday ? longDate(day) : day < today ? 'Journée passée' : 'À venir'}
        left={<IconButton label="Jour précédent" glyph="‹" onPress={() => setPicked(addDays(day, -1))} />}
        right={<IconButton label="Jour suivant" glyph="›" onPress={() => setPicked(addDays(day, 1))} />}>
        {!isToday ? (
          <View style={{ alignItems: 'center' }}>
            <TextButton label="Revenir à aujourd'hui" onPress={() => setPicked(null)} />
          </View>
        ) : null}

        {endedChallenges.map((g) => (
          <View key={g.id} style={[styles.alert, { borderColor: c.line, borderLeftColor: c.goal }]}>
            <Text style={[styles.alertText, { color: c.text }]} numberOfLines={2}>{`Challenge « ${g.title} » terminé`}</Text>
            <TextButton
              label="Bilan"
              onPress={() => router.navigate({ pathname: '/objectifs', params: { review: g.id, t: String(Date.now()) } })}
              accessibilityLabel={`Voir le bilan du challenge ${g.title}`}
            />
          </View>
        ))}
        {showReview ? (
          <View style={[styles.alert, { borderColor: c.line, borderLeftColor: c.goal }]}>
            <Text style={[styles.alertText, { color: c.text }]}>Dimanche : revue de la semaine</Text>
            <TextButton label="Faire" onPress={() => router.navigate('/semaine')} accessibilityLabel="Faire la revue de la semaine" />
          </View>
        ) : null}

        {cards.map((k) => (
          <Fragment key={k}>{cardViews[k]}</Fragment>
        ))}
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
  alert: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, borderWidth: 1, borderLeftWidth: 3, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10 },
  alertText: { flex: 1, fontSize: 14, fontWeight: '500' },
  lastYear: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
