import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { TimeField } from '@/components/time-field';
import { Button, Card, Chip, Muted, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CRITERIA_LABELS, type FillCriteria, type ReminderSettings } from '@/logic';
import { hasReminderPermission, requestReminderPermission } from '@/notifications/reminders';

const REPEATS: [number, string][] = [
  [0, 'Non'],
  [30, 'Toutes les 30 min'],
  [60, 'Toutes les heures'],
];

/** Réglages du rappel du soir ; chaque changement est enregistré tout de suite. */
export function ReminderCard({ settings, onChange }: { settings: ReminderSettings; onChange: (s: ReminderSettings) => void }) {
  const c = useTheme();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (settings.enabled) void hasReminderPermission().then((ok) => setDenied(!ok));
  }, [settings.enabled]);

  const enable = async () => {
    const ok = await requestReminderPermission();
    setDenied(!ok);
    if (ok) onChange({ ...settings, enabled: true });
  };

  return (
    <Card title="Rappel du soir">
      <Muted>Tant que la journée n’est pas remplie.</Muted>
      <Row>
        <Chip label="Désactivé" selected={!settings.enabled} onPress={() => onChange({ ...settings, enabled: false })} style={{ flex: 1 }} />
        <Chip label="Activé" selected={settings.enabled} onPress={() => void enable()} style={{ flex: 1 }} />
      </Row>

      {denied ? (
        <View style={{ gap: Spacing.one }}>
          <Text style={{ color: c.warn, fontSize: 13, lineHeight: 18 }}>
            Les notifications sont bloquées pour l’appli. Autorise-les dans les réglages du téléphone, puis réactive le rappel.
          </Text>
          <Button label="Ouvrir les réglages du téléphone" variant="small" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      {settings.enabled && !denied ? (
        <>
          <Row>
            <TimeField label="Heure du rappel" value={settings.time} onChange={(time) => onChange({ ...settings, time })} />
            {settings.repeat ? (
              <TimeField label="Dernière relance" value={settings.until} onChange={(until) => onChange({ ...settings, until })} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </Row>
          <Muted>Relancer si toujours pas remplie</Muted>
          <Row>
            {REPEATS.map(([v, l]) => (
              <Chip key={v} label={l} selected={settings.repeat === v} onPress={() => onChange({ ...settings, repeat: v })} style={{ flex: 1 }} />
            ))}
          </Row>
          <Muted>Une journée compte comme remplie avec</Muted>
          <Row>
            {(Object.keys(CRITERIA_LABELS) as FillCriteria[]).map((k) => (
              <Chip key={k} label={CRITERIA_LABELS[k]} selected={settings.criteria === k} onPress={() => onChange({ ...settings, criteria: k })} style={{ flex: 1 }} />
            ))}
          </Row>
        </>
      ) : null}
    </Card>
  );
}
