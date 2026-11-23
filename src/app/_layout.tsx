import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { unlockDatabase } from '@/db/encryption';
import { migrate } from '@/db/schema';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Ouverture de la base : déverrouillage (chiffrement) puis mise à jour du schéma. */
async function initDatabase(db: SQLiteDatabase) {
  await unlockDatabase(db);
  await migrate(db);
}

SplashScreen.preventAutoHideAsync();

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<Loading />}>
        {/* Base locale, chiffrée dans la version installable (en clair dans Expo Go). */}
        <SQLiteProvider databaseName="habit-tracker.db" onInit={initDatabase} useSuspense>
          <AnimatedSplashOverlay />
          <AppTabs />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
