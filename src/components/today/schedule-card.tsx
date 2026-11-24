import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortSlots, type Data, type Slot } from '@/logic';
import { nowHM } from '@/logic/time';

/** Emploi du temps du jour : une ligne par créneau, l'heure, le titre, la coche. */
export function ScheduleCard({
  data,
  day,
  isToday,
  onToggle,
  onOpen,
  onAdd,
  validated,
  onValidate,
}: {
  data: Data;
  day: string;
  isToday: boolean;
  onToggle: (slot: Slot) => void;
  onOpen: (slot: Slot) => void;
  onAdd: () => void;
  /** Planning du jour validé (routine du matin) */
  validated: boolean;
  /** Absent : pas de bouton de validation (journée passée) */
  onValidate?: (on: boolean) => void;
}) {
  const c = useTheme();
  const slots = sortSlots(data.slots[day] ?? []);
  const done = slots.filter((s) => s.done).length;
  const now = nowHM();
  const nowIndex = isToday ? slots.findIndex((s) => s.start > now) : -2;
  const [open, setOpen] = useState(false);
  const nowLine = <View style={[styles.now, { backgroundColor: c.goal }]} accessibilityLabel="Maintenant" />;

  // Tout est fait : une ligne de résumé, toucher pour revoir le détail.
  if (slots.length > 0 && done === slots.length && !open && (!onValidate || validated)) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Emploi du temps terminé. Afficher le détail">
        <Card>
          <View style={styles.summary}>
            <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Emploi du temps</Text>
            <Text style={[styles.summaryText, { color: c.text }]}>{`${done}/${slots.length} ✓`}</Text>
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card title={slots.length ? `Emploi du temps · ${done}/${slots.length}` : 'Emploi du temps'} right={<TextButton label="+ Ajouter" onPress={onAdd} accessibilityLabel="Ajouter un créneau" />}>
      {slots.length === 0 ? <Muted>Rien de prévu.</Muted> : null}
      {slots.map((s, i) => {
        const habit = s.habitId ? data.habits.find((h) => h.id === s.habitId) : undefined;
        return (
          <View key={s.id}>
            {i === nowIndex ? nowLine : null}
            <View style={styles.slot}>
              <Text style={[styles.time, { color: c.textSecondary }]}>{s.start}</Text>
              <Pressable style={styles.main} onPress={() => onOpen(s)} accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.start} à ${s.end}. Ouvrir`}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: s.done ? c.textSecondary : c.text, textDecorationLine: s.done ? 'line-through' : 'none' }]}>
                  {s.title}
                  {s.ruleId ? <Text style={{ color: c.textSecondary }}>{'  ↻'}</Text> : null}
                </Text>
                {s.note || habit ? (
                  <Text numberOfLines={1} style={[styles.meta, { color: c.textSecondary }]}>
                    {[habit?.name, s.note].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => onToggle(s)}
                hitSlop={10}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`Marquer ${s.title} comme fait`}
                style={[styles.check, { borderColor: s.done ? c.accent : c.line, backgroundColor: s.done ? c.accent : 'transparent' }]}>
                {s.done ? <Text style={[styles.checkMark, { color: c.onAccent }]}>✓</Text> : null}
              </Pressable>
            </View>
          </View>
        );
      })}
      {isToday && nowIndex === -1 && slots.length > 0 ? nowLine : null}
      {onValidate ? (
        validated ? (
          <View style={styles.validated}>
            <Muted>Journée validée ✓</Muted>
            <TextButton label="Annuler" onPress={() => onValidate(false)} accessibilityLabel="Annuler la validation de la journée" />
          </View>
        ) : (
          <Button label="Valider ma journée" variant="small" onPress={() => onValidate(true)} />
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, paddingVertical: 6 },
  time: { width: 44, fontSize: 14, fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 1 },
  title: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 13 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 14, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two + 2 },
  summaryLabel: { fontSize: 13 },
  summaryText: { fontSize: 15, fontWeight: '600' },
  validated: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  now: { height: 2, borderRadius: 2, marginVertical: 2 },
});
