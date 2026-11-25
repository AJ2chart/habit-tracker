import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentOrNext, type Slot } from '@/logic';

/** Bandeau en haut de l'écran : ce qui se passe maintenant, ou ce qui vient ensuite. */
export function NowCard({ slots, now, onOpen, onToggle }: { slots: Slot[]; now: string; onOpen: (s: Slot) => void; onToggle: (s: Slot) => void }) {
  const c = useTheme();
  const hit = currentOrNext(slots, now);
  if (!hit) return null;
  const { slot, current } = hit;
  return (
    <View style={[styles.box, { borderColor: c.line, borderLeftColor: c.goal, backgroundColor: c.backgroundElement }]}>
      <Pressable style={styles.main} onPress={() => onOpen(slot)} accessibilityRole="button" accessibilityLabel={`${current ? 'En cours' : 'Ensuite'} : ${slot.title}, ${slot.start} à ${slot.end}`}>
        <Text style={[styles.kicker, { color: c.goal }]}>{current ? `En cours · jusqu'à ${slot.end}` : `Ensuite · ${slot.start}`}</Text>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {slot.title}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onToggle(slot)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={`Marquer ${slot.title} comme fait`}
        style={[styles.check, { borderColor: c.line }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderLeftWidth: 3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  main: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2 },
});
