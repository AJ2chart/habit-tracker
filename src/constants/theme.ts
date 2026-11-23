/**
 * Palette de l'appli : noir et blanc pour l'action, une seule couleur (bleu)
 * pour les objectifs et le temps, rouge réservé aux alertes.
 * Les clés text / background / backgroundElement / backgroundSelected /
 * textSecondary sont aussi utilisées par les composants du modèle Expo.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171717',
    textSecondary: '#6E6E6A',
    background: '#F5F5F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDEDEA',
    line: '#E3E3DF',
    accent: '#171717',
    onAccent: '#FFFFFF',
    goal: '#3A66DB',
    goalSoft: '#E4EAF8',
    warn: '#C2553F',
  },
  dark: {
    text: '#EDEDEB',
    textSecondary: '#9A9A95',
    background: '#111111',
    backgroundElement: '#1B1B1B',
    backgroundSelected: '#2A2A28',
    line: '#2E2E2C',
    accent: '#EDEDEB',
    onAccent: '#111111',
    goal: '#7EA0F5',
    goalSoft: '#1E2740',
    warn: '#E07A63',
  },
} as const;

/** Couleurs d'humeur, de Difficile (0) à Super (4) : identiques en clair et en sombre. */
export const MoodColors = ['#C2553F', '#D9883A', '#B9A846', '#6FA86A', '#2C7A68'] as const;
export const MoodLabels = ['Difficile', 'Bof', 'Correct', 'Bien', 'Super'] as const;
export const EnergyLabels = ['Vide', 'Basse', 'Moyenne', 'Bonne', 'Pleine'] as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { card: 14, control: 10, chip: 8 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
