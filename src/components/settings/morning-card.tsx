import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { TimeField } from '@/components/time-field';
import { Button, Card, Chip, Muted, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MORNING_CRITERIA_LABELS, type MorningCriteria, type MorningSettings } from '@/logic';
import { hasReminderPermission, requestReminderPermission } from '@/notifications/reminders';

/** Réglages du rappel du matin ; chaque changement est enregistré tout de suite. */
export function MorningCard({ settings, onChange }: { settings: MorningSettings; onChange: (s: MorningSettings) => void }) {
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
    <Card title="Rappel du matin">
      <Muted>Noter ta nuit et voir ta journée, chaque matin.</Muted>
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
            <View style={{ flex: 1 }} />
          </Row>
          <Muted>Le matin est fait quand</Muted>
          <Row>
            {(Object.keys(MORNING_CRITERIA_LABELS) as MorningCriteria[]).map((k) => (
              <Chip key={k} label={MORNING_CRITERIA_LABELS[k]} selected={settings.criteria === k} onPress={() => onChange({ ...settings, criteria: k })} style={{ flex: 1 }} />
            ))}
          </Row>
          <Muted>Notification</Muted>
          <Row>
            <Chip label="Permanente" selected={settings.sticky} onPress={() => onChange({ ...settings, sticky: true })} style={{ flex: 1 }} />
            <Chip label="Balayable" selected={!settings.sticky} onPress={() => onChange({ ...settings, sticky: false })} style={{ flex: 1 }} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}
