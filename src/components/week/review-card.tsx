import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Muted } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyReview } from '@/logic';

type Fields = { good: string; hard: string; change: string };
const QUESTIONS: [keyof Fields, string][] = [
  ['good', "Qu'est-ce qui a bien marché ?"],
  ['hard', "Qu'est-ce qui a coincé ?"],
  ['change', 'Une chose à changer la semaine prochaine'],
];

/** Revue en trois questions, enregistrée 0,6 s après la dernière frappe et en quittant un champ. */
export function ReviewCard({
  weekStart,
  review,
  previous,
  future,
  onSave,
}: {
  weekStart: string;
  review: WeeklyReview | undefined;
  previous: WeeklyReview | undefined;
  future: boolean;
  onSave: (f: Fields) => void;
}) {
  const c = useTheme();
  const [f, setF] = useState<Fields>({ good: review?.good ?? '', hard: review?.hard ?? '', change: review?.change ?? '' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setF({ good: review?.good ?? '', hard: review?.hard ?? '', change: review?.change ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flush = (next: Fields) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next.good !== (review?.good ?? '') || next.hard !== (review?.hard ?? '') || next.change !== (review?.change ?? '')) onSave(next);
  };

  const filled = QUESTIONS.filter(([k]) => f[k].trim()).length;

  return (
    <Card title="Revue de la semaine" right={<Muted>{`${filled}/3`}</Muted>}>
      {future ? (
        <Muted>Disponible quand la semaine aura commencé.</Muted>
      ) : (
        QUESTIONS.map(([k, label]) => (
          <View key={k} style={{ gap: 4 }}>
            <Muted>{label}</Muted>
            <TextInput
              value={f[k]}
              multiline
              onChangeText={(t) => {
                const next = { ...f, [k]: t };
                setF(next);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => flush(next), 600);
              }}
              onBlur={() => flush(f)}
              accessibilityLabel={label}
              style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }]}
            />
          </View>
        ))
      )}
      {previous?.change && !future ? (
        <Text style={[styles.prev, { color: c.textSecondary }]}>
          {'Ton engagement de la semaine dernière : '}
          <Text style={{ color: c.text, fontWeight: '600' }}>{previous.change}</Text>
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 56, borderWidth: 1, borderRadius: Radius.control, padding: 10, fontSize: 15, textAlignVertical: 'top' },
  prev: { fontSize: 13, lineHeight: 18, marginTop: Spacing.one },
});
