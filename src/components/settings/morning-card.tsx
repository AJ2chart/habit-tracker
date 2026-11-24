import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { TimeField } from '@/components/time-field';
import { Button, Card, Chip, Muted, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MORNING_STEP_LABELS, type Habit, type MorningSettings, type MorningStep } from '@/logic';
import { hasReminderPermission, requestReminderPermission } from '@/notifications/reminders';

/** Réglages du rappel du matin ; chaque changement est enregistré tout de suite. */
export function MorningCard({ settings, habits, onChange }: { settings: MorningSettings; habits: Habit[]; onChange: (s: MorningSettings) => void }) {
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
      <Muted>Une routine à cocher chaque matin ; le rappel reste tant qu’elle n’est pas faite.</Muted>
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
          <Muted>Le matin est fait quand tout ceci est coché</Muted>
          <Row style={{ flexWrap: 'wrap' }}>
            {(Object.keys(MORNING_STEP_LABELS) as MorningStep[]).map((k) => {
              const on = settings.steps.includes(k);
              return (
                <Chip
                  key={k}
                  label={MORNING_STEP_LABELS[k]}
                  selected={on}
                  onPress={() => onChange({ ...settings, steps: on ? settings.steps.filter((x) => x !== k) : [...settings.steps, k] })}
                />
              );
            })}
          </Row>
          {habits.length ? (
            <>
              <Muted>Habitudes du matin</Muted>
              <Row style={{ flexWrap: 'wrap' }}>
                {habits.map((h) => {
                  const on = settings.habits.includes(h.id);
                  return (
                    <Chip
                      key={h.id}
                      label={h.name}
                      selected={on}
                      onPress={() => onChange({ ...settings, habits: on ? settings.habits.filter((x) => x !== h.id) : [...settings.habits, h.id] })}
                    />
                  );
                })}
              </Row>
            </>
          ) : null}
          {!settings.steps.length && !settings.habits.some((id) => habits.some((h) => h.id === id)) ? (
            <Text style={{ color: c.warn, fontSize: 13 }}>Rien de coché : le rappel ne s’affichera pas.</Text>
          ) : null}
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
