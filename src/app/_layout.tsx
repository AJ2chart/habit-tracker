import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { unlockDatabase } from '@/db/encryption';
import { migrate } from '@/db/schema';
import { useOpenDayFromNotification } from '@/notifications/open-day';
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

// Version web : coupe les mots trop longs pour leur cadre, comme le fait Android (sinon ils débordent).
if (process.env.EXPO_OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'div, span { overflow-wrap: anywhere; }';
  document.head.appendChild(style);
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
