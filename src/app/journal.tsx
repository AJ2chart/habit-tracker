import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnalysisView } from '@/components/journal/analysis-view';
import { Highlighted, TaggedText } from '@/components/journal/rich-text';
import { Card, Chip, IconButton, Muted, Row, Screen } from '@/components/ui';
import { MoodColors, MoodLabels, Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { fromKey, isBadDay, search, toKey, type Data, type DayKey } from '@/logic';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (k: string) => capitalize(fromKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
const monthTitle = (k: string) => capitalize(fromKey(k).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
const WEEK_HEAD = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** Ouvre ce jour dans l'onglet Aujourd'hui. */
const openDay = (k: DayKey) => router.navigate({ pathname: '/', params: { day: k, t: String(Date.now()) } });

const isNoted = (data: Data, k: DayKey) => !!data.journal[k] && (!!data.journal[k].text || data.journal[k].mood !== null);

function MoodDot({ mood, size = 10 }: { mood: number | null | undefined; size?: number }) {
  const c = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: mood != null ? MoodColors[mood] : c.line }} />;
}

function BadCount({ n }: { n: number }) {
  return (
    <View style={styles.badCount}>
      {n ? <MoodDot mood={0} size={8} /> : null}
      <Muted>{n ? `${n} jour${n > 1 ? 's' : ''} difficile${n > 1 ? 's' : ''}` : 'Aucun jour difficile'}</Muted>
    </View>
  );
}

function DayEntry({ data, k, first, onTag }: { data: Data; k: DayKey; first: boolean; onTag: (t: string) => void }) {
  const c = useTheme();
  const j = data.journal[k];
  const habits = (data.checks[k] ?? []).length;
  const slots = data.slots[k] ?? [];
  return (
    <Pressable onPress={() => openDay(k)} accessibilityRole="button" style={[styles.entry, !first && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ paddingTop: 6 }}>
        <MoodDot mood={j?.mood} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.entryDate, { color: c.text }]}>{longDate(k)}</Text>
        <Muted>{`${habits} habitude${habits > 1 ? 's' : ''} · ${slots.filter((s) => s.done).length}/${slots.length} créneaux`}</Muted>
        {j?.text ? <TaggedText text={j.text} onTag={onTag} numberOfLines={4} /> : <Muted>Pas de note</Muted>}
      </View>
    </Pressable>
  );
}

function ListView({ data, today, onTag }: { data: Data; today: string; onTag: (t: string) => void }) {
  const keys = Object.keys(data.journal)
    .filter((k) => k <= today && isNoted(data, k))
    .sort()
    .reverse();
  if (!keys.length)
    return (
      <Card title="Pas encore d'entrée">
        <Muted>Remplis le journal du jour dans l'onglet Aujourd'hui : humeur, énergie et une note. Tes journées apparaîtront ici, mois par mois.</Muted>
      </Card>
    );
  const byMonth = new Map<string, string[]>();
  for (const k of keys) {
    const m = k.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), k]);
  }
  return (
    <>
      {[...byMonth.entries()].map(([m, list]) => (
        <Card key={m} title={monthTitle(m + '-01')} right={<Muted>{`${list.length} jour${list.length > 1 ? 's' : ''}`}</Muted>}>
          <BadCount n={list.filter((k) => isBadDay(data.journal[k])).length} />
          {list.map((k, i) => (
            <DayEntry key={k} data={data} k={k} first={i === 0} onTag={onTag} />
          ))}
        </Card>
      ))}
    </>
  );
}

function CalendarView({ data, today, month, setMonth }: { data: Data; today: string; month: string; setMonth: (m: string) => void }) {
  const c = useTheme();
  const first = fromKey(month);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (DayKey | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toKey(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const shift = (n: number) => setMonth(toKey(new Date(first.getFullYear(), first.getMonth() + n, 1)));

  const noted = cells.filter((k): k is DayKey => !!k && k <= today && isNoted(data, k));
  const bad = noted.filter((k) => isBadDay(data.journal[k])).length;

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton label="Mois précédent" glyph="‹" onPress={() => shift(-1)} />
          <Text style={[styles.calTitle, { color: c.text }]}>{monthTitle(month)}</Text>
          <IconButton label="Mois suivant" glyph="›" onPress={() => shift(1)} />
        </Row>
        <View style={styles.week}>
          {WEEK_HEAD.map((d) => (
            <Text key={d} style={[styles.weekHead, { color: c.textSecondary }]}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((w, wi) => (
          <View key={wi} style={styles.week}>
            {w.map((k, di) => {
              if (!k) return <View key={di} style={styles.dayCell} />;
              const j = data.journal[k];
              const future = k > today;
              return (
                <Pressable
                  key={k}
                  onPress={() => openDay(k)}
                  accessibilityRole="button"
                  accessibilityLabel={`${longDate(k)}${j?.mood != null ? `, humeur ${MoodLabels[j.mood]}` : ''}`}
                  style={({ pressed }) => [
                    styles.dayCell,
                    styles.dayBox,
                    { borderColor: k === today ? c.goal : c.line, borderWidth: k === today ? 2 : 1, opacity: future ? 0.4 : pressed ? 0.6 : 1 },
                  ]}>
                  <Text style={[styles.dayNum, { color: c.text }]}>{Number(k.slice(8))}</Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: j?.mood != null && !future ? MoodColors[j.mood] : 'transparent' }} />
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          {MoodLabels.map((l, i) => (
            <View key={l} style={styles.legendItem}>
              <MoodDot mood={i} size={8} />
              <Muted>{l}</Muted>
            </View>
          ))}
        </View>
      </Card>
      <Row style={{ alignItems: 'stretch' }}>
        <View style={[styles.stat, { backgroundColor: c.backgroundElement, borderColor: c.line }]}>
          <Text style={[styles.statValue, { color: c.text }]}>{noted.length}</Text>
          <Muted>jours notés ce mois</Muted>
        </View>
        <View style={[styles.stat, { backgroundColor: c.backgroundElement, borderColor: c.line }]}>
          <Text style={[styles.statValue, { color: bad ? c.warn : c.text }]}>{bad}</Text>
          <Muted>{bad > 1 ? 'jours difficiles' : 'jour difficile'}</Muted>
        </View>
      </Row>
    </>
  );
}

function SearchResults({ data, query }: { data: Data; query: string }) {
  const c = useTheme();
  const results = search(data, query);
  return (
    <Card>
      <Muted>{`${results.length} jour${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''} pour « ${query.trim()} »`}</Muted>
      {results.length === 0 ? <Muted>Aucun résultat. Essaie un autre mot, sans te soucier des accents.</Muted> : null}
      {results.map((r, i) => (
        <Pressable key={r.date} onPress={() => openDay(r.date)} accessibilityRole="button" style={[styles.entry, i > 0 && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ paddingTop: 6 }}>
            <MoodDot mood={data.journal[r.date]?.mood} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.entryDate, { color: c.text }]}>
              {longDate(r.date)}
              {r.date > toKey(new Date()) ? <Text style={{ color: c.textSecondary, fontWeight: '400' }}> · à venir</Text> : null}
            </Text>
            {r.hits.map((h, hi) => (
              <View key={hi} style={{ gap: 1 }}>
                {h.kind === 'slot' ? <Muted>{`${h.label} · créneau`}</Muted> : null}
                {h.kind === 'note' ? <Muted>{`${h.label} · description`}</Muted> : null}
                {h.kind === 'habit' ? <Muted>Habitude cochée</Muted> : null}
                {h.kind === 'review' ? <Muted>{`Revue de la semaine · ${h.label}`}</Muted> : null}
                <Highlighted segments={h.segments} />
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

export default function JournalScreen() {
  const c = useTheme();
  const { data, today } = useAppData();
  const [mode, setMode] = useState<'liste' | 'calendrier' | 'analyse'>('liste');
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(() => toKey(new Date()).slice(0, 7) + '-01');

  if (!data) return <Screen title="Journal" subtitle="Chargement…" />;
  const count = Object.keys(data.journal).filter((k) => k <= today && isNoted(data, k)).length;

  return (
    <Screen title="Journal" subtitle={`${count} jour${count > 1 ? 's' : ''} consigné${count > 1 ? 's' : ''}`}>
      <View style={[styles.searchBox, { backgroundColor: c.backgroundElement, borderColor: c.line }]}>
        <Text style={{ color: c.textSecondary, fontSize: 16 }}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher : dentiste, #sommeil, réunion…"
          placeholderTextColor={c.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Rechercher dans le journal, l'emploi du temps et les revues"
          style={[styles.searchInput, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Text style={{ color: c.textSecondary, fontSize: 16 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {query.trim() ? (
        <SearchResults data={data} query={query} />
      ) : (
        <>
          <Row>
            <Chip label="Liste" selected={mode === 'liste'} onPress={() => setMode('liste')} style={{ flex: 1 }} />
            <Chip label="Calendrier" selected={mode === 'calendrier'} onPress={() => setMode('calendrier')} style={{ flex: 1 }} />
            <Chip label="Analyse" selected={mode === 'analyse'} onPress={() => setMode('analyse')} style={{ flex: 1 }} />
          </Row>
          {mode === 'liste' ? <ListView data={data} today={today} onTag={(t) => setQuery(`#${t}`)} /> : null}
          {mode === 'calendrier' ? <CalendarView data={data} today={today} month={month} setMonth={setMonth} /> : null}
          {mode === 'analyse' ? <AnalysisView data={data} today={today} onTag={(t) => setQuery(`#${t}`)} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15 },
  badCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entry: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  entryDate: { fontSize: 15, fontWeight: '600' },
  calTitle: { fontSize: 17, fontWeight: '600' },
  week: { flexDirection: 'row', gap: 4 },
  weekHead: { flex: 1, textAlign: 'center', fontSize: 11 },
  dayCell: { flex: 1, aspectRatio: 1 },
  dayBox: { borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNum: { fontSize: 13, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: Spacing.two },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
