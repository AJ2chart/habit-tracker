import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ITEM = 40;
const VISIBLE = 5;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

/** Sépare "HH:MM" ; les minutes sont arrondies au pas de 5. */
export function splitTime(value: string): [number, number] {
  const h = Math.min(23, Math.max(0, Number(value.slice(0, 2)) || 0));
  const m = Math.round((Number(value.slice(3, 5)) || 0) / 5) * 5;
  return m === 60 ? [(h + 1) % 24, 0] : [h, m];
}

/** Ajoute des minutes à "HH:MM", en restant dans la journée (23:30 + 60 → 00:30). */
export function shiftTime(value: string, minutes: number): string {
  const [h, m] = splitTime(value);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

function Column({ values, selected, onSelect, label }: { values: number[]; selected: number; onSelect: (v: number) => void; label: string }) {
  const c = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(selected));

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (values[i] !== selected) onSelect(values[i]);
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.column}
      contentContainerStyle={{ paddingVertical: ITEM * Math.floor(VISIBLE / 2) }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      nestedScrollEnabled
      onLayout={() => ref.current?.scrollTo({ y: index * ITEM, animated: false })}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={(e) => {
        // Sans élan (glissé lent), Android n'envoie pas de fin d'élan : on se cale ici.
        if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.1) settle(e);
      }}
      accessibilityLabel={label}>
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => {
            ref.current?.scrollTo({ y: values.indexOf(v) * ITEM, animated: true });
            onSelect(v);
          }}
          style={styles.item}
          accessibilityRole="button"
          accessibilityState={{ selected: v === selected }}>
          <Text style={[styles.itemText, { color: v === selected ? c.text : c.textSecondary, fontWeight: v === selected ? '700' : '400' }]}>{pad(v)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Roue heures / minutes (pas de 5 min), sans dépendance native. */
export function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  const [h, m] = splitTime(value);
  return (
    <View style={[styles.wheel, { backgroundColor: c.background, borderColor: c.line }]}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: c.backgroundSelected }]} />
      <Column label="Heures" values={HOURS} selected={h} onSelect={(nh) => onChange(`${pad(nh)}:${pad(m)}`)} />
      <Text style={[styles.colon, { color: c.text }]}>:</Text>
      <Column label="Minutes" values={MINUTES} selected={m} onSelect={(nm) => onChange(`${pad(h)}:${pad(nm)}`)} />
    </View>
  );
}

/** Champ d'heure : affiche la valeur, s'ouvre en roue au toucher. */
export function TimeField({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value}. Toucher pour changer`}
        style={[styles.field, { backgroundColor: c.background, borderColor: active ? c.text : c.line, borderWidth: active ? 2 : 1 }]}>
        <Text style={[styles.fieldText, { color: c.text }]}>{value}</Text>
      </Pressable>
    </View>
  );
}

/** Deux champs d'heure côte à côte, avec une seule roue ouverte à la fois sous les champs. */
export function TimeRange({
  startLabel,
  endLabel,
  start,
  end,
  onStart,
  onEnd,
  open,
  setOpen,
}: {
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  open: 'start' | 'end' | null;
  setOpen: (o: 'start' | 'end' | null) => void;
}) {
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <TimeField label={startLabel} value={start} active={open === 'start'} onPress={() => setOpen(open === 'start' ? null : 'start')} />
        <TimeField label={endLabel} value={end} active={open === 'end'} onPress={() => setOpen(open === 'end' ? null : 'end')} />
      </View>
      {open === 'start' ? <TimeWheel key="start" value={start} onChange={onStart} /> : null}
      {open === 'end' ? <TimeWheel key="end" value={end} onChange={onEnd} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM * VISIBLE, borderWidth: 1, borderRadius: Radius.control, overflow: 'hidden' },
  band: { position: 'absolute', left: 8, right: 8, top: ITEM * Math.floor(VISIBLE / 2), height: ITEM, borderRadius: 8 },
  column: { width: 72, height: ITEM * VISIBLE, flexGrow: 0 },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 22, fontVariant: ['tabular-nums'] },
  colon: { fontSize: 22, fontWeight: '700', paddingHorizontal: 4 },
  field: { borderRadius: Radius.control, paddingVertical: 10, alignItems: 'center' },
  fieldText: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
