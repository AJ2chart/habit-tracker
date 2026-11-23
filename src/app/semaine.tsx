import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconButton, Muted, Row, Screen } from '@/components/ui';
import { ReviewCard } from '@/components/week/review-card';
import { Spacing } from '@/constants/theme';
import { saveReview, setHabitChecked, stopRule } from '@/db/actions';
import { newId } from '@/db/repo';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import {
  PERIOD_UNIT,
  addDays,
  challengeStep,
  fromKey,
  goalProgress,
  isActiveAt,
  isBadDay,
  isChecked,
  missingOccurrences,
  mondayOf,
  range,
  ruleLabel,
  type Data,
  type Slot,
} from '@/logic';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const short = (k: string) => fromKey(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Créneaux du jour, y compris les occurrences répétées pas encore créées (jours futurs). */
function slotsOf(data: Data, day: string): Slot[] {
  const existing = data.slots[day] ?? [];
  return existing.concat(missingOccurrences(day, data.rules, existing, (h) => isChecked(data, day, h), newId));
}

function Stat({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.backgroundElement, borderColor: c.line }]}>
      <Text style={[styles.statValue, { color: warn ? c.warn : c.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function WeekScreen() {
  const c = useTheme();
  const { db, data, today, reload } = useAppData();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  const monday = picked ?? mondayOf(today);
  const days = range(monday, addDays(monday, 6));
  const isCurrent = monday === mondayOf(today);
  const future = monday > today;

  if (!data) return <Screen title="Semaine" subtitle="Chargement…" />;

  const run = async (fn: () => Promise<unknown>) => {
    await fn();
    await reload();
  };

  const habits = data.habits.filter((h) => !h.archived);
  const perDay = days.map((d) => {
    const s = slotsOf(data, d);
    return { total: s.length, done: s.filter((x) => x.done).length };
  });
  const totalSlots = perDay.reduce((a, p) => a + p.total, 0);
  const doneSlots = perDay.reduce((a, p) => a + p.done, 0);
  const checks = days.reduce((a, d) => a + habits.filter((h) => isChecked(data, d, h.id)).length, 0);
  const checksGoal = habits.reduce((a, h) => a + h.perWeek, 0);
  const badDays = days.filter((d) => d <= today && isBadDay(data.journal[d])).length;
  const weeklyGoals = data.goals.filter((g) => g.level === 'hebdo' && isActiveAt(g, monday));
  const rules = data.rules.filter((r) => !r.until || r.until >= today).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Screen
      title={isCurrent ? 'Cette semaine' : `Semaine du ${short(monday)}`}
      subtitle={`${short(monday)} – ${short(days[6])}`}
      left={<IconButton label="Semaine précédente" glyph="‹" onPress={() => setPicked(addDays(monday, -7))} />}
      right={<IconButton label="Semaine suivante" glyph="›" onPress={() => setPicked(addDays(monday, 7))} />}>
      {!isCurrent ? <Button label="Revenir à cette semaine" variant="small" onPress={() => setPicked(null)} style={{ alignSelf: 'center' }} /> : null}

      <Row style={{ alignItems: 'stretch' }}>
        <Stat value={totalSlots ? `${Math.round((doneSlots / totalSlots) * 100)} %` : '—'} label="créneaux faits" />
        <Stat value={`${checks}/${checksGoal}`} label="habitudes cochées" />
        <Stat value={String(badDays)} label={badDays > 1 ? 'jours difficiles' : 'jour difficile'} warn={badDays > 0} />
      </Row>

      <Card title="Habitudes">
        {habits.length === 0 ? <Muted>Aucune habitude.</Muted> : null}
        {habits.length ? (
          <View style={styles.gridRow}>
            <View style={styles.gridName} />
            {DAY_LETTERS.map((l, i) => (
              <Text key={i} style={[styles.gridHead, { color: days[i] === today ? c.text : c.textSecondary, fontWeight: days[i] === today ? '700' : '400' }]}>
                {l}
              </Text>
            ))}
            <View style={styles.gridTotal} />
          </View>
        ) : null}
        {habits.map((h) => {
          const n = days.filter((d) => isChecked(data, d, h.id)).length;
          return (
            <View key={h.id} style={styles.gridRow}>
              <Text style={[styles.gridName, { color: c.text }]} numberOfLines={1}>
                {h.name}
              </Text>
              {days.map((d) => {
                const on = isChecked(data, d, h.id);
                const disabled = d > today;
                return (
                  <Pressable
                    key={d}
                    disabled={disabled}
                    onPress={() => run(() => setHabitChecked(db, d, h.id, !on))}
                    hitSlop={4}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled }}
                    accessibilityLabel={`${h.name}, ${fromKey(d).toLocaleDateString('fr-FR', { weekday: 'long' })}`}
                    style={styles.cellWrap}>
                    <View
                      style={[
                        styles.cell,
                        { backgroundColor: on ? c.accent : c.line, opacity: disabled ? 0.4 : 1 },
                        d === today && { borderWidth: 2, borderColor: c.goal },
                      ]}
                    />
                  </Pressable>
                );
              })}
              <Text style={[styles.gridTotal, { color: n >= h.perWeek ? c.text : c.textSecondary, fontWeight: n >= h.perWeek ? '600' : '400' }]}>
                {`${n}/${h.perWeek}`}
              </Text>
            </View>
          );
        })}
        {habits.length ? <Muted>Touche une case pour cocher ou décocher un jour passé.</Muted> : null}
      </Card>

      <Card title="Prévu ↔ fait">
        <View style={styles.bars}>
          {perDay.map((p, i) => {
            const ratio = p.total ? p.done / p.total : 0;
            return (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barNum, { color: c.textSecondary }]}>{p.total ? `${p.done}/${p.total}` : ''}</Text>
                <View style={[styles.barTrack, { backgroundColor: c.backgroundSelected }]}>
                  <View style={{ height: `${Math.round(ratio * 100)}%` as `${number}%`, backgroundColor: c.accent, borderRadius: 4, opacity: days[i] > today ? 0.3 : 1 }} />
                </View>
                <Text style={[styles.barLabel, { color: days[i] === today ? c.text : c.textSecondary }]}>{DAY_LETTERS[i]}</Text>
              </View>
            );
          })}
        </View>
        <Muted>Part des créneaux de l'emploi du temps réellement faits, jour par jour.</Muted>
      </Card>

      <Card title="Objectifs de la semaine">
        {weeklyGoals.length === 0 ? <Muted>Aucun objectif hebdomadaire. Crée-en un dans l'onglet Objectifs.</Muted> : null}
        {weeklyGoals.map((g) => {
          const p = goalProgress(data, g, monday);
          const ch = challengeStep(g, monday);
          const habit = g.habitId ? data.habits.find((h) => h.id === g.habitId) : undefined;
          return (
            <View key={g.id} style={styles.goal}>
              <View style={styles.goalTop}>
                <Text style={[styles.goalTitle, { color: c.text }]}>{g.title}</Text>
                <Text style={[styles.goalNums, { color: c.textSecondary }]}>{`${p.current}/${p.target}`}</Text>
              </View>
              <View style={[styles.progress, { backgroundColor: c.goalSoft }]}>
                <View style={{ width: `${p.percent}%` as `${number}%`, height: '100%', backgroundColor: c.goal, borderRadius: 4 }} />
              </View>
              <Muted>
                {[habit ? `Suivi via « ${habit.name} »` : '', ch ? `challenge ${PERIOD_UNIT.hebdo[0]} ${ch.index}/${ch.total}` : ''].filter(Boolean).join(' · ')}
              </Muted>
            </View>
          );
        })}
      </Card>

      <ReviewCard
        weekStart={monday}
        review={data.reviews[monday]}
        previous={data.reviews[addDays(monday, -7)]}
        future={future}
        onSave={(f) => run(() => saveReview(db, monday, f))}
      />

      <Card title="Tâches répétées" right={<Muted>{String(rules.length)}</Muted>}>
        {rules.length === 0 ? <Muted>Aucune tâche répétée.</Muted> : null}
        {rules.map((r, i) => (
          <View key={r.id} style={[styles.rule, i > 0 && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalTitle, { color: c.text }]}>{r.title}</Text>
              <Muted>{`↻ ${ruleLabel(r)} · ${r.start}–${r.end}`}</Muted>
            </View>
            <Button
              label={confirmStop === r.id ? 'Confirmer' : 'Arrêter'}
              variant="small"
              onPress={() =>
                confirmStop === r.id
                  ? run(async () => {
                      await stopRule(db, r.id, today);
                      setConfirmStop(null);
                    })
                  : setConfirmStop(r.id)
              }
            />
          </View>
        ))}
        {rules.length ? <Muted>« Arrêter » retire les prochaines occurrences non faites ; l'historique reste.</Muted> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3 },
  gridName: { flex: 1, fontSize: 13, paddingRight: 6 },
  gridHead: { width: 28, textAlign: 'center', fontSize: 12 },
  cellWrap: { width: 28, alignItems: 'center' },
  cell: { width: 20, height: 20, borderRadius: 6 },
  gridTotal: { width: 36, textAlign: 'right', fontSize: 12, fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', gap: 6, height: 120, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barNum: { fontSize: 10, fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, width: '100%', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barLabel: { fontSize: 11 },
  goal: { gap: 6, paddingVertical: Spacing.one },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  goalTitle: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  goalNums: { fontSize: 13, fontVariant: ['tabular-nums'] },
  progress: { height: 8, borderRadius: 4, overflow: 'hidden' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 9 },
});
