import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChallengeSheet, type Reflection } from '@/components/goals/challenge-sheet';
import { GoalSheet } from '@/components/goals/goal-sheet';
import { shiftTime } from '@/components/time-field';
import { Button, Card, Muted, Screen, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addGoal, addRule, archiveGoal, incrementGoal, updateGoal } from '@/db/actions';
import { loadSettings, saveSettings } from '@/db/settings';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import {
  LEVEL_LABELS,
  PERIOD_UNIT,
  challengeReview,
  challengeStep,
  goalFromAction,
  goalProgress,
  isActiveAt,
  isChallengeEnded,
  type ChallengeAction,
  type Data,
  type Goal,
  type Level,
} from '@/logic';
import { useOnChange } from '@/hooks/use-on-change';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

function ProgressBar({ percent }: { percent: number }) {
  const c = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: c.goalSoft }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View style={[styles.fill, { width: `${percent}%` as `${number}%`, backgroundColor: c.goal }]} />
    </View>
  );
}

function GoalRow({
  goal,
  data,
  today,
  depth,
  onEdit,
  onIncrement,
}: {
  goal: Goal;
  data: Data;
  today: string;
  depth: number;
  onEdit: (g: Goal) => void;
  onIncrement: (g: Goal) => void;
}) {
  const c = useTheme();
  const p = goalProgress(data, goal, today);
  const habit = goal.habitId ? data.habits.find((h) => h.id === goal.habitId) : undefined;
  const kids = data.goals.filter((g) => g.parentId === goal.id && isActiveAt(g, today));
  const ch = challengeStep(goal, today);
  const unit = PERIOD_UNIT[goal.level][0];

  return (
    <View style={depth ? [styles.child, { borderLeftColor: c.line }] : undefined}>
      <Pressable onPress={() => onEdit(goal)} accessibilityRole="button" accessibilityLabel={`Modifier ${goal.title}`} style={styles.goal}>
        <Text style={[styles.level, { color: c.goal }]}>
          {LEVEL_LABELS[goal.level].toUpperCase()}
          {ch ? `  ·  CHALLENGE ${unit.toUpperCase()} ${ch.index}/${ch.total}` : ''}
        </Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text, fontWeight: depth ? '500' : '600' }]}>{goal.title}</Text>
          <View style={styles.right}>
            <Text style={[styles.nums, { color: c.textSecondary }]}>{`${fmt(p.current)}/${fmt(p.target)} ${p.unit}`}</Text>
            {goal.kind === 'manual' && p.current < p.target ? (
              <Button label={`+${fmt(goal.step ?? 1)}`} variant="small" onPress={() => onIncrement(goal)} />
            ) : null}
          </View>
        </View>
        <ProgressBar percent={p.percent} />
        {habit ? <Muted>{`Calculé depuis l'habitude « ${habit.name} »`}</Muted> : null}
      </Pressable>
      {kids.map((k) => (
        <GoalRow key={k.id} goal={k} data={data} today={today} depth={depth + 1} onEdit={onEdit} onIncrement={onIncrement} />
      ))}
    </View>
  );
}

export default function GoalsScreen() {
  const c = useTheme();
  const { db, data, today, reload } = useAppData();
  const [sheet, setSheet] = useState<{ goal?: Goal; level?: Level; parentId?: string | null } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // ?review=<id> : ouvert depuis l'alerte de fin de challenge d'Aujourd'hui.
  const params = useLocalSearchParams<{ review?: string; t?: string }>();
  useOnChange(`${params.review ?? ''}|${params.t ?? ''}`, () => {
    if (params.review) setReviewId(params.review);
  });
  useEffect(() => {
    void loadSettings(db).then(setSettings);
  }, [db, data]);

  if (!data) return <Screen title="Objectifs" subtitle="Chargement…" />;

  const run = async (fn: () => Promise<unknown>) => {
    await fn();
    await reload();
  };

  const active = data.goals.filter((g) => isActiveAt(g, today));
  const activeIds = new Set(active.map((g) => g.id));
  // Racines : objectifs sans parent, ou dont le parent n'est plus actif.
  const roots = active.filter((g) => !g.parentId || !activeIds.has(g.parentId));
  const order: Record<Level, number> = { annuel: 0, mensuel: 1, hebdo: 2 };
  roots.sort((a, b) => order[a.level] - order[b.level]);

  const ended = data.goals.filter((g) => isChallengeEnded(g, today)).sort((a, b) => b.endDate!.localeCompare(a.endDate!));
  const reviewGoal = reviewId ? data.goals.find((g) => g.id === reviewId) : undefined;
  const review = reviewGoal ? challengeReview(data, reviewGoal, today) : null;
  const reflectionKey = (id: string) => `challenge_${id}`;
  const readReflection = (id: string): Reflection | null => {
    try {
      return settings[reflectionKey(id)] ? (JSON.parse(settings[reflectionKey(id)]) as Reflection) : null;
    } catch {
      return null;
    }
  };

  const applyAction = (goal: Goal, a: ChallengeAction) =>
    run(async () => {
      if (a.type === 'slot') {
        const habit = data.habits.find((h) => h.id === goal.habitId);
        const existing = data.rules.find((r) => r.habitId === goal.habitId);
        const start = existing?.start ?? '08:00';
        await addRule(db, { title: habit?.name ?? goal.title, start, end: existing?.end ?? shiftTime(start, 30), habitId: goal.habitId ?? null, type: 'custom', days: [a.weekday], from: today });
      } else await addGoal(db, goalFromAction(goal, a, today));
    });

  return (
    <>
      <Screen title="Objectifs" subtitle="Année · mois · semaine">
        <Button label="+ Nouvel objectif" variant="ghost" onPress={() => setSheet({})} />
        {roots.length === 0 ? (
          <Muted style={{ textAlign: 'center' }}>Commence par un objectif annuel, puis découpe-le en mois et en semaines.</Muted>
        ) : null}
        {roots.map((g) => (
          <Card key={g.id}>
            <GoalRow
              goal={g}
              data={data}
              today={today}
              depth={0}
              onEdit={(goal) => setSheet({ goal })}
              onIncrement={(goal) => run(() => incrementGoal(db, goal.id))}
            />
            {g.level !== 'hebdo' ? (
              <Button
                label={`+ Sous-objectif ${g.level === 'annuel' ? 'mensuel' : 'hebdomadaire'}`}
                variant="small"
                onPress={() => setSheet({ level: g.level === 'annuel' ? 'mensuel' : 'hebdo', parentId: g.id })}
                style={{ marginTop: Spacing.one }}
              />
            ) : null}
          </Card>
        ))}

        {ended.length ? (
          <Card title="Challenges terminés">
            {ended.map((g) => {
              const r = challengeReview(data, g, today);
              return (
                <View key={g.id} style={styles.endedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.endedTitle, { color: c.text }]} numberOfLines={1}>
                      {g.title}
                    </Text>
                    {r ? <Muted>{`${r.succeeded}/${r.total} ${r.total > 1 ? r.unit[1] : r.unit[0]} réussie${r.succeeded > 1 ? 's' : ''} · ${r.rate} %`}</Muted> : null}
                  </View>
                  <TextButton label="Bilan" onPress={() => setReviewId(g.id)} accessibilityLabel={`Voir le bilan de ${g.title}`} />
                </View>
              );
            })}
          </Card>
        ) : null}
      </Screen>

      <ChallengeSheet
        review={review}
        reflection={reviewGoal ? readReflection(reviewGoal.id) : null}
        onClose={() => {
          if (reviewGoal && !settings[reflectionKey(reviewGoal.id)]) void saveSettings(db, { [reflectionKey(reviewGoal.id)]: JSON.stringify({ helped: '', hindered: '' }) }).then(reload);
          setReviewId(null);
        }}
        onSaveReflection={(r) => reviewGoal && void saveSettings(db, { [reflectionKey(reviewGoal.id)]: JSON.stringify(r) }).then(reload)}
        onAction={(a) => reviewGoal && void applyAction(reviewGoal, a)}
        onArchive={() =>
          reviewGoal &&
          void run(async () => {
            await archiveGoal(db, reviewGoal.id);
            setReviewId(null);
          })
        }
      />

      <GoalSheet
        visible={!!sheet}
        data={data}
        today={today}
        goal={sheet?.goal ?? null}
        defaultLevel={sheet?.level}
        defaultParentId={sheet?.parentId}
        onClose={() => setSheet(null)}
        onCreate={(g) =>
          run(async () => {
            await addGoal(db, g);
            setSheet(null);
          })
        }
        onUpdate={(id, g) =>
          run(async () => {
            await updateGoal(db, id, g);
            setSheet(null);
          })
        }
        onArchive={(id) =>
          run(async () => {
            await archiveGoal(db, id);
            setSheet(null);
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  goal: { gap: 6, paddingVertical: Spacing.two },
  level: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { flex: 1, fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nums: { fontSize: 13, fontVariant: ['tabular-nums'] },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  endedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  endedTitle: { fontSize: 15, fontWeight: '500' },
  child: { marginLeft: Spacing.three, paddingLeft: Spacing.three - 4, borderLeftWidth: 2 },
});
