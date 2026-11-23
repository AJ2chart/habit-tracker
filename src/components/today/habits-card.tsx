import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isChecked, streak, type Data } from '@/logic';

export function HabitsCard({
  data,
  day,
  today,
  onToggle,
  onAdd,
  onManage,
}: {
  data: Data;
  day: string;
  today: string;
  onToggle: (habitId: string, on: boolean) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const c = useTheme();
  const habits = data.habits.filter((h) => !h.archived);
  const count = habits.filter((h) => isChecked(data, day, h.id)).length;

  return (
    <Card title="Habitudes" right={<Muted>{`${count}/${habits.length}`}</Muted>}>
      {habits.length === 0 ? <Muted>Aucune habitude pour l'instant. Ajoute la première pour commencer le suivi.</Muted> : null}
      <View style={styles.grid}>
        {habits.map((h) => {
          const on = isChecked(data, day, h.id);
          const st = day === today ? streak(data, h.id, today) : 0;
          return (
            <Pressable
              key={h.id}
              onPress={() => onToggle(h.id, !on)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.habit,
                { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={[styles.name, { color: c.text }]}>{h.name}</Text>
              <Text style={[styles.sub, { color: c.textSecondary }]}>
                {`${h.perWeek}×/sem${st ? ` · série de ${st} j` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button label="+ Nouvelle habitude" variant="small" onPress={onAdd} />
        {habits.length ? <Button label="Gérer" variant="small" onPress={onManage} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  habit: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: Radius.control + 2, padding: 10, gap: 3 },
  name: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12 },
});
