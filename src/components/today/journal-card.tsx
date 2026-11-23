import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { BatteryScale, DotScale } from '@/components/dot-scale';
import { Card } from '@/components/ui';
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
      <DotScale title="Humeur" labels={MoodLabels} colors={MoodColors} value={mood} onChange={(v) => onSave({ mood: v as Mood | null, energy, text })} />
      <BatteryScale title="Énergie" labels={EnergyLabels} value={energy} onChange={(v) => onSave({ mood, energy: v as Energy | null, text })} />
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
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
});
