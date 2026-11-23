import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Muted, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ruleLabel, type RecurringRule } from '@/logic';

/** Tâches répétées en cours, avec arrêt (confirmé) : les jours passés restent dans l'historique. */
export function RulesCard({ rules, onStop }: { rules: RecurringRule[]; onStop: (id: string) => void }) {
  const c = useTheme();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!rules.length) return null;
  return (
    <Card title={`Tâches répétées · ${rules.length}`}>
      {rules.map((r, i) => (
        <View key={r.id} style={[styles.row, i > 0 && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>{r.title}</Text>
            <Muted>{`${ruleLabel(r)} · ${r.start}–${r.end}`}</Muted>
          </View>
          <TextButton
            label={confirm === r.id ? 'Confirmer' : 'Arrêter'}
            onPress={() => (confirm === r.id ? (onStop(r.id), setConfirm(null)) : setConfirm(r.id))}
            accessibilityLabel={`Arrêter la répétition de ${r.title}`}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8 },
  title: { fontSize: 15, fontWeight: '500' },
});
