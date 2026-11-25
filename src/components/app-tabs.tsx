import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Icônes au trait fin, reprises des dessins du prototype (assets/images/tabIcons). */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.backgroundSelected}
      tintColor={colors.text}
      labelStyle={{ selected: { color: colors.text } }}
      // Noms visibles sous toutes les icônes, comme dans le prototype (Android).
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Aujourd’hui</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/today.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="semaine">
        <NativeTabs.Trigger.Label>Semaine</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/week.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="objectifs">
        <NativeTabs.Trigger.Label>Objectifs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/goals.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/journal.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reglages">
        <NativeTabs.Trigger.Label>Réglages</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/settings.png')} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
