import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { unlockDatabase } from '@/db/encryption';
import { migrate } from '@/db/schema';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Ouverture de la base : déverrouillage (chiffrement) puis mise à jour du schéma. */
async function initDatabase(db: SQLiteDatabase) {
  await unlockDatabase(db);
  await migrate(db);
  // Contrôle visuel (version web seulement) : `?seed=extreme` ou `?seed=empty` charge des données de test.
  if (process.env.EXPO_OS === 'web' && typeof location !== 'undefined') {
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) await (await import('@/db/test-seed')).seedForTests(db, seed);
  }
}

SplashScreen.preventAutoHideAsync();

/** Toucher un rappel ouvre la journée concernée dans Aujourd'hui (appli ouverte ou lancée par la notification). */
function useOpenDayFromNotification() {
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

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useOpenDayFromNotification();
  return (
    // Gestion du clavier pour toute l'appli (voir AGENTS.md, « Clavier et champs de saisie »).
    <KeyboardProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<Loading />}>
        {/* Base locale, chiffrée dans la version installable (en clair dans Expo Go). */}
        <SQLiteProvider databaseName="habit-tracker.db" onInit={initDatabase} useSuspense>
          <AnimatedSplashOverlay />
          <AppTabs />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
    </KeyboardProvider>
  );
}
