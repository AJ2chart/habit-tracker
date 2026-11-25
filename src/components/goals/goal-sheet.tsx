import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field, Muted, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LEVEL_LABELS, PARENT_LEVEL, PERIOD_UNIT, challengeEnd, isActiveAt, periodStartFor, type Data, type Goal, type Level } from '@/logic';
import { useOnChange } from '@/hooks/use-on-change';

const PRESETS: Record<Level, number[]> = { hebdo: [4, 8, 12], mensuel: [1, 3, 6], annuel: [] };

export type GoalDraft = Omit<Goal, 'id'>;

const LEVELS: Level[] = ['annuel', 'mensuel', 'hebdo'];
const num = (s: string) => Number(s.replace(',', '.'));

/** Création (goal absent) ou modification d'un objectif. */
export function GoalSheet({
  visible,
  data,
  today,
  goal,
  defaultLevel,
  defaultParentId,
  onClose,
  onCreate,
  onUpdate,
  onArchive,
}: {
  visible: boolean;
  data: Data;
  today: string;
  goal?: Goal | null;
  defaultLevel?: Level;
  defaultParentId?: string | null;
  onClose: () => void;
  onCreate: (g: GoalDraft) => void;
  onUpdate: (id: string, g: { title: string; target: number; current?: number; unit?: string; step?: number; parentId: string | null }) => void;
  onArchive: (id: string) => void;
}) {
  const c = useTheme();
  const editing = !!goal;
  const [level, setLevel] = useState<Level>('annuel');
  const [parentId, setParentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Goal['kind']>('manual');
  const [habitId, setHabitId] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [unit, setUnit] = useState('');
  const [step, setStep] = useState('1');
  const [confirm, setConfirm] = useState(false);
  /** Nombre de périodes du challenge ; 0 = sans limite */
  const [duration, setDuration] = useState(0);
  const [customDuration, setCustomDuration] = useState('');

  // Feuille ouverte (ou autre objectif) : repart des valeurs de l'objectif. Un simple rechargement
  // des données pendant la saisie ne remet rien à zéro.
  useOnChange(visible ? `${goal?.id ?? 'nouveau'}|${defaultLevel ?? ''}|${defaultParentId ?? ''}` : null, () => {
    if (!visible) return;
    setLevel(goal?.level ?? defaultLevel ?? 'annuel');
    setParentId(goal ? goal.parentId : defaultParentId ?? null);
    setTitle(goal?.title ?? '');
    setKind(goal?.kind ?? 'manual');
    setHabitId(goal?.habitId ?? null);
    setTarget(goal ? String(goal.target) : '');
    setCurrent(String(goal?.current ?? 0));
    setUnit(goal?.unit ?? '');
    setStep(String(goal?.step ?? 1));
    setConfirm(false);
    setDuration(0);
    setCustomDuration('');
  });

  const habits = data.habits.filter((h) => !h.archived);
  const parentLevel = PARENT_LEVEL[level];
  const parents = parentLevel ? data.goals.filter((g) => g.level === parentLevel && isActiveAt(g, today) && g.id !== goal?.id) : [];
  const t = num(target);
  const custom = Math.floor(num(customDuration));
  const periods = customDuration ? custom : duration;
  const durationOk = !customDuration || (custom >= 1 && custom <= 520);
  const ok = title.trim() !== '' && t > 0 && (kind === 'manual' || !!habitId) && (kind === 'habit' || num(step) > 0) && durationOk;
  const [one, many] = PERIOD_UNIT[level];

  const period = (() => {
    const p = periodStartFor(level, today);
    const d = new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1, Number(p.slice(8)));
    if (level === 'annuel') return `l'année ${p.slice(0, 4)}`;
    if (level === 'mensuel') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `la semaine du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  })();

  const submit = () => {
    if (editing && goal) {
      onUpdate(goal.id, {
        title: title.trim(),
        target: t,
        parentId,
        ...(goal.kind === 'manual' ? { current: Math.max(0, num(current) || 0), unit: unit.trim(), step: num(step) || 1 } : {}),
      });
    } else {
      onCreate({
        level,
        parentId,
        title: title.trim(),
        kind,
        habitId: kind === 'habit' ? habitId : null,
        current: 0,
        target: t,
        unit: kind === 'manual' ? unit.trim() : '',
        step: kind === 'manual' ? num(step) || 1 : 1,
        periodStart: periodStartFor(level, today),
        endDate: kind === 'habit' && periods > 0 ? challengeEnd(level, periodStartFor(level, today), periods) : null,
      });
    }
  };

  const periodWord = level === 'hebdo' ? 'semaine' : level === 'mensuel' ? 'mois' : 'année';
  const habitName = habits.find((h) => h.id === habitId)?.name;
  const summary = (() => {
    if (!title.trim() && !t) return null;
    if (kind === 'habit') {
      if (!habitName || !t) return null;
      const dur = periods > 0 ? `, pendant ${periods} ${periods > 1 ? many : one}` : ', sans limite de durée';
      return `Cocher « ${habitName} » ${fmt(t)} fois par ${periodWord}${editing ? '' : dur}.`;
    }
    if (!t) return null;
    const u = unit.trim() ? ` ${unit.trim()}` : '';
    return `Atteindre ${fmt(t)}${u} sur ${period}, en ajoutant ${fmt(num(step) || 1)}${u} à chaque appui sur +.`;
  })();

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? "Modifier l'objectif" : 'Nouvel objectif'}>
      {!editing ? (
        <>
          <Question n={1} label="Sur quelle période ?" />
          <Row>
            {LEVELS.map((l) => (
              <Chip
                key={l}
                label={l === 'annuel' ? 'Cette année' : l === 'mensuel' ? 'Ce mois' : 'Cette semaine'}
                selected={level === l}
                style={styles.flex}
                onPress={() => {
                  setLevel(l);
                  setParentId(null);
                }}
              />
            ))}
          </Row>
        </>
      ) : (
        <Muted>{`${LEVEL_LABELS[level]} · ${kind === 'habit' ? 'mesuré par une habitude' : 'compté à la main'}`}</Muted>
      )}

      {!editing ? <Question n={2} label="Quel est ton objectif ?" /> : null}
      <Field
        label={editing ? 'Intitulé' : 'En quelques mots'}
        value={title}
        onChangeText={setTitle}
        placeholder={level === 'annuel' ? 'Ex. Lire 24 livres' : level === 'mensuel' ? 'Ex. Courir 50 km' : 'Ex. Méditer régulièrement'}
        autoFocus={!editing}
      />

      {!editing ? (
        <>
          <Question n={3} label="Comment mesurer l'avancement ?" />
          <Option
            selected={kind === 'manual'}
            title="Je compte moi-même"
            text="Tu ajoutes ta progression à la main, avec un bouton +. Pour ce qui se compte : livres lus, km courus, euros épargnés…"
            onPress={() => setKind('manual')}
          />
          <Option
            selected={kind === 'habit'}
            title="Avec une de mes habitudes"
            text="Chaque jour où tu coches l'habitude compte automatiquement. Pour la régularité : méditer, faire du sport…"
            onPress={() => setKind('habit')}
          />
        </>
      ) : null}

      {kind === 'habit' ? (
        <>
          {!editing ? (
            <>
              <Question n={4} label="Quelle habitude ?" />
              {habits.length ? (
                <View style={styles.wrap}>
                  {habits.map((h) => (
                    <Chip key={h.id} label={h.name} selected={habitId === h.id} onPress={() => setHabitId(h.id)} style={styles.pad} />
                  ))}
                </View>
              ) : (
                <Text style={{ color: c.warn, fontSize: 13 }}>Crée d’abord une habitude dans l’onglet Aujourd’hui.</Text>
              )}
            </>
          ) : null}
          {!editing ? <Question n={5} label={`Combien de fois par ${periodWord} ?`} /> : null}
          <Field label={editing ? `Nombre de fois par ${periodWord}` : 'Nombre de jours cochés à viser'} value={target} onChangeText={setTarget} keyboardType="number-pad" placeholder="Ex. 5" />
        </>
      ) : (
        <>
          {!editing ? <Question n={4} label="Quel total viser ?" /> : null}
          <Row>
            <View style={styles.flex}>
              <Field label="Total" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Ex. 24" />
            </View>
            <View style={styles.flex}>
              <Field label="Unité (facultatif)" value={unit} onChangeText={setUnit} placeholder="Ex. livres" />
            </View>
          </Row>
          <Row>
            <View style={styles.flex}>
              <Field label="Chaque appui sur + ajoute" value={step} onChangeText={setStep} keyboardType="decimal-pad" />
            </View>
            {editing ? (
              <View style={styles.flex}>
                <Field label="Déjà fait" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" />
              </View>
            ) : (
              <View style={styles.flex} />
            )}
          </Row>
        </>
      )}

      {kind === 'habit' && !editing && level !== 'annuel' ? (
        <>
          <Question n={6} label="Pendant combien de temps ?" />
          <View style={styles.wrap}>
            <Chip
              label="Sans limite"
              selected={!customDuration && duration === 0}
              onPress={() => {
                setDuration(0);
                setCustomDuration('');
              }}
              style={styles.pad}
            />
            {PRESETS[level].map((n) => (
              <Chip
                key={n}
                label={`${n} ${n > 1 ? many : one}`}
                selected={!customDuration && duration === n}
                onPress={() => {
                  setDuration(n);
                  setCustomDuration('');
                }}
                style={styles.pad}
              />
            ))}
          </View>
          <Field label={`Ou un nombre de ${many} au choix`} value={customDuration} onChangeText={setCustomDuration} keyboardType="number-pad" placeholder="Ex. 6" />
        </>
      ) : null}

      {parentLevel && parents.length ? (
        <>
          <Muted>{`Fait partie d'un objectif ${parentLevel === 'annuel' ? 'de l\'année' : 'du mois'} ? (facultatif)`}</Muted>
          <View style={styles.wrap}>
            <Chip label="Non" selected={parentId === null} onPress={() => setParentId(null)} style={styles.pad} />
            {parents.map((p) => (
              <Chip key={p.id} label={p.title} selected={parentId === p.id} onPress={() => setParentId(p.id)} style={styles.pad} />
            ))}
          </View>
        </>
      ) : null}

      {summary ? (
        <View style={[styles.summary, { backgroundColor: c.goalSoft }]}>
          <Text style={[styles.summaryText, { color: c.text }]}>{summary}</Text>
        </View>
      ) : null}

      <Row style={{ justifyContent: editing ? 'space-between' : 'flex-end' }}>
        {editing && goal ? (
          <Button label={confirm ? "Confirmer l'archivage" : 'Archiver'} variant="ghost" onPress={() => (confirm ? onArchive(goal.id) : setConfirm(true))} />
        ) : (
          <Button label="Annuler" variant="ghost" onPress={onClose} />
        )}
        <Button label={editing ? 'Enregistrer' : 'Créer'} disabled={!ok} onPress={submit} />
      </Row>
    </Sheet>
  );
}

function Question({ n, label }: { n: number; label: string }) {
  const c = useTheme();
  return <Text style={[styles.question, { color: c.text }]}>{`${n}. ${label}`}</Text>;
}

function Option({ selected, title, text, onPress }: { selected: boolean; title: string; text: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        { borderColor: selected ? c.text : c.line, backgroundColor: selected ? c.backgroundSelected : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.radio, { borderColor: selected ? c.text : c.line }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: c.text }]} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.optionTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.optionText, { color: c.textSecondary }]}>{text}</Text>
      </View>
    </Pressable>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

const styles = StyleSheet.create({
  question: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  option: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionText: { fontSize: 13, lineHeight: 18 },
  summary: { borderRadius: 10, padding: 12 },
  summaryText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pad: { paddingHorizontal: 12 },
});
