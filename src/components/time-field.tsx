import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidTime, normalizeTime } from '@/logic';

const pad = (n: number) => String(n).padStart(2, '0');
/** Pas des boutons −/+, en minutes. */
const STEP = 15;
/** Délai avant la répétition quand on garde le doigt sur −/+, puis intervalle entre deux pas. */
const HOLD_DELAY = 400;
const REPEAT_EVERY = 110;

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

/** Pas suivant : on se cale d'abord sur un multiple du pas (23:20 + → 23:30), puis on avance du pas. */
function stepTime(value: string, dir: 1 | -1, step = STEP): string {
  const [h, m] = splitTime(value);
  const t = h * 60 + m;
  const snapped = dir > 0 ? Math.floor(t / step) * step + step : Math.ceil(t / step) * step - step;
  return shiftTime('00:00', snapped);
}

/** Nombre maximal de pas d'affilée en gardant le doigt appuyé (10 h) : filet de sécurité. */
const MAX_REPEAT = 40;

/**
 * Bouton −/+ : un appui = un pas ; garder le doigt dessus fait défiler.
 * Une seule boucle à la fois, arrêtée au relâcher, à l'interruption du geste,
 * au démontage, et dans tous les cas au bout de MAX_REPEAT pas.
 */
function StepButton({ dir, label, onStep }: { dir: 1 | -1; label: string; onStep: (dir: 1 | -1) => void }) {
  const c = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Numéro du geste en cours : une boucle d'un ancien geste s'arrête d'elle-même. */
  const gesture = useRef(0);
  const latest = useRef(onStep);
  latest.current = onStep;

  const stop = useRef(() => {
    gesture.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }).current;
  useEffect(() => stop, [stop]);

  const start = () => {
    stop();
    const id = gesture.current;
    let count = 0;
    latest.current(dir);
    const tick = () => {
      if (gesture.current !== id || ++count > MAX_REPEAT) return stop();
      latest.current(dir);
      timer.current = setTimeout(tick, REPEAT_EVERY);
    };
    timer.current = setTimeout(tick, HOLD_DELAY);
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      onBlur={stop}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement }]}>
      <Text style={[styles.stepText, { color: c.text }]}>{dir > 0 ? '+' : '−'}</Text>
    </Pressable>
  );
}

/**
 * Champ d'heure : −/+ par pas de 15 min (garder le doigt pour défiler),
 * toucher l'heure pour la taper directement au clavier.
 */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const latest = useRef(value);
  latest.current = value;

  const step = (dir: 1 | -1) => {
    // Utiliser −/+ quitte la saisie au clavier.
    if (typing) {
      setTyping(false);
      Keyboard.dismiss();
    }
    const next = stepTime(latest.current, dir);
    latest.current = next;
    onChange(next);
  };

  const commit = () => {
    const parsed = normalizeTime(text);
    if (isValidTime(parsed) && parsed !== value) onChange(parsed);
    setTyping(false);
  };

  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <View style={[styles.field, { backgroundColor: c.background, borderColor: typing ? c.text : c.line, borderWidth: typing ? 2 : 1 }]}>
        <StepButton dir={-1} label={`${label} : 15 minutes plus tôt`} onStep={step} />
        {typing ? (
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            maxLength={5}
            placeholder={value}
            placeholderTextColor={c.textSecondary}
            accessibilityLabel={`${label}, tape l'heure`}
            style={[styles.time, styles.input, { color: c.text }]}
          />
        ) : (
          <Pressable
            onPress={() => {
              setText('');
              setTyping(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${value}`}
            accessibilityHint="Touche pour taper l'heure"
            style={styles.timeBox}>
            <Text style={[styles.time, { color: c.text }]}>{value}</Text>
          </Pressable>
        )}
        <StepButton dir={1} label={`${label} : 15 minutes plus tard`} onStep={step} />
      </View>
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
  field: { borderRadius: Radius.control, padding: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 38, height: 38, borderRadius: Radius.control - 2, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '500', lineHeight: 26 },
  timeBox: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 38 },
  time: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center' },
  input: { flex: 1, height: 38, padding: 0 },
});
