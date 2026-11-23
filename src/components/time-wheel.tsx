import { useContext, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { ScrollLockContext } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const pad = (n: number) => String(n).padStart(2, '0');
/** Distance de glissé (px) pour avancer de 5 minutes. */
const STEP_PX = 9;

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

/**
 * Champ d'heure à maintenir : on pose le doigt, on glisse vers le haut (plus tard)
 * ou vers le bas (plus tôt), par pas de 5 minutes ; la roue disparaît au relâcher.
 */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  const lockScroll = useContext(ScrollLockContext);
  const [active, setActive] = useState(false);
  const [hint, setHint] = useState(false);
  const base = useRef(value);
  const current = useRef(value);
  const moved = useRef(false);
  const latest = useRef({ value, onChange, lockScroll });
  latest.current = { value, onChange, lockScroll };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        base.current = latest.current.value;
        current.current = latest.current.value;
        moved.current = false;
        latest.current.lockScroll(true);
        setHint(false);
        setActive(true);
      },
      onPanResponderMove: (_e, g) => {
        const steps = Math.round(-g.dy / STEP_PX);
        if (steps !== 0) moved.current = true;
        const next = shiftTime(base.current, steps * 5);
        if (next !== current.current) {
          current.current = next;
          latest.current.onChange(next);
        }
      },
      onPanResponderRelease: () => {
        latest.current.lockScroll(false);
        setActive(false);
        if (!moved.current) {
          setHint(true);
          setTimeout(() => setHint(false), 2200);
        }
      },
      onPanResponderTerminate: () => {
        latest.current.lockScroll(false);
        setActive(false);
      },
    }),
  ).current;

  const around = [-10, -5, 0, 5, 10].map((d) => shiftTime(value, d));

  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label} : ${value}`}
        accessibilityHint="Maintiens et fais glisser vers le haut ou le bas pour changer l'heure"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(shiftTime(value, e.nativeEvent.actionName === 'increment' ? 5 : -5))}
        style={[styles.field, { backgroundColor: c.background, borderColor: active ? c.text : c.line, borderWidth: active ? 2 : 1 }]}>
        <Text style={[styles.fieldText, { color: c.text }]}>{value}</Text>
        <Text style={[styles.arrows, { color: c.textSecondary }]}>⇅</Text>
      </View>
      {active ? (
        // Roue flottante, visible seulement pendant le geste.
        <View pointerEvents="none" style={[styles.wheel, { backgroundColor: c.backgroundElement, borderColor: c.line }]}>
          {around.map((t, i) => (
            <Text
              key={i}
              style={[
                styles.wheelItem,
                i === 2
                  ? { color: c.text, fontSize: 24, fontWeight: '700', backgroundColor: c.backgroundSelected }
                  : { color: c.textSecondary, opacity: i === 0 || i === 4 ? 0.45 : 0.8 },
              ]}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
      {hint ? <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center' }}>Maintiens et glisse ↑↓</Text> : null}
    </View>
  );
}

/** Deux champs d'heure côte à côte. */
export function TimeRange({
  startLabel,
  endLabel,
  start,
  end,
  onStart,
  onEnd,
}: {
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
      <TimeField label={startLabel} value={start} onChange={onStart} />
      <TimeField label={endLabel} value={end} onChange={onEnd} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { borderRadius: Radius.control, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fieldText: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  arrows: { fontSize: 14 },
  wheel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 50,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingVertical: 6,
    elevation: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  wheelItem: { textAlign: 'center', fontSize: 17, paddingVertical: 4, fontVariant: ['tabular-nums'], marginHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
});
