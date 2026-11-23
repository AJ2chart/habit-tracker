import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TimeRange } from '@/components/time-wheel';
import { Button, Card, Chip, Muted, Row } from '@/components/ui';
import { MoodColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDuration, fromKey, sleepMinutes, type SleepEntry } from '@/logic';

export const SleepQualityLabels = ['Très mauvaise', 'Mauvaise', 'Moyenne', 'Bonne', 'Excellente'] as const;
const AWAKENINGS = [0, 1, 2, 3];

type Draft = { bed: string; wake: string; quality: number | null; awakenings: number | null };

/**
 * Nuit rattachée au jour du réveil. Affichée en résumé une fois saisie ;
 * toucher le résumé permet de la modifier.
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
  const [open, setOpen] = useState<'start' | 'end' | null>(null);
  const [quality, setQuality] = useState<number | null>(entry?.quality ?? null);
  const [awakenings, setAwakenings] = useState<number | null>(entry?.awakenings ?? null);

  useEffect(() => {
    setEditing(!entry);
    setBed(entry?.bed ?? previous?.bed ?? '23:00');
    setWake(entry?.wake ?? previous?.wake ?? '07:00');
    setOpen(null);
    setQuality(entry?.quality ?? null);
    setAwakenings(entry?.awakenings ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, !!entry]);

  const duration = sleepMinutes(bed, wake);
  const plausible = duration >= 60 && duration <= 16 * 60;

  const short = (k: string) => fromKey(k).toLocaleDateString('fr-FR', { weekday: 'long' });
  const title = isToday ? 'Nuit dernière' : `Nuit du ${short(addDays(day, -1))} au ${short(day)}`;

  if (entry && !editing) {
    const d = sleepMinutes(entry.bed, entry.wake);
    return (
      <Card title={title} right={<Button label="Modifier" variant="small" onPress={() => setEditing(true)} />}>
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Modifier la nuit" style={styles.summary}>
          <Text style={[styles.big, { color: c.text }]}>{formatDuration(d)}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.meta, { color: c.text }]}>{`${entry.bed} → ${entry.wake}`}</Text>
            <View style={styles.qualityRow}>
              {entry.quality != null ? <View style={[styles.dot, { backgroundColor: MoodColors[entry.quality] }]} /> : null}
              <Muted>
                {[
                  entry.quality != null ? `Sommeil ${SleepQualityLabels[entry.quality].toLowerCase()}` : '',
                  entry.awakenings != null ? `${entry.awakenings >= 3 ? '3 réveils ou plus' : `${entry.awakenings} réveil${entry.awakenings > 1 ? 's' : ''}`}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Muted>
            </View>
          </View>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card title={title} right={plausible ? <Muted>{formatDuration(duration)}</Muted> : undefined}>
      <TimeRange startLabel="Coucher" endLabel="Lever" start={bed} end={wake} onStart={setBed} onEnd={setWake} open={open} setOpen={setOpen} />
      {!entry && previous && !open ? <Muted>Heures de ta dernière nuit notée : touche-les pour les changer.</Muted> : null}
      {!plausible ? <Text style={{ color: c.warn, fontSize: 13 }}>Durée inhabituelle : vérifie les heures.</Text> : null}

      <Muted>Qualité ressentie</Muted>
      <Row>
        {SleepQualityLabels.map((l, i) => (
          <Chip key={l} label={l.replace('Très mauvaise', 'Très mauv.')} selected={quality === i} onPress={() => setQuality(quality === i ? null : i)} style={styles.flex}>
            <View style={[styles.dot, { backgroundColor: MoodColors[i] }]} />
          </Chip>
        ))}
      </Row>

      <Muted>Réveils dans la nuit (facultatif)</Muted>
      <Row>
        {AWAKENINGS.map((n) => (
          <Chip key={n} label={n === 3 ? '3 et +' : String(n)} selected={awakenings === n} onPress={() => setAwakenings(awakenings === n ? null : n)} style={styles.flex} />
        ))}
      </Row>

      <Row style={{ justifyContent: entry ? 'space-between' : 'flex-end' }}>
        {entry ? <Button label="Effacer" variant="ghost" onPress={onDelete} /> : null}
        <Row>
          {entry ? <Button label="Annuler" variant="ghost" onPress={() => setEditing(false)} /> : null}
          <Button
            label="Enregistrer"
            disabled={!plausible}
            onPress={() => {
              onSave({ bed, wake, quality, awakenings });
              setEditing(false);
            }}
          />
        </Row>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  big: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  meta: { fontSize: 15, fontVariant: ['tabular-nums'] },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
