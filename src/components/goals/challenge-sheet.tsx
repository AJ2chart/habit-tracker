import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Muted, Row, Sheet, TextButton } from '@/components/ui';
import { EnergyLabels, MoodLabels, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, type ChallengeAction, type ChallengeReview } from '@/logic';
import { useOnChange } from '@/hooks/use-on-change';

export type Reflection = { helped: string; hindered: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.section, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ label, missed, done }: { label: string; missed: string; done: string }) {
  const c = useTheme();
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.lineVal, { color: c.warn }]}>{missed}</Text>
      <Text style={[styles.lineVal, { color: c.text }]}>{done}</Text>
    </View>
  );
}

/** Bilan d'un challenge terminé : chiffres, ce qui change les jours manqués, axes d'amélioration, ressenti. */
export function ChallengeSheet({
  review,
  reflection,
  onClose,
  onSaveReflection,
  onAction,
  onArchive,
}: {
  review: ChallengeReview | null;
  reflection: Reflection | null;
  onClose: () => void;
  onSaveReflection: (r: Reflection) => void;
  onAction: (a: ChallengeAction) => void;
  onArchive: () => void;
}) {
  const c = useTheme();
  const [helped, setHelped] = useState('');
  const [hindered, setHindered] = useState('');
  const [applied, setApplied] = useState<number[]>([]);
  useOnChange(review?.goal.id, () => {
    setHelped(reflection?.helped ?? '');
    setHindered(reflection?.hindered ?? '');
    setApplied([]);
  });

  if (!review) return null;
  const r = review;
  const [one, many] = r.unit;
  const close = () => {
    if (helped !== (reflection?.helped ?? '') || hindered !== (reflection?.hindered ?? '')) onSaveReflection({ helped, hindered });
    onClose();
  };
  const trendText =
    r.trend === 'ancrage' ? 'De mieux en mieux au fil du challenge : ça s’est ancré.' : r.trend === 'essoufflement' ? 'Plus difficile en fin de challenge : ça s’est essoufflé.' : 'Un rythme assez constant du début à la fin.';
  const m = r.missedVsDone;

  return (
    <Sheet visible onClose={close} title={`Bilan · ${r.goal.title}`}>
      <View style={{ gap: 4 }}>
        <Text style={[styles.big, { color: c.text }]}>{`${r.succeeded}/${r.total} ${r.total > 1 ? many : one} réussie${r.succeeded > 1 ? 's' : ''}`}</Text>
        <Muted>
          {[`${r.rate} %`, r.bestRun > 1 ? `meilleure série : ${r.bestRun} ${many} d’affilée` : '', r.previousRate != null ? `challenge précédent : ${r.previousRate} %` : '']
            .filter(Boolean)
            .join(' · ')}
        </Muted>
      </View>

      <View style={styles.periods} accessibilityLabel={`Périodes : ${r.periods.map((p) => (p.success ? 'réussie' : 'manquée')).join(', ')}`}>
        {r.periods.map((p, i) => (
          <View key={p.start} style={styles.periodCol}>
            <View style={[styles.periodBar, { backgroundColor: p.success ? '#2C7A68' : c.warn, height: 12 + Math.min(1, p.count / Math.max(1, r.goal.target)) * 36 }]} />
            <Text style={[styles.periodNum, { color: c.textSecondary }]}>{i + 1}</Text>
          </View>
        ))}
      </View>
      <Muted>{trendText}</Muted>

      {m || r.missedTags.length || r.worstWeekday ? (
        <Section title="Les jours manqués">
          {m ? (
            <View style={{ gap: 2 }}>
              <View style={styles.line}>
                <Text style={[styles.lineLabel, { color: c.textSecondary }]} />
                <Text style={[styles.lineHead, { color: c.warn }]}>manqués</Text>
                <Text style={[styles.lineHead, { color: c.textSecondary }]}>faits</Text>
              </View>
              {m.mood ? <Line label="Humeur" missed={MoodLabels[Math.round(m.mood[0])]} done={MoodLabels[Math.round(m.mood[1])]} /> : null}
              {m.energy ? <Line label="Énergie" missed={EnergyLabels[Math.round(m.energy[0])]} done={EnergyLabels[Math.round(m.energy[1])]} /> : null}
              {m.sleep ? <Line label="Nuit" missed={formatDuration(m.sleep[0])} done={formatDuration(m.sleep[1])} /> : null}
              <Line label="Jours difficiles" missed={`${m.badShare[0]} %`} done={`${m.badShare[1]} %`} />
            </View>
          ) : null}
          {r.missedTags.length ? <Muted>{`Étiquettes fréquentes : ${r.missedTags.map((t) => `#${t.tag}`).join(', ')}`}</Muted> : null}
        </Section>
      ) : null}

      {r.suggestions.length ? (
        <Section title="Axes d’amélioration">
          {r.suggestions.map((s, i) => (
            <View key={i} style={[styles.suggestion, { borderColor: c.line }]}>
              <Text style={[styles.sugText, { color: c.text }]}>{s.text}</Text>
              {s.action ? (
                applied.includes(i) ? (
                  <Muted>Appliqué ✓</Muted>
                ) : (
                  <TextButton
                    label={s.actionLabel ?? 'Appliquer'}
                    onPress={() => {
                      onAction(s.action!);
                      setApplied([...applied, i]);
                    }}
                  />
                )
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Ton ressenti">
        <TextInput
          value={helped}
          onChangeText={setHelped}
          multiline
          placeholder="Qu’est-ce qui t’a aidé ?"
          placeholderTextColor={c.textSecondary}
          style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
        />
        <TextInput
          value={hindered}
          onChangeText={setHindered}
          multiline
          placeholder="Qu’est-ce qui t’a freiné ?"
          placeholderTextColor={c.textSecondary}
          style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
        />
      </Section>

      <Row style={{ justifyContent: 'space-between' }}>
        <TextButton label="Archiver le challenge" onPress={onArchive} />
        <Button label="Terminé" onPress={close} />
      </Row>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 24, fontWeight: '700' },
  section: { fontSize: 15, fontWeight: '600', marginTop: Spacing.one },
  periods: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64 },
  periodCol: { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' },
  periodBar: { width: '100%', borderRadius: 4 },
  periodNum: { fontSize: 10, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  lineLabel: { flex: 1, fontSize: 14 },
  lineHead: { width: 92, textAlign: 'right', fontSize: 12 },
  lineVal: { width: 92, textAlign: 'right', fontSize: 14, fontWeight: '500' },
  suggestion: { borderWidth: 1, borderRadius: Radius.control, padding: 12, gap: 8 },
  sugText: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
});
