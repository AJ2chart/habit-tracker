import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Chip } from '@/components/ui';
import { EnergyLabels, MoodColors, MoodLabels, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Energy, Mood, MorningEntry } from '@/logic';

type Entry = { mood: Mood | null; energy: Energy | null; text: string };

/**
 * Journal du jour. Humeur et énergie s'enregistrent au toucher ;
 * la note s'enregistre 0,6 s après la dernière frappe et en quittant le champ.
 */
export function JournalCard({
  day,
  entry,
  onSave,
  title = 'Journal',
  placeholder = 'Une note sur ta journée… #étiquettes',
}: {
  day: string;
  entry: Entry | undefined;
  onSave: (e: Entry) => void;
  title?: string;
  placeholder?: string;
}) {
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
    <Card title={title}>
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
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={`${title} : note`}
        style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
      />
    </Card>
  );
}

/**
 * Humeur du matin : le journal en version courte. Une ligne de résumé une fois notée
 * (toucher pour modifier), sinon humeur, énergie et une note facultative.
 */
export function MorningMoodCard({ day, entry, onSave }: { day: string; entry: MorningEntry | undefined; onSave: (e: { mood: Mood | null; energy: Energy | null; note: string }) => void }) {
  const c = useTheme();
  const [editing, setEditing] = useState(entry?.mood == null);
  useEffect(() => {
    setEditing(entry?.mood == null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  if (entry && entry.mood != null && !editing) {
    return (
      <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Modifier l'humeur du matin">
        <Card>
          <View style={styles.summary}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Ce matin</Text>
            <View style={[styles.dot, { backgroundColor: MoodColors[entry.mood], alignSelf: 'center' }]} />
            <Text style={[styles.summaryText, { color: c.text }]}>{MoodLabels[entry.mood]}</Text>
            {entry.energy != null ? <Text style={[styles.summaryText, { color: c.textSecondary }]}>{`· énergie ${EnergyLabels[entry.energy].toLowerCase()}`}</Text> : null}
            {entry.note ? (
              <Text numberOfLines={1} style={[styles.summaryText, { color: c.textSecondary, flex: 1 }]}>{`· ${entry.note}`}</Text>
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <JournalCard
      day={day}
      title="Ce matin"
      placeholder="Une intention pour la journée… (facultatif)"
      entry={entry ? { mood: entry.mood, energy: entry.energy, text: entry.note } : undefined}
      onSave={(e) => onSave({ mood: e.mood, energy: e.energy, note: e.text })}
    />
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  summaryText: { fontSize: 15 },
  row: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  batt: { width: 22, height: 10, borderWidth: 1.5, borderRadius: 3, padding: 1 },
  label: { fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
});
