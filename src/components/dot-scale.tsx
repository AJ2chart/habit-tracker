import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Échelle de 5 pastilles de couleur (humeur, qualité de sommeil) : un toucher suffit,
 * le libellé du choix s'affiche à droite du titre.
 */
export function DotScale({
  title,
  labels,
  colors,
  value,
  onChange,
}: {
  title: string;
  labels: readonly string[];
  colors: readonly string[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.textSecondary }]}>{title}</Text>
        <Text style={[styles.value, { color: value != null ? c.text : c.textSecondary }]}>{value != null ? labels[value] : '—'}</Text>
      </View>
      <View style={styles.row}>
        {labels.map((l, i) => {
          const on = value === i;
          return (
            <Pressable
              key={l}
              onPress={() => onChange(on ? null : i)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${title} : ${l}`}
              style={[styles.ring, { borderColor: on ? c.text : 'transparent' }]}>
              <View style={[styles.dot, { backgroundColor: colors[i], opacity: value == null || on ? 1 : 0.35 }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Même principe pour l'énergie : 5 batteries de plus en plus pleines. */
export function BatteryScale({ title, labels, value, onChange }: { title: string; labels: readonly string[]; value: number | null; onChange: (v: number | null) => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.textSecondary }]}>{title}</Text>
        <Text style={[styles.value, { color: value != null ? c.text : c.textSecondary }]}>{value != null ? labels[value] : '—'}</Text>
      </View>
      <View style={styles.row}>
        {labels.map((l, i) => {
          const on = value === i;
          return (
            <Pressable
              key={l}
              onPress={() => onChange(on ? null : i)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${title} : ${l}`}
              style={[styles.ring, { borderColor: on ? c.text : 'transparent' }]}>
              <View style={[styles.batt, { borderColor: c.text, opacity: value == null || on ? 1 : 0.35 }]}>
                <View style={{ width: `${(i + 1) * 20}%` as `${number}%`, height: '100%', backgroundColor: c.text, borderRadius: 1 }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 32, height: 32, borderRadius: 16 },
  batt: { width: 30, height: 15, borderWidth: 1.5, borderRadius: 4, padding: 2 },
});
