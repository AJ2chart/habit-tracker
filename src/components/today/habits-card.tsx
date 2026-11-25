import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { brokenStreaks, isChecked, streak, type Data } from '@/logic';

/** Habitudes du jour en pastilles : un toucher coche ou décoche. */
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
  // Habitudes sautées 2 jours de suite : signalées sur leur pastille plutôt que par un bandeau.
  const late = new Set(day === today ? brokenStreaks(data, today).map((h) => h.id) : []);
  const [open, setOpen] = useState(false);

  // Toutes faites : une ligne de résumé, toucher pour revoir les pastilles.
  if (habits.length > 0 && count === habits.length && !open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Habitudes toutes faites. Afficher le détail">
        <Card>
          <View style={styles.summary}>
            <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Habitudes</Text>
            <Text style={[styles.summaryText, { color: c.text }]}>{`${count}/${habits.length} ✓`}</Text>
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card
      title={habits.length ? `Habitudes · ${count}/${habits.length}` : 'Habitudes'}
      right={habits.length ? <TextButton label="Gérer" onPress={onManage} accessibilityLabel="Gérer les habitudes" /> : undefined}>
      {habits.length === 0 ? <Muted>Ajoute ta première habitude pour commencer le suivi.</Muted> : null}
      <View style={styles.wrap}>
        {habits.map((h) => {
          const on = isChecked(data, day, h.id);
          const st = day === today ? streak(data, h.id, today) : 0;
          const isLate = !on && late.has(h.id);
          return (
            <Pressable
              key={h.id}
              onPress={() => onToggle(h.id, !on)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${h.name}${st ? `, série de ${st} jours` : ''}${isLate ? ', pas faite depuis 2 jours' : ''}`}
              style={({ pressed }) => [
                styles.pill,
                { borderColor: on ? c.accent : isLate ? c.warn : c.line, backgroundColor: on ? c.accent : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={[styles.name, { color: on ? c.onAccent : c.text }]}>{on ? `✓ ${h.name}` : h.name}</Text>
              {isLate ? (
                // Petit « ! » orange : pas faite depuis 2 jours (le détail est lu par le lecteur d'écran).
                <View style={[styles.warn, { backgroundColor: c.warn }]}>
                  <Text style={[styles.warnText, { color: c.background }]}>!</Text>
                </View>
              ) : null}
              {st > 1 ? <Text style={[styles.streak, { color: on ? c.onAccent : c.textSecondary }]}>{`${st} j`}</Text> : null}
            </Pressable>
          );
        })}
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Nouvelle habitude" style={({ pressed }) => [styles.pill, styles.add, { borderColor: c.line }, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.name, { color: c.textSecondary }]}>+ Habitude</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two + 2 },
  summaryLabel: { fontSize: 13 },
  summaryText: { fontSize: 15, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  add: { borderStyle: 'dashed' },
  name: { fontSize: 14, fontWeight: '500' },
  streak: { fontSize: 12, opacity: 0.8 },
  warn: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  warnText: { fontSize: 11, fontWeight: '800', lineHeight: 13 },
});
