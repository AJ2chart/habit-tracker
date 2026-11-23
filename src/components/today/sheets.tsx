import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, Field, Muted, Row, Sheet } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fromKey, ruleLabel, type Data, type RecurringRule, type RuleType, type Slot } from '@/logic';
import { TimeRange, shiftTime } from '@/components/time-wheel';

const DAY_CHIPS: [number, string][] = [
  [1, 'L'],
  [2, 'M'],
  [3, 'M'],
  [4, 'J'],
  [5, 'V'],
  [6, 'S'],
  [0, 'D'],
];
const REPEATS: { value: 'once' | RuleType; label: string }[] = [
  { value: 'once', label: 'Une fois' },
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekdays', label: 'En semaine' },
  { value: 'custom', label: 'Certains jours' },
];

export type NewSlot = {
  title: string;
  start: string;
  end: string;
  habitId: string | null;
  repeat: 'once' | RuleType;
  days: number[];
};

/** Ajout d'un créneau, ou modification d'une tâche répétée si `rule` est fourni. */
export function AddSlotSheet({
  visible,
  day,
  data,
  rule,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  day: string;
  data: Data;
  rule?: RecurringRule | null;
  onClose: () => void;
  onSubmit: (s: NewSlot) => void;
}) {
  const c = useTheme();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [open, setOpen] = useState<'start' | 'end' | null>(null);
  const [habitId, setHabitId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<NewSlot['repeat']>('once');
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    // Par défaut : la prochaine heure pleine (aujourd'hui) ou 09:00, pour une heure.
    const now = new Date();
    const isToday = day === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const next = isToday ? `${String(Math.min(23, now.getHours() + 1)).padStart(2, '0')}:00` : '09:00';
    setTitle(rule?.title ?? '');
    setStart(rule?.start ?? next);
    setEnd(rule?.end ?? shiftTime(next, 60));
    setOpen(null);
    setHabitId(rule?.habitId ?? null);
    setRepeat(rule?.type ?? 'once');
    setDays(rule && rule.type === 'custom' ? rule.days : [fromKey(day).getDay()]);
  }, [visible, day, rule]);

  const s = start;
  const e = end;
  const timesOk = e > s;
  const ok = title.trim().length > 0 && timesOk && (repeat !== 'custom' || days.length > 0);

  return (
    <Sheet visible={visible} onClose={onClose} title={rule ? 'Modifier la répétition' : 'Ajouter un créneau'}>
      <Field label="Intitulé" value={title} onChangeText={setTitle} placeholder="Ex. Appeler le plombier" autoFocus />
      <TimeRange
        startLabel="Début"
        endLabel="Fin"
        start={start}
        end={end}
        onStart={(v) => {
          // La fin suit le début en gardant la même durée.
          const len = Math.max(15, (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))));
          setStart(v);
          setEnd(shiftTime(v, len));
        }}
        onEnd={setEnd}
        open={open}
        setOpen={setOpen}
      />
      {!timesOk ? <Text style={{ color: c.warn, fontSize: 13 }}>La fin doit être après le début.</Text> : null}

      <Muted>Répétition</Muted>
      <View style={styles.wrap}>
        {REPEATS.filter((r) => !rule || r.value !== 'once').map((r) => (
          <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} style={styles.repeatChip} />
        ))}
      </View>
      {repeat === 'custom' ? (
        <Row>
          {DAY_CHIPS.map(([wd, l]) => (
            <Chip
              key={wd}
              label={l}
              selected={days.includes(wd)}
              style={styles.flex}
              onPress={() => setDays(days.includes(wd) ? days.filter((x) => x !== wd) : [...days, wd])}
            />
          ))}
        </Row>
      ) : null}

      {data.habits.some((h) => !h.archived) ? (
        <>
          <Muted>Lier à une habitude</Muted>
          <View style={styles.wrap}>
            <Chip label="Aucune" selected={habitId === null} onPress={() => setHabitId(null)} style={styles.repeatChip} />
            {data.habits
              .filter((h) => !h.archived)
              .map((h) => (
                <Chip key={h.id} label={h.name} selected={habitId === h.id} onPress={() => setHabitId(h.id)} style={styles.repeatChip} />
              ))}
          </View>
        </>
      ) : null}

      <Row style={{ justifyContent: 'flex-end' }}>
        <Button label="Annuler" variant="ghost" onPress={onClose} />
        <Button
          label={rule ? 'Enregistrer' : 'Ajouter'}
          disabled={!ok}
          onPress={() => onSubmit({ title: title.trim(), start: s, end: e, habitId, repeat, days })}
        />
      </Row>
      {rule ? <Muted>Les changements s'appliquent à partir d'aujourd'hui. Les jours passés, faits ou décrits restent tels quels.</Muted> : null}
    </Sheet>
  );
}

export function SlotDetailSheet({
  slot,
  data,
  onClose,
  onSaveNote,
  onDelete,
  onEditRule,
  onStopRule,
}: {
  slot: Slot | null;
  data: Data;
  onClose: () => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
  onEditRule: (rule: RecurringRule) => void;
  onStopRule: (rule: RecurringRule) => void;
}) {
  const c = useTheme();
  const [note, setNote] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => {
    setNote(slot?.note ?? '');
    setConfirmStop(false);
  }, [slot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slot) return null;
  const rule = slot.ruleId ? data.rules.find((r) => r.id === slot.ruleId) : undefined;
  const habit = slot.habitId ? data.habits.find((h) => h.id === slot.habitId) : undefined;
  const date = fromKey(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const meta = [date, `${slot.start}–${slot.end}`, rule ? `↻ ${ruleLabel(rule)}` : '', habit ? `Habitude : ${habit.name}` : '']
    .filter(Boolean)
    .join(' · ');

  const close = () => {
    if (note !== (slot.note ?? '')) onSaveNote(note);
    onClose();
  };

  return (
    <Sheet visible onClose={close} title={slot.title}>
      <Muted style={{ marginTop: -Spacing.two }}>{meta}</Muted>
      <View style={{ gap: 4 }}>
        <Muted>Description</Muted>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus={!slot.note}
          placeholder="Ce qui s'est passé, ce qu'il faut retenir, la suite à donner…"
          placeholderTextColor={c.textSecondary}
          style={[styles.note, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
        />
      </View>
      {rule && !rule.until ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Button
            label="Modifier la répétition"
            variant="small"
            onPress={() => {
              if (note !== (slot.note ?? '')) onSaveNote(note);
              onEditRule(rule);
            }}
          />
          <Button
            label={confirmStop ? 'Confirmer l\'arrêt' : 'Arrêter la répétition'}
            variant="small"
            onPress={() => (confirmStop ? onStopRule(rule) : setConfirmStop(true))}
          />
        </Row>
      ) : null}
      {confirmStop ? <Muted>Les prochaines occurrences non faites disparaissent à partir d'aujourd'hui ; l'historique reste.</Muted> : null}
      <Row style={{ justifyContent: 'space-between' }}>
        {!slot.ruleId ? <Button label="Supprimer" variant="ghost" onPress={onDelete} /> : <View />}
        <Button label="Terminé" onPress={close} />
      </Row>
    </Sheet>
  );
}

export function AddHabitSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, perWeek: number) => void;
}) {
  const [name, setName] = useState('');
  const [perWeek, setPerWeek] = useState(7);
  useEffect(() => {
    if (visible) {
      setName('');
      setPerWeek(7);
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Nouvelle habitude">
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Ex. Lecture 20 pages" autoFocus />
      <Muted>Fois par semaine</Muted>
      <Row>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip key={n} label={String(n)} selected={perWeek === n} onPress={() => setPerWeek(n)} style={styles.flex} />
        ))}
      </Row>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button label="Annuler" variant="ghost" onPress={onClose} />
        <Button label="Ajouter" disabled={!name.trim()} onPress={() => onSubmit(name.trim(), perWeek)} />
      </Row>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  repeatChip: { paddingHorizontal: 12 },
  habitRow: { borderWidth: 1, borderRadius: Radius.control + 2, padding: 10, gap: Spacing.two },
  habitName: { borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, fontWeight: '600' },
  note: { minHeight: 150, borderWidth: 1, borderRadius: Radius.control, padding: 10, fontSize: 15, textAlignVertical: 'top' },
});

/** Liste des habitudes : renommer, changer la fréquence, archiver. */
export function ManageHabitsSheet({
  visible,
  data,
  onClose,
  onUpdate,
  onArchive,
}: {
  visible: boolean;
  data: Data;
  onClose: () => void;
  onUpdate: (id: string, name: string, perWeek: number) => void;
  onArchive: (id: string) => void;
}) {
  const c = useTheme();
  const habits = data.habits.filter((h) => !h.archived);
  const [names, setNames] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setNames(Object.fromEntries(habits.map((h) => [h.id, h.name])));
      setConfirm(null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet visible={visible} onClose={onClose} title="Gérer les habitudes">
      {habits.length === 0 ? <Muted>Aucune habitude.</Muted> : null}
      {habits.map((h) => (
        <View key={h.id} style={[styles.habitRow, { borderColor: c.line }]}>
          <TextInput
            value={names[h.id] ?? h.name}
            onChangeText={(t) => setNames({ ...names, [h.id]: t })}
            onEndEditing={() => {
              const n = (names[h.id] ?? '').trim();
              if (n && n !== h.name) onUpdate(h.id, n, h.perWeek);
            }}
            accessibilityLabel="Nom de l'habitude"
            style={[styles.habitName, { color: c.text, borderColor: c.line, backgroundColor: c.background }]}
          />
          <Row>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} label={String(n)} selected={h.perWeek === n} onPress={() => onUpdate(h.id, (names[h.id] ?? h.name).trim() || h.name, n)} style={styles.flex} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>fois par semaine</Muted>
            <Button
              label={confirm === h.id ? "Confirmer l'archivage" : 'Archiver'}
              variant="small"
              onPress={() => (confirm === h.id ? onArchive(h.id) : setConfirm(h.id))}
            />
          </Row>
        </View>
      ))}
      <Muted>Une habitude archivée disparaît des écrans ; ses jours cochés restent dans l'historique et les analyses passées.</Muted>
      <Button label="Terminé" onPress={onClose} />
    </Sheet>
  );
}
