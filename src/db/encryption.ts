import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Chiffrement de la base (SQLCipher).
 * - La clé (256 bits, aléatoire) est créée au premier lancement et rangée dans le
 *   stockage sécurisé du système (Keystore Android, trousseau iOS), jamais ailleurs.
 * - Dans Expo Go, SQLCipher n'est pas disponible : la base reste en clair (données de test).
 * Attention : sur Android, la clé disparaît si l'appli est désinstallée. La sauvegarde
 * chiffrée (export) servira de filet de sécurité.
 */
const KEY_NAME = 'db-key-v1';

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  // getRandomValues est cryptographiquement sûr, y compris en développement.
  const bytes = Crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  return key;
}

/**
 * Déverrouille la base : à appeler en tout premier, avant toute autre requête.
 * Renvoie true si la base est chiffrée, false si SQLCipher est absent (Expo Go).
 */
export async function unlockDatabase(db: SQLiteDatabase): Promise<boolean> {
  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) return false;
  const key = await getOrCreateKey();
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  return true;
}
