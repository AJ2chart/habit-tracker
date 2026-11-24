import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MorningItem } from '@/logic';

/**
 * Routine du matin : ce qui reste à cocher. Les habitudes se cochent ici ;
 * les autres étapes se font dans leur carte (nuit, humeur, emploi du temps).
 * Affichée seulement tant que la routine n'est pas finie.
 */
export function RoutineCard({ items, onToggleHabit }: { items: MorningItem[]; onToggleHabit: (habitId: string, on: boolean) => void }) {
  const c = useTheme();
  const done = items.filter((i) => i.done).length;
  return (
    <Card title={`Routine du matin · ${done}/${items.length}`}>
      <View style={styles.list}>
        {items.map((i) => {
          const mark = (
            <View style={[styles.check, { borderColor: i.done ? c.accent : c.line, backgroundColor: i.done ? c.accent : 'transparent' }]}>
              {i.done ? <Text style={[styles.checkMark, { color: c.onAccent }]}>✓</Text> : null}
            </View>
          );
          const text = (
            <Text style={[styles.label, { color: i.done ? c.textSecondary : c.text, textDecorationLine: i.done ? 'line-through' : 'none' }]} numberOfLines={1}>
              {i.label}
            </Text>
          );
          return i.habitId ? (
            <Pressable
              key={i.key}
              onPress={() => onToggleHabit(i.habitId!, !i.done)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: i.done }}
              accessibilityLabel={i.label}
              style={styles.item}>
              {mark}
              {text}
            </Pressable>
          ) : (
            <View key={i.key} style={styles.item} accessible accessibilityLabel={`${i.label} : ${i.done ? 'fait' : 'à faire'}`}>
              {mark}
              {text}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 15 },
});
