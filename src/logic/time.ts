/** Heure valide au format HH:MM (00:00 à 23:59). */
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Remet en forme une heure tapée librement : "930" → "09:30", "9h" → "09:00",
 * "14h5" → "14:05", "1430" → "14:30". Renvoie la saisie telle quelle si elle est illisible.
 */
export function normalizeTime(input: string): string {
  const s = input.trim().toLowerCase().replace(/\s/g, '');
  const m = s.match(/^(\d{1,2})[h:.]?(\d{0,2})$/);
  let h: number;
  let min: number;
  if (m && (s.includes('h') || s.includes(':') || s.includes('.') || m[1].length + m[2].length <= 2)) {
    h = Number(m[1]);
    min = m[2] ? Number(m[2].length === 1 ? m[2] + '0' : m[2]) : 0;
    if (m[2].length === 1 && /[h]/.test(s)) min = Number(m[2]);
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    min = Number(s.slice(-2));
  } else return input;
  if (h > 23 || min > 59) return input;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export const nowHM = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
