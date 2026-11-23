import { gcm } from '@noble/ciphers/aes';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Format d'un fichier de sauvegarde : du JSON lisible qui décrit comment il est chiffré,
 * autour d'un contenu illisible sans le mot de passe.
 * - Clé dérivée du mot de passe par PBKDF2-SHA256 (sel aléatoire de 16 octets).
 * - Contenu chiffré et authentifié par AES-256-GCM (nonce aléatoire de 12 octets) :
 *   toute modification du fichier ou mauvais mot de passe fait échouer le déchiffrement.
 */
export const BACKUP_FORMAT = 'habit-tracker-backup';
export const DEFAULT_ITERATIONS = 200_000;

export interface Envelope {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { name: 'AES-256-GCM'; nonce: string };
  data: string;
}

export class BackupError extends Error {}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length && i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (o < out.length && i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.slice(0, o);
}

const deriveKey = (password: string, salt: Uint8Array, iterations: number) =>
  pbkdf2Async(sha256, utf8ToBytes(password.normalize('NFC')), salt, { c: iterations, dkLen: 32, asyncTick: 20 });

/** Chiffre un texte avec un mot de passe ; renvoie le contenu du fichier de sauvegarde. */
export async function encryptBackup(
  plain: string,
  password: string,
  randomBytes: (n: number) => Uint8Array,
  iterations = DEFAULT_ITERATIONS,
  now = new Date(),
): Promise<string> {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const data = gcm(key, nonce).encrypt(utf8ToBytes(plain));
  const env: Envelope = {
    format: BACKUP_FORMAT,
    version: 1,
    createdAt: now.toISOString(),
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-256-GCM', nonce: toBase64(nonce) },
    data: toBase64(data),
  };
  return JSON.stringify(env);
}

/** Lit l'en-tête d'un fichier de sauvegarde, sans le déchiffrer. */
export function readEnvelope(text: string): Envelope {
  let env: Envelope;
  try {
    env = JSON.parse(text) as Envelope;
  } catch {
    throw new BackupError("Ce fichier n'est pas une sauvegarde de l'appli.");
  }
  if (env?.format !== BACKUP_FORMAT || !env.kdf?.salt || !env.cipher?.nonce || !env.data)
    throw new BackupError("Ce fichier n'est pas une sauvegarde de l'appli.");
  if (env.version !== 1) throw new BackupError("Cette sauvegarde vient d'une version plus récente de l'appli. Mets l'appli à jour.");
  return env;
}

/** Déchiffre un fichier de sauvegarde. Erreur claire si le mot de passe est faux ou le fichier modifié. */
export async function decryptBackup(text: string, password: string): Promise<string> {
  const env = readEnvelope(text);
  const key = await deriveKey(password, fromBase64(env.kdf.salt), env.kdf.iterations);
  try {
    return bytesToUtf8(gcm(key, fromBase64(env.cipher.nonce)).decrypt(fromBase64(env.data)));
  } catch {
    throw new BackupError('Mot de passe incorrect, ou fichier abîmé.');
  }
}
