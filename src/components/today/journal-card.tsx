import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Chip } from '@/components/ui';
import { EnergyLabels, MoodColors, MoodLabels, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Energy, JournalEntry, Mood } from '@/logic';

type Entry = { mood: Mood | null; energy: Energy | null; text: string };

/**
 * Journal du jour. Humeur et énergie s'enregistrent au toucher ;
 * la note s'enregistre 0,6 s après la dernière frappe et en quittant le champ.
 */
export function JournalCard({ day, entry, onSave }: { day: string; entry: JournalEntry | undefined; onSave: (e: Entry) => void }) {
  const c = useTheme();
  const [text, setText] = useState(entry?.text ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mood = entry?.mood ?? null;
  const energy = entry?.energy ?? null;

  // Recharge la note quand on change de jour, sans écraser une saisie en cours.
  useEffect(() => {
    setText(entry?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flush = (t: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (t !== (entry?.text ?? '')) onSave({ mood, energy, text: t });
  };

  return (
    <Card title="Journal">
      <View style={styles.row} accessibilityLabel="Humeur">
        {MoodLabels.map((l, i) => (
          <Chip key={l} label={l} selected={mood === i} style={styles.flex} onPress={() => onSave({ mood: mood === i ? null : (i as Mood), energy, text })}>
            <View style={[styles.dot, { backgroundColor: MoodColors[i] }]} />
          </Chip>
        ))}
      </View>
      <Text style={[styles.label, { color: c.textSecondary }]}>Énergie</Text>
      <View style={styles.row} accessibilityLabel="Énergie">
        {EnergyLabels.map((l, i) => (
          <Chip key={l} label={l} selected={energy === i} style={styles.flex} onPress={() => onSave({ mood, energy: energy === i ? null : (i as Energy), text })}>
            <View style={[styles.batt, { borderColor: c.textSecondary }]}>
              <View style={{ width: `${(i + 1) * 20}%` as `${number}%`, height: '100%', backgroundColor: c.text, borderRadius: 1 }} />
            </View>
          </Chip>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => flush(t), 600);
        }}
        onBlur={() => flush(text)}
        multiline
        placeholder="Une note sur ta journée… #étiquettes"
        placeholderTextColor={c.textSecondary}
        accessibilityLabel="Note du jour"
        style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  batt: { width: 22, height: 10, borderWidth: 1.5, borderRadius: 3, padding: 1 },
  label: { fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
});
