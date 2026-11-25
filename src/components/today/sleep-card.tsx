import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TimeRange } from '@/components/time-field';
import { Button, Card, Chip, Row, TextButton } from '@/components/ui';
import { MoodColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, sleepMinutes, type SleepEntry } from '@/logic';

export const SleepQualityLabels = ['Très mauvaise', 'Mauvaise', 'Moyenne', 'Bonne', 'Excellente'] as const;

type Draft = { bed: string; wake: string; quality: number | null; awakenings: number | null };

/**
 * Nuit rattachée au jour du réveil. Une ligne de résumé une fois saisie
 * (toucher pour modifier), sinon un formulaire court aux heures pré-remplies.
 */
export function SleepCard({
  day,
  isToday,
  entry,
  previous,
  onSave,
  onDelete,
}: {
  day: string;
  isToday: boolean;
  entry: SleepEntry | undefined;
  /** Dernière nuit notée avant ce jour : ses heures sont proposées par défaut. */
  previous: SleepEntry | undefined;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const [editing, setEditing] = useState(!entry);
  const [bed, setBed] = useState(entry?.bed ?? previous?.bed ?? '23:00');
  const [wake, setWake] = useState(entry?.wake ?? previous?.wake ?? '07:00');
  const [quality, setQuality] = useState<number | null>(entry?.quality ?? null);
  const [awakenings, setAwakenings] = useState<number | null>(entry?.awakenings ?? null);

  useEffect(() => {
    setEditing(!entry);
    setBed(entry?.bed ?? previous?.bed ?? '23:00');
    setWake(entry?.wake ?? previous?.wake ?? '07:00');
    setQuality(entry?.quality ?? null);
    setAwakenings(entry?.awakenings ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, !!entry]);

  const duration = sleepMinutes(bed, wake);
  const plausible = duration >= 60 && duration <= 16 * 60;
  const title = isToday ? 'Nuit dernière' : 'Nuit';

  if (entry && !editing) {
    return (
      <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Modifier la nuit">
        <Card>
          <View style={styles.summary}>
            <Text style={[styles.label, { color: c.textSecondary }]}>{title}</Text>
            <Text style={[styles.big, { color: c.text }]}>{formatDuration(sleepMinutes(entry.bed, entry.wake))}</Text>
            <Text style={[styles.times, { color: c.textSecondary }]}>{`${entry.bed} → ${entry.wake}`}</Text>
            <View style={{ flex: 1 }} />
            {entry.quality != null ? <View style={[styles.dot, { backgroundColor: MoodColors[entry.quality], alignSelf: 'center' }]} /> : null}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card title={title} right={plausible ? <Text style={{ color: c.text, fontWeight: '600' }}>{formatDuration(duration)}</Text> : undefined}>
      <TimeRange startLabel="Coucher" endLabel="Lever" start={bed} end={wake} onStart={setBed} onEnd={setWake} />
      {!plausible ? <Text style={{ color: c.warn, fontSize: 13 }}>Durée inhabituelle : vérifie les heures.</Text> : null}
      <Text style={[styles.label, { color: c.textSecondary }]}>Qualité</Text>
      <Row>
        {SleepQualityLabels.map((l, i) => (
          <Chip key={l} label={l} selected={quality === i} onPress={() => setQuality(quality === i ? null : i)} style={{ flex: 1 }}>
            <View style={[styles.dot, { backgroundColor: MoodColors[i] }]} />
          </Chip>
        ))}
      </Row>
      <Text style={[styles.label, { color: c.textSecondary }]}>Réveils dans la nuit</Text>
      <Row>
        {[0, 1, 2, 3].map((n) => (
          <Chip key={n} label={n === 3 ? '3+' : String(n)} selected={awakenings === n} onPress={() => setAwakenings(awakenings === n ? null : n)} style={{ flex: 1 }} />
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        {entry ? <TextButton label="Effacer" onPress={onDelete} /> : <View />}
        <Row style={{ gap: Spacing.three }}>
          {entry ? <TextButton label="Annuler" onPress={() => setEditing(false)} /> : null}
          <Button
            label="Enregistrer"
            disabled={!plausible}
            onPress={() => {
              onSave({ bed, wake, quality, awakenings });
              setEditing(false);
            }}
            style={{ paddingVertical: 9 }}
          />
        </Row>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two + 2 },
  label: { fontSize: 13 },
  big: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  times: { fontSize: 14, fontVariant: ['tabular-nums'] },
  dot: { width: 12, height: 12, borderRadius: 6 },
  small: { width: 44, paddingVertical: 6 },
});
