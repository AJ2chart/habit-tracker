import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DayNote } from '@/logic';

/**
 * Notes rapides du jour : un ressenti à chaud, une fin de journée de travail…
 * Chaque note garde son heure. Toucher une note pour la modifier ; la vider la supprime.
 */
export function NotesCard({
  notes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: DayNote[];
  onAdd: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const c = useTheme();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft('');
  };

  const saveEdit = (n: DayNote) => {
    const t = editText.trim();
    if (!t) onDelete(n.id);
    else if (t !== n.text) onUpdate(n.id, t);
    setEditing(null);
  };

  return (
    <Card title="Notes du jour">
      {notes.map((n) => (
        <View key={n.id} style={styles.note}>
          <Text style={[styles.time, { color: c.textSecondary }]}>{n.time}</Text>
          {editing === n.id ? (
            <TextInput
              autoFocus
              value={editText}
              onChangeText={setEditText}
              onBlur={() => saveEdit(n)}
              multiline
              accessibilityLabel={`Modifier la note de ${n.time}`}
              style={[styles.input, styles.flex, { color: c.text, backgroundColor: c.background, borderColor: c.text }]}
            />
          ) : (
            <Pressable
              style={styles.flex}
              onPress={() => {
                setEditText(n.text);
                setEditing(n.id);
              }}
              accessibilityRole="button"
              accessibilityHint="Touche pour modifier">
              <Text style={[styles.text, { color: c.text }]}>{n.text}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(n.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Supprimer la note de ${n.time}`}>
            <Text style={[styles.del, { color: c.textSecondary }]}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Un ressenti, là, maintenant… #étiquettes"
          placeholderTextColor={c.textSecondary}
          accessibilityLabel="Nouvelle note"
          style={[styles.input, styles.flex, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
        />
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ajouter la note"
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: draft.trim() ? c.accent : c.backgroundSelected },
            pressed && { opacity: 0.7 },
          ]}>
          <Text style={[styles.addText, { color: draft.trim() ? c.onAccent : c.textSecondary }]}>+</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  time: { fontSize: 13, fontVariant: ['tabular-nums'], paddingTop: 2, width: 40 },
  text: { fontSize: 15, lineHeight: 21 },
  del: { fontSize: 20, lineHeight: 22, paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addBtn: { width: 40, height: 40, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 22, fontWeight: '600', lineHeight: 26 },
});
