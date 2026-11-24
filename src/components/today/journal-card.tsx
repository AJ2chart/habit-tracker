import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Chip } from '@/components/ui';
import { EnergyLabels, MoodColors, MoodLabels, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tagsOf, toggleTag, type Energy, type Mood, type MorningEntry } from '@/logic';

type Entry = { mood: Mood | null; energy: Energy | null; text: string };

/**
 * Journal du jour. Humeur et énergie s'enregistrent au toucher ;
 * la note s'enregistre 0,6 s après la dernière frappe et en quittant le champ.
 */
export function JournalCard({
  day,
  entry,
  onSave,
  title = 'Journal',
  placeholder = 'Une note sur ta journée… #étiquettes',
  tags = [],
}: {
  day: string;
  entry: Entry | undefined;
  onSave: (e: Entry) => void;
  title?: string;
  placeholder?: string;
  /** Étiquettes proposées sous la note, dans l'ordre */
  tags?: string[];
}) {
  const c = useTheme();
  const [text, setText] = useState(entry?.text ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mood = entry?.mood ?? null;
  const energy = entry?.energy ?? null;

  // Recharge la note quand on change de jour, sans écraser une saisie en cours.
  useEffect(() => {
    setText(entry?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flush = (t: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (t !== (entry?.text ?? '')) onSave({ mood, energy, text: t });
  };

  return (
    <Card title={title}>
      <View style={styles.row} accessibilityLabel="Humeur">
        {MoodLabels.map((l, i) => (
          <Chip key={l} label={l} selected={mood === i} style={styles.flex} onPress={() => onSave({ mood: mood === i ? null : (i as Mood), energy, text })}>
            <View style={[styles.dot, { backgroundColor: MoodColors[i] }]} />
          </Chip>
        ))}
      </View>
      <Text style={[styles.label, { color: c.textSecondary }]}>Énergie</Text>
      <View style={styles.row} accessibilityLabel="Énergie">
        {EnergyLabels.map((l, i) => (
          <Chip key={l} label={l} selected={energy === i} style={styles.flex} onPress={() => onSave({ mood, energy: energy === i ? null : (i as Energy), text })}>
            <View style={[styles.batt, { borderColor: c.textSecondary }]}>
              <View style={{ width: `${(i + 1) * 20}%` as `${number}%`, height: '100%', backgroundColor: c.text, borderRadius: 1 }} />
            </View>
          </Chip>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => flush(t), 600);
        }}
        onBlur={() => flush(text)}
        multiline
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={`${title} : note`}
        style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
      />
      {tags.length ? (
        <TagPicker
          text={text}
          tags={tags}
          onToggle={(tag) => {
            const t = toggleTag(text, tag);
            setText(t);
            flush(t);
          }}
        />
      ) : null}
    </Card>
  );
}

/** Nombre d'étiquettes visibles avant « + ». */
const VISIBLE_TAGS = 8;

/**
 * Étiquettes à toucher pour les ajouter à la note (ou les retirer). Celles déjà dans la note
 * passent devant, en surbrillance ; « + » montre toutes les autres.
 */
function TagPicker({ text, tags, onToggle }: { text: string; tags: string[]; onToggle: (tag: string) => void }) {
  const c = useTheme();
  const [all, setAll] = useState(false);
  const used = tagsOf(text);
  const rest = tags.filter((t) => !used.includes(t.toLowerCase()));
  const shown = all ? rest : rest.slice(0, Math.max(0, VISIBLE_TAGS - used.length));
  const hidden = rest.length - shown.length;
  const pill = (tag: string, on: boolean) => (
    <Pressable
      key={tag}
      onPress={() => onToggle(tag)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Retirer l'étiquette ${tag}` : `Ajouter l'étiquette ${tag}`}
      hitSlop={4}
      style={({ pressed }) => [
        styles.tag,
        { borderColor: on ? c.text : c.line, backgroundColor: on ? c.backgroundSelected : 'transparent' },
        pressed && { opacity: 0.6 },
      ]}>
      <Text style={[styles.tagText, { color: on ? c.text : c.textSecondary }]}>{`#${tag}`}</Text>
    </Pressable>
  );
  return (
    <View style={styles.tags}>
      {used.map((t) => pill(t, true))}
      {shown.map((t) => pill(t, false))}
      {hidden > 0 || all ? (
        <Pressable
          onPress={() => setAll(!all)}
          accessibilityRole="button"
          accessibilityLabel={all ? 'Moins d’étiquettes' : `${hidden} autres étiquettes`}
          hitSlop={4}
          style={[styles.tag, { borderColor: c.line, borderStyle: 'dashed' }]}>
          <Text style={[styles.tagText, { color: c.textSecondary }]}>{all ? 'Moins' : `+ ${hidden}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Humeur du matin : le journal en version courte. Une ligne de résumé une fois notée
 * (toucher pour modifier), sinon humeur, énergie et une note facultative.
 */
export function MorningMoodCard({
  day,
  entry,
  onSave,
  tags,
}: {
  day: string;
  entry: MorningEntry | undefined;
  onSave: (e: { mood: Mood | null; energy: Energy | null; note: string }) => void;
  tags?: string[];
}) {
  const c = useTheme();
  const [editing, setEditing] = useState(entry?.mood == null);
  useEffect(() => {
    setEditing(entry?.mood == null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  if (entry && entry.mood != null && !editing) {
    return (
      <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Modifier l'humeur du matin">
        <Card>
          <View style={styles.summary}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Ce matin</Text>
            <View style={[styles.dot, { backgroundColor: MoodColors[entry.mood], alignSelf: 'center' }]} />
            <Text style={[styles.summaryText, { color: c.text }]}>{MoodLabels[entry.mood]}</Text>
            {entry.energy != null ? <Text style={[styles.summaryText, { color: c.textSecondary }]}>{`· énergie ${EnergyLabels[entry.energy].toLowerCase()}`}</Text> : null}
            {entry.note ? (
              <Text numberOfLines={1} style={[styles.summaryText, { color: c.textSecondary, flex: 1 }]}>{`· ${entry.note}`}</Text>
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <JournalCard
      day={day}
      title="Ce matin"
      placeholder="Une intention pour la journée… (facultatif)"
      tags={tags}
      entry={entry ? { mood: entry.mood, energy: entry.energy, text: entry.note } : undefined}
      onSave={(e) => onSave({ mood: e.mood, energy: e.energy, note: e.text })}
    />
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, fontWeight: '500' },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  summaryText: { fontSize: 15 },
  row: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  batt: { width: 22, height: 10, borderWidth: 1.5, borderRadius: 3, padding: 1 },
  label: { fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
});
