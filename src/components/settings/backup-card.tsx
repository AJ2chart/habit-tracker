import * as Crypto from 'expo-crypto';
import { Directory, File } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { decryptBackup, encryptBackup, readEnvelope } from '@/backup/crypto';
import { Button, Card, Field, Muted, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dumpDatabase, restoreDatabase, summarize, type Dump } from '@/db/backup';
import { useTheme } from '@/hooks/use-theme';
import type { SQLiteDatabase } from 'expo-sqlite';
import { plural } from '@/logic';

type Mode = 'idle' | 'export' | 'import' | 'confirm';
const fileName = () => `habit-tracker-${new Date().toISOString().slice(0, 10)}.json`;
const random = (n: number) => Crypto.getRandomValues(new Uint8Array(n));

/** Enregistre le fichier dans un dossier choisi (Android) ; sinon, ouvre le partage du système. */
async function saveText(text: string): Promise<'saved' | 'shared' | 'cancelled'> {
  const picker = (Directory as unknown as { pickDirectoryAsync?: () => Promise<Directory> }).pickDirectoryAsync;
  if (Platform.OS === 'android' && typeof picker === 'function') {
    try {
      const dir = await picker.call(Directory);
      if (dir) {
        const file = dir.createFile(fileName(), 'application/json');
        await file.write(text);
        return 'saved';
      }
    } catch {
      // Choix annulé ou dossier inaccessible : on se rabat sur le partage.
    }
  }
  const r = await Share.share({ message: text, title: fileName() });
  return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
}

export function BackupCard({ db, lastBackup, onDone }: { db: SQLiteDatabase; lastBackup: string | null; onDone: () => void }) {
  const c = useTheme();
  const [mode, setMode] = useState<Mode>('idle');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [pending, setPending] = useState<Dump | null>(null);

  const reset = () => {
    setMode('idle');
    setPw('');
    setPw2('');
    setError(null);
    setFileText(null);
    setPasted('');
    setPending(null);
  };

  // Heure lue une fois à l'ouverture de l'écran (pas pendant chaque rendu).
  const [now] = useState(() => Date.now());
  const daysSince = lastBackup ? Math.floor((now - Date.parse(lastBackup)) / 864e5) : null;

  const doExport = async () => {
    setError(null);
    if (pw.length < 8) return setError('Choisis un mot de passe d’au moins 8 caractères.');
    if (pw !== pw2) return setError('Les deux mots de passe ne correspondent pas.');
    try {
      setBusy('Chiffrement en cours… quelques secondes.');
      const dump = await dumpDatabase(db);
      const text = await encryptBackup(JSON.stringify(dump), pw, random);
      setBusy(null);
      const res = await saveText(text);
      if (res === 'cancelled') return setError('Sauvegarde annulée : rien n’a été enregistré.');
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES ('last_backup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        new Date().toISOString(),
      );
      reset();
      setInfo(res === 'saved' ? 'Sauvegarde enregistrée dans le dossier choisi.' : 'Sauvegarde envoyée. Vérifie qu’elle est bien arrivée là où tu l’as partagée.');
      onDone();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'La sauvegarde a échoué.');
    }
  };

  const pickFile = async () => {
    setError(null);
    try {
      const r = await File.pickFileAsync();
      if (r.canceled) return;
      const picked = Array.isArray(r.result) ? r.result[0] : r.result;
      const text = await picked.text();
      readEnvelope(text);
      setFileText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lire ce fichier.');
    }
  };

  const unlock = async () => {
    setError(null);
    const text = fileText ?? pasted.trim();
    if (!text) return setError('Choisis d’abord un fichier de sauvegarde.');
    try {
      setBusy('Déchiffrement en cours… quelques secondes.');
      const dump = JSON.parse(await decryptBackup(text, pw)) as Dump;
      setBusy(null);
      setPending(dump);
      setMode('confirm');
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Déchiffrement impossible.');
    }
  };

  const restore = async () => {
    if (!pending) return;
    try {
      setBusy('Restauration en cours…');
      await restoreDatabase(db, pending);
      setBusy(null);
      reset();
      setInfo('Données restaurées.');
      onDone();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'La restauration a échoué ; tes données actuelles sont intactes.');
    }
  };

  const s = pending ? summarize(pending) : null;

  return (
    <Card title="Sauvegarde">
      <Muted>
        {lastBackup
          ? `Dernière sauvegarde : il y a ${daysSince === 0 ? "moins d'un jour" : `${daysSince} jour${daysSince! > 1 ? 's' : ''}`}.`
          : 'Aucune sauvegarde pour l’instant. Tes données n’existent que sur ce téléphone.'}
      </Muted>
      {daysSince !== null && daysSince >= 14 ? <Text style={{ color: c.warn, fontSize: 13 }}>Pense à refaire une sauvegarde.</Text> : null}
      {info && mode === 'idle' ? <Text style={{ color: c.text, fontSize: 13 }}>{info}</Text> : null}

      {mode === 'idle' ? (
        <Row>
          <Button label="Exporter" onPress={() => { setInfo(null); setMode('export'); }} style={styles.flex} />
          <Button label="Restaurer" variant="ghost" onPress={() => { setInfo(null); setMode('import'); }} style={styles.flex} />
        </Row>
      ) : null}

      {mode === 'export' ? (
        <View style={styles.block}>
          <Muted>Le fichier sera chiffré avec ce mot de passe. Sans lui, personne ne pourra le lire, toi compris : note-le en lieu sûr.</Muted>
          <Field label="Mot de passe (8 caractères minimum)" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
          <Field label="Confirmer le mot de passe" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button label="Annuler" variant="ghost" onPress={reset} />
            <Button label="Chiffrer et enregistrer" onPress={doExport} disabled={!!busy} />
          </Row>
        </View>
      ) : null}

      {mode === 'import' ? (
        <View style={styles.block}>
          <Button label={fileText ? 'Fichier sélectionné ✓' : 'Choisir le fichier de sauvegarde'} variant="ghost" onPress={pickFile} />
          {!fileText ? <Field label="Ou colle ici le contenu de la sauvegarde" value={pasted} onChangeText={setPasted} multiline style={{ maxHeight: 90 }} autoCapitalize="none" /> : null}
          <Field label="Mot de passe de la sauvegarde" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button label="Annuler" variant="ghost" onPress={reset} />
            <Button label="Ouvrir" onPress={unlock} disabled={!!busy} />
          </Row>
        </View>
      ) : null}

      {mode === 'confirm' && s && pending ? (
        <View style={styles.block}>
          <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
            {`Sauvegarde du ${new Date(pending.exportedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} : ${plural(s.days, 'jour')} de journal, ${plural(s.habits, 'habitude')}, ${plural(s.slots, 'créneau', 'créneaux')}, ${plural(s.goals, 'objectif')}.`}
          </Text>
          <Text style={{ color: c.warn, fontSize: 13, lineHeight: 18 }}>
            La restauration remplace toutes les données actuelles de l’appli par celles de la sauvegarde.
          </Text>
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button label="Annuler" variant="ghost" onPress={reset} />
            <Button label="Remplacer mes données" onPress={restore} disabled={!!busy} />
          </Row>
        </View>
      ) : null}

      {busy ? (
        <Row>
          <ActivityIndicator />
          <Muted>{busy}</Muted>
        </Row>
      ) : null}
      {error ? <Text style={{ color: c.warn, fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: Spacing.two },
});
