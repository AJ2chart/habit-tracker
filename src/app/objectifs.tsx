import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GoalSheet } from '@/components/goals/goal-sheet';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { addGoal, archiveGoal, incrementGoal, updateGoal } from '@/db/actions';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { LEVEL_LABELS, PERIOD_UNIT, challengeStep, goalProgress, isActiveAt, type Data, type Goal, type Level } from '@/logic';

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
  const { db, data, today, reload } = useAppData();
  const [sheet, setSheet] = useState<{ goal?: Goal; level?: Level; parentId?: string | null } | null>(null);

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
      </Screen>

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
  child: { marginLeft: Spacing.three, paddingLeft: Spacing.three - 4, borderLeftWidth: 2 },
});
