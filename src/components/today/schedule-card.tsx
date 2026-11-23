import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ruleLabel, sortSlots, type Data, type Slot } from '@/logic';
import { nowHM } from '@/logic/time';

export function ScheduleCard({
  data,
  day,
  isToday,
  onToggle,
  onOpen,
  onAdd,
}: {
  data: Data;
  day: string;
  isToday: boolean;
  onToggle: (slot: Slot) => void;
  onOpen: (slot: Slot) => void;
  onAdd: () => void;
}) {
  const c = useTheme();
  const slots = sortSlots(data.slots[day] ?? []);
  const done = slots.filter((s) => s.done).length;
  const now = nowHM();
  const nowIndex = isToday ? slots.findIndex((s) => s.start > now) : -2;

  const nowLine = <View key="now" style={[styles.now, { backgroundColor: c.goal }]} accessibilityLabel="Maintenant" />;

  return (
    <Card title="Emploi du temps" right={<Muted>{`${done}/${slots.length} faits`}</Muted>}>
      {slots.length === 0 ? <Muted>Aucun créneau prévu ce jour.</Muted> : null}
      {slots.map((s, i) => {
        const habit = s.habitId ? data.habits.find((h) => h.id === s.habitId) : undefined;
        const rule = s.ruleId ? data.rules.find((r) => r.id === s.ruleId) : undefined;
        return (
          <View key={s.id}>
            {i === nowIndex ? nowLine : null}
            <View style={[styles.slot, i > 0 && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.time, { color: c.textSecondary }]}>
                {s.start}
                {'\n'}
                {s.end}
              </Text>
              <Pressable
                style={styles.main}
                onPress={() => onOpen(s)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${s.title} pour écrire une description`}>
                <Text
                  style={[
                    styles.title,
                    { color: s.done ? c.textSecondary : c.text, textDecorationLine: s.done ? 'line-through' : 'none' },
                  ]}>
                  {s.title}
                  {habit ? <Text style={[styles.tag, { color: c.textSecondary }]}>{`  · ${habit.name}`}</Text> : null}
                </Text>
                {rule ? <Text style={[styles.meta, { color: c.textSecondary }]}>{`↻ ${ruleLabel(rule)}`}</Text> : null}
                {s.note ? (
                  <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={2}>
                    {s.note}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => onToggle(s)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`Marquer ${s.title} comme fait`}
                style={[
                  styles.check,
                  { borderColor: s.done ? c.accent : c.line, backgroundColor: s.done ? c.accent : 'transparent' },
                ]}>
                {s.done ? <Text style={[styles.checkMark, { color: c.onAccent }]}>✓</Text> : null}
              </Pressable>
            </View>
          </View>
        );
      })}
      {isToday && nowIndex === -1 && slots.length > 0 ? nowLine : null}
      <Button label="+ Ajouter un créneau" variant="ghost" onPress={onAdd} style={{ marginTop: Spacing.two }} />
      <Muted style={{ textAlign: 'center' }}>Touche une activité pour lui ajouter une description.</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, paddingVertical: 9 },
  time: { width: 46, fontSize: 13, lineHeight: 16, fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500' },
  tag: { fontSize: 13, fontWeight: '400' },
  meta: { fontSize: 13, lineHeight: 17 },
  check: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 15, fontWeight: '700' },
  now: { height: 2, borderRadius: 2, marginVertical: 2 },
});
