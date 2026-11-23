import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadData } from '@/db/repo';
import { loadSettings } from '@/db/settings';
import { parseReminderSettings } from '@/logic';
import { syncReminders } from '@/notifications/reminders';
import { toKey, type Data } from '@/logic';

/**
 * Données de l'appli, rechargées à chaque fois que l'écran reprend le focus.
 * `today` est recalculé au même moment, pour suivre le passage à minuit.
 */
export function useAppData() {
  const db = useSQLiteContext();
  const [data, setData] = useState<Data | null>(null);
  const [today, setToday] = useState(() => toKey(new Date()));

  const reload = useCallback(async () => {
    setToday(toKey(new Date()));
    const fresh = await loadData(db);
    setData(fresh);
    // Rappels du soir : reprogrammés selon l'état des journées (sans bloquer l'affichage).
    void loadSettings(db).then((s) => syncReminders(fresh, parseReminderSettings(s)));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { db, data, today, reload };
}
