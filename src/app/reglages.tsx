import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackupCard } from '@/components/settings/backup-card';
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
  const { db, data, reload } = useAppData();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    void db
      .getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'last_backup'")
      .then((r) => setLastBackup(r?.value ?? null));
  }, [db, data]);

  const version = Constants.expoConfig?.version ?? '—';
  const update = Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt
    ? Updates.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : 'version d’origine';

  return (
    <Screen title="Réglages" subtitle="Sauvegarde, confidentialité, appli">
      <BackupCard db={db} lastBackup={lastBackup} onDone={() => void reload()} />

      <Card title="Confidentialité">
        <Muted>
          Tes données restent sur ce téléphone, dans une base chiffrée dont la clé est gardée par le stockage sécurisé du système. Rien
          n’est envoyé sur Internet : les mises à jour de l’appli arrivent, tes données ne partent pas.
        </Muted>
      </Card>

      <Card title="Compte">
        <Muted>Bientôt : un compte pour synchroniser tes données entre appareils et les consulter sur le web, chiffrées de bout en bout.</Muted>
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
