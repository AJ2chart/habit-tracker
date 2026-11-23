import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackupCard } from '@/components/settings/backup-card';
import { MorningCard } from '@/components/settings/morning-card';
import { ReminderCard } from '@/components/settings/reminder-card';
import { RulesCard } from '@/components/settings/rules-card';
import { stopRule } from '@/db/actions';
import { loadSettings, saveSettings } from '@/db/settings';
import {
  DEFAULT_MORNING,
  DEFAULT_REMINDER,
  parseMorningSettings,
  parseReminderSettings,
  type MorningSettings,
  type ReminderSettings,
} from '@/logic';
import { Card, Muted, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';

function InfoRow({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { db, data, today, reload } = useAppData();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [morning, setMorning] = useState<MorningSettings>(DEFAULT_MORNING);

  useEffect(() => {
    void loadSettings(db).then((s) => {
      setLastBackup(s.last_backup ?? null);
      setReminder(parseReminderSettings(s));
      setMorning(parseMorningSettings(s));
    });
  }, [db, data]);

  const changeReminder = async (r: ReminderSettings) => {
    setReminder(r);
    await saveSettings(db, {
      reminder_enabled: r.enabled ? '1' : '0',
      reminder_time: r.time,
      reminder_repeat: String(r.repeat),
      reminder_until: r.until,
      reminder_criteria: r.criteria,
    });
    await reload(); // reprogramme les rappels
  };

  const version = Constants.expoConfig?.version ?? '—';
  const update = Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt
    ? Updates.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : 'version d’origine';

  const changeMorning = async (m: MorningSettings) => {
    setMorning(m);
    await saveSettings(db, {
      morning_enabled: m.enabled ? '1' : '0',
      morning_time: m.time,
      morning_sticky: m.sticky ? '1' : '0',
      morning_criteria: m.criteria,
    });
    await reload(); // reprogramme les rappels
  };

  return (
    <Screen title="Réglages">
      <MorningCard settings={morning} onChange={(m) => void changeMorning(m)} />

      <ReminderCard settings={reminder} onChange={(r) => void changeReminder(r)} />

      <BackupCard db={db} lastBackup={lastBackup} onDone={() => void reload()} />

      {data ? (
        <RulesCard
          rules={data.rules.filter((r) => !r.until || r.until >= today).sort((a, b) => a.start.localeCompare(b.start))}
          onStop={(id) => void stopRule(db, id, today).then(reload)}
        />
      ) : null}

      <Card title="Confidentialité">
        <Muted>Tes données restent sur ce téléphone, chiffrées. Rien n’est envoyé sur Internet.</Muted>
      </Card>

      <Card title="Compte">
        <Muted>Bientôt : synchronisation chiffrée et consultation sur le web.</Muted>
      </Card>

      <Card title="À propos">
        <InfoRow label="Version" value={version} />
        <InfoRow label="Dernière mise à jour" value={update} />
        {Updates.channel ? <InfoRow label="Canal" value={Updates.channel} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: 2 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
});
