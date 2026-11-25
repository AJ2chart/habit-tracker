import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

/** Toucher un rappel ouvre la journée concernée dans Aujourd'hui (appli ouverte ou lancée par la notification). */
export function useOpenDayFromNotification() {
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const day = r?.notification.request.content.data?.day;
      if (typeof day === 'string') router.navigate({ pathname: '/', params: { day, t: String(Date.now()) } });
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
