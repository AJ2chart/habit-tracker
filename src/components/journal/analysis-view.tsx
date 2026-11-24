import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted } from '@/components/ui';
import { EnergyLabels, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { computeDayShift, computeInsights, dayShiftReadiness, formatDuration, insightReadiness, insightTips, type Data } from '@/logic';

const WD_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/** Deux barres : jours difficiles (rouge) contre bons jours (vert). */
function Compare({ label, bad, good, badText, goodText }: { label: string; bad: number; good: number; badText: string; goodText: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.compareHead}>
        <Text style={[styles.compareLabel, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.compareNums, { color: c.textSecondary }]}>
          <Text style={{ color: c.warn }}>{badText}</Text>
          {'  ·  '}
          <Text style={{ color: '#2C7A68' }}>{goodText}</Text>
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
        <View style={{ width: `${Math.max(2, Math.min(100, bad))}%` as `${number}%`, height: '100%', backgroundColor: c.warn, borderRadius: 3 }} />
      </View>
      <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
        <View style={{ width: `${Math.max(2, Math.min(100, good))}%` as `${number}%`, height: '100%', backgroundColor: '#2C7A68', borderRadius: 3 }} />
      </View>
    </View>
  );
}

/** Matin → soir : comment l'humeur évolue dans la journée, et ce qui accompagne les baisses. */
function DayShiftCard({ data, today }: { data: Data; today: string }) {
  const c = useTheme();
  const shift = computeDayShift(data, today);
  if (!shift) {
    const n = dayShiftReadiness(data, today);
    // Rien à montrer tant que l'humeur du matin n'est pas utilisée.
    if (!Object.keys(data.morning).length) return null;
    return (
      <Card title="Matin → soir">
        <Muted>{`Note ton humeur le matin et le soir pour voir comment tes journées la font évoluer. Il faut 5 jours notés les deux fois ; pour l'instant : ${n}.`}</Muted>
      </Card>
    );
  }
  const total = shift.days;
  const seg = (n: number, color: string) => (n ? <View style={{ flex: n, backgroundColor: color }} /> : null);
  const avg = shift.average;
  const trend =
    Math.abs(avg) < 0.25
      ? 'En moyenne, ton humeur reste stable entre le matin et le soir.'
      : avg < 0
        ? "En moyenne, ton humeur baisse au fil de la journée."
        : "En moyenne, ton humeur monte au fil de la journée.";
  return (
    <Card title="Matin → soir">
      <Muted>{`${total} jours notés matin et soir · ${trend}`}</Muted>
      <View style={[styles.split, { backgroundColor: c.backgroundSelected }]}>
        {seg(shift.drops, c.warn)}
        {seg(shift.stable, c.textSecondary)}
        {seg(shift.rises, '#2C7A68')}
      </View>
      <Text style={[styles.compareNums, { color: c.textSecondary }]}>
        <Text style={{ color: c.warn }}>{`${shift.drops} en baisse`}</Text>
        {`  ·  ${shift.stable} stables  ·  `}
        <Text style={{ color: '#2C7A68' }}>{`${shift.rises} en hausse`}</Text>
      </Text>
      {shift.causes.length ? (
        <>
          <Muted>Ce qui accompagne les journées en baisse (causes probables, pas certaines)</Muted>
          {shift.causes.map((cause, i) => (
            <View key={i} style={styles.tip}>
              <Text style={[styles.tipNum, { color: c.warn }]}>•</Text>
              <Text style={[styles.tipText, { color: c.text }]}>{cause.text}</Text>
            </View>
          ))}
        </>
      ) : shift.drops >= 2 ? (
        <Muted>Pas de point commun net entre les journées en baisse pour l'instant. Des #étiquettes dans la note du soir aideront à les repérer.</Muted>
      ) : null}
    </Card>
  );
}

/** Analyse des 30 derniers jours : ce qui distingue les jours difficiles des bons jours. */
export function AnalysisView({ data, today, onTag }: { data: Data; today: string; onTag: (tag: string) => void }) {
  const c = useTheme();
  const ins = computeInsights(data, today);

  if (!ins) {
    const r = insightReadiness(data, today);
    return (
      <>
      <DayShiftCard data={data} today={today} />
      <Card title="Pas encore assez de données">
        <Muted>
          {`L'analyse compare tes jours difficiles et tes bons jours sur les 30 derniers jours. Il faut au moins 2 jours de chaque. Pour l'instant : ${r.bad} difficile${r.bad > 1 ? 's' : ''}, ${r.good} bon${r.good > 1 ? 's' : ''}, sur ${r.noted} jour${r.noted > 1 ? 's' : ''} noté${r.noted > 1 ? 's' : ''}. Continue à noter ton humeur chaque jour.`}
        </Muted>
      </Card>
      </>
    );
  }

  const tips = insightTips(ins, data);
  const maxRate = Math.max(...ins.weekdays.map((w) => (w.total ? w.bad / w.total : 0)), 0.01);

  return (
    <>
      <Muted style={{ textAlign: 'center' }}>{`30 derniers jours · ${ins.badDays} difficiles · ${ins.goodDays} bons`}</Muted>

      {tips.length ? (
        <Card title="Pistes">
          {tips.map((t, i) => (
            <View key={i} style={styles.tip}>
              <Text style={[styles.tipNum, { color: c.goal }]}>{i + 1}</Text>
              <Text style={[styles.tipText, { color: c.text }]}>{t}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <DayShiftCard data={data} today={today} />

      {ins.habits.length || ins.slots ? (
        <Card title="Habitudes et emploi du temps">
          {ins.habits.map((h) => (
            <Compare key={h.habitId} label={h.name} bad={h.bad} good={h.good} badText={`${h.bad} %`} goodText={`${h.good} %`} />
          ))}
          {ins.slots ? <Compare label="Emploi du temps respecté" bad={ins.slots.bad} good={ins.slots.good} badText={`${ins.slots.bad} %`} goodText={`${ins.slots.good} %`} /> : null}
        </Card>
      ) : null}

      {ins.sleep || ins.energy ? (
        <Card title="Sommeil et énergie">
          {ins.sleep ? (
            <Compare
              label="Nuit précédente"
              bad={(ins.sleep.badMinutes / 600) * 100}
              good={(ins.sleep.goodMinutes / 600) * 100}
              badText={formatDuration(ins.sleep.badMinutes)}
              goodText={formatDuration(ins.sleep.goodMinutes)}
            />
          ) : null}
          {ins.energy ? (
            <Compare
              label="Énergie"
              bad={((ins.energy.bad + 1) / 5) * 100}
              good={((ins.energy.good + 1) / 5) * 100}
              badText={EnergyLabels[Math.round(ins.energy.bad)]}
              goodText={EnergyLabels[Math.round(ins.energy.good)]}
            />
          ) : null}
        </Card>
      ) : null}

      <Card title="Jours difficiles par jour de la semaine">
        <View style={styles.bars}>
          {ins.weekdays.map((w) => {
            const rate = w.total ? w.bad / w.total : 0;
            return (
              <View key={w.weekday} style={styles.barCol}>
                <Text style={[styles.barNum, { color: c.textSecondary }]}>{w.bad ? String(w.bad) : ''}</Text>
                <View style={[styles.barTrack, { backgroundColor: c.backgroundSelected }]}>
                  <View style={{ height: `${Math.round((rate / maxRate) * 100)}%` as `${number}%`, backgroundColor: c.warn, borderRadius: 4 }} />
                </View>
                <Text style={[styles.barLabel, { color: c.textSecondary }]}>{WD_SHORT[w.weekday]}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {ins.badTags.length || ins.goodTags.length ? (
        <Card title="Étiquettes">
          {ins.badTags.length ? (
            <View style={styles.tagRow}>
              <Muted>Jours difficiles</Muted>
              {ins.badTags.map((t) => (
                <Pressable key={t.tag} onPress={() => onTag(t.tag)} accessibilityRole="button" style={[styles.tag, { borderColor: c.warn }]}>
                  <Text style={{ color: c.warn, fontSize: 13, fontWeight: '500' }}>{`#${t.tag} · ${t.count}`}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {ins.goodTags.length ? (
            <View style={styles.tagRow}>
              <Muted>Bons jours</Muted>
              {ins.goodTags.map((t) => (
                <Pressable key={t.tag} onPress={() => onTag(t.tag)} accessibilityRole="button" style={[styles.tag, { borderColor: c.line }]}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{`#${t.tag} · ${t.count}`}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  tip: { flexDirection: 'row', gap: Spacing.two },
  tipNum: { fontSize: 15, fontWeight: '700', width: 16 },
  tipText: { flex: 1, fontSize: 15, lineHeight: 21 },
  split: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  compareHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  compareLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  compareNums: { fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bars: { flexDirection: 'row', gap: 6, height: 90, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barNum: { fontSize: 11, fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, width: '100%', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barLabel: { fontSize: 11 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
