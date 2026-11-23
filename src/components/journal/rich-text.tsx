import { Text, type TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Segment } from '@/logic';

const TAG = /#[\p{L}\p{N}_-]+/gu;

/** Texte dont les #étiquettes sont mises en valeur et touchables. */
export function TaggedText({ text, onTag, style, numberOfLines }: { text: string; onTag?: (tag: string) => void; style?: TextStyle; numberOfLines?: number }) {
  const c = useTheme();
  const parts: { s: string; tag: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ s: text.slice(last, i), tag: false });
    parts.push({ s: m[0], tag: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ s: text.slice(last), tag: false });

  return (
    <Text style={[{ color: c.text, fontSize: 15, lineHeight: 21 }, style]} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.tag ? (
          <Text
            key={i}
            style={{ color: c.goal, fontWeight: '500' }}
            onPress={onTag ? () => onTag(p.s.slice(1).toLowerCase()) : undefined}
            accessibilityRole={onTag ? 'link' : undefined}>
            {p.s}
          </Text>
        ) : (
          p.s
        ),
      )}
    </Text>
  );
}

/** Texte avec les passages trouvés surlignés. */
export function Highlighted({ segments, style }: { segments: Segment[]; style?: TextStyle }) {
  const c = useTheme();
  return (
    <Text style={[{ color: c.text, fontSize: 14, lineHeight: 20 }, style]}>
      {segments.map((s, i) =>
        s.match ? (
          <Text key={i} style={{ backgroundColor: c.goalSoft, color: c.text, fontWeight: '600' }}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}
