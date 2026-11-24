import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  isDayFilled,
  isMorningDone,
  morningMessage,
  plannedMorning,
  plannedReminders,
  type Data,
  type MorningSettings,
  type ReminderSettings,
} from '@/logic';

const CHANNEL = 'evening-reminder';
const PREFIX = 'reminder-';
const MORNING = 'morning-';

/** Affiche les notifications même quand l'appli est ouverte. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Rappels du matin et du soir',
    description: 'Rappelle de noter la nuit et de remplir la journée.',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Demande l'autorisation d'envoyer des notifications ; renvoie true si elle est accordée. */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel(); // Android : le canal doit exister avant la demande.
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function hasReminderPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

let running: Promise<void> | null = null;

/**
 * Reprogramme les rappels des 7 prochains jours d'après les données actuelles,
 * et retire de l'écran les rappels d'une journée qui vient d'être remplie.
 * Appelée à chaque rechargement des données ; les appels simultanés sont regroupés.
 */
export function syncReminders(data: Data, settings: ReminderSettings, morning: MorningSettings): Promise<void> {
  const job = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.identifier.startsWith(PREFIX) || n.identifier.startsWith(MORNING))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );

      // Rappels déjà affichés pour une journée maintenant remplie (ou rappels désactivés) : on les retire.
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const n of presented) {
        const day = n.request.content.data?.day as string | undefined;
        const id = n.request.identifier;
        if (!day) continue;
        if (id.startsWith(PREFIX) && (!settings.enabled || isDayFilled(data, day, settings.criteria))) await Notifications.dismissNotificationAsync(id);
        if (id.startsWith(MORNING) && (!morning.enabled || isMorningDone(data, day, morning))) await Notifications.dismissNotificationAsync(id);
      }

      if ((!settings.enabled && !morning.enabled) || !(await hasReminderPermission())) return;
      await ensureChannel();
      for (const { day, at } of plannedMorning(data, morning, new Date())) {
        const msg = morningMessage(data, day, morning);
        await Notifications.scheduleNotificationAsync({
          identifier: `${MORNING}${day}`,
          content: { title: msg.title, body: msg.body, data: { day }, sticky: morning.sticky, autoDismiss: !morning.sticky },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
      for (const { day, at } of plannedReminders(data, settings, new Date())) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${day}-${at.getHours()}${String(at.getMinutes()).padStart(2, '0')}`,
          content: {
            title: 'Ta journée n’est pas encore remplie',
            body: 'Quelques secondes : humeur, énergie, une note. Touche pour l’ouvrir.',
            data: { day },
            sticky: true, // Android : impossible à balayer ; disparaît quand la journée est remplie.
            autoDismiss: false,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
    } catch {
      // Les rappels ne doivent jamais empêcher l'appli de fonctionner.
    }
  };
  running = (running ?? Promise.resolve()).then(job);
  return running;
}
