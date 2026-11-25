import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, mondayOf, toKey, type DayKey, type Mood } from '@/logic';

import { addGoal, addHabit, addNote, addRule, addSlot, saveJournal, saveMorning, saveReview, saveSleep, setHabitChecked, setPlanValidated } from './actions';
import { loadData } from './repo';
import { saveSettings } from './settings';

/**
 * Données de test pour le contrôle visuel (Contrôle béton), version web uniquement :
 * ouvrir l'appli avec `?seed=extreme` (textes très longs, beaucoup d'éléments)
 * ou `?seed=empty` (base vide). Sans paramètre, rien ne se passe.
 * N'est jamais appelé dans l'appli installée sur le téléphone.
 */
export async function seedForTests(db: SQLiteDatabase, kind: string) {
  const tables = ['habits', 'habit_checks', 'recurring_rules', 'slots', 'journal_entries', 'goals', 'weekly_reviews', 'sleep_entries', 'morning_entries', 'day_plans', 'day_notes', 'settings'];
  for (const t of tables) {
    const exists = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", t);
    if (exists) await db.runAsync(`DELETE FROM ${t}`);
  }
  if (kind !== 'extreme') return;

  const today = toKey(new Date());
  const long = 'Une journée vraiment très longue avec beaucoup de choses à raconter, ';
  const word = 'Anticonstitutionnellementpasdutoutraisonnable';

  const names = [word, 'Lecture 20 pages', 'Training', 'Coding', 'Méditation du matin avec respiration carrée et étirements longs'];
  for (let i = 0; i < 18; i++) await addHabit(db, names[i] ?? `Habitude numéro ${i + 1} au nom assez long`, 7);
  let data = await loadData(db);
  const habits = data.habits;

  // Un an d'historique : journal, matin, nuits, habitudes cochées un jour sur deux (séries cassées comprises).
  for (let i = 1; i <= 365; i++) {
    const k = addDays(today, -i);
    const mood = (i % 5) as Mood;
    await saveJournal(db, k, { mood, energy: ((i + 2) % 5) as Mood, text: `${long.repeat(i % 7 === 0 ? 30 : 2)} #travail #${i % 3 ? 'stress' : 'calme'} ${i % 11 === 0 ? word : ''}` });
    await saveMorning(db, k, { mood: ((i + 1) % 5) as Mood, energy: 2, note: i % 2 ? '#fatigue' : '' });
    await saveSleep(db, { date: k, bed: '23:15', wake: i % 4 ? '07:00' : '05:10', quality: (i % 5) as Mood, awakenings: i % 4 });
    if (i > 2) for (const h of habits.slice(0, 6)) if ((i + h.name.length) % 2) await setHabitChecked(db, k, h.id, true);
    if (i < 15) for (let n = 0; n < 6; n++) await addNote(db, k, `${String(8 + n).padStart(2, '0')}:00`, `Note ${n} ${long} #tag${n}`);
  }

  // Aujourd'hui : beaucoup de créneaux, titres longs, notes longues.
  data = await loadData(db);
  for (let i = 0; i < 14; i++) {
    const h = String(6 + i).padStart(2, '0');
    await addSlot(db, { date: today, start: `${h}:00`, end: `${h}:45`, title: i === 3 ? word : `Créneau ${i + 1} ${i % 2 ? 'avec un titre vraiment très long pour voir' : ''}`, habitId: i === 1 ? habits[1].id : null }, data);
  }
  await addRule(db, { title: `Règle ${word}`, start: '21:00', end: '22:00', habitId: null, type: 'weekdays', days: [], from: addDays(today, -30) });
  for (let n = 0; n < 12; n++) await addNote(db, today, `${String(8 + n).padStart(2, '0')}:1${n % 10}`, n === 0 ? word : `${long.repeat(3)} #tag${n}`);
  await setHabitChecked(db, today, habits[2].id, true);
  await setPlanValidated(db, addDays(today, -1), true);

  // Objectifs aux titres longs, un challenge.
  const y = `${today.slice(0, 4)}-01-01`;
  const m = `${today.slice(0, 7)}-01`;
  await addGoal(db, { level: 'annuel', parentId: null, title: `Objectif annuel ${word}`, kind: 'manual', target: 1000000, current: 999999, unit: 'pages lues cette année', periodStart: y });
  await addGoal(db, { level: 'mensuel', parentId: null, title: 'Objectif mensuel au titre très très long qui ne tient pas sur une ligne', kind: 'manual', target: 12, current: 0, periodStart: m });
  await addGoal(db, { level: 'hebdo', parentId: null, title: 'Challenge', kind: 'habit', habitId: habits[0].id, target: 7, periodStart: mondayOf(today), endDate: addDays(today, -1) as DayKey });
  await saveReview(db, mondayOf(addDays(today, -7)), { good: long.repeat(4), hard: word, change: long });

  await saveSettings(db, {
    morning_enabled: '1',
    morning_time: '08:00',
    morning_sticky: '1',
    morning_steps: JSON.stringify({ steps: ['sleep', 'plan', 'journal'], habits: habits.slice(0, 8).map((h) => h.id) }),
    reminder_enabled: '1',
  });
}
