import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View, type PressableProps } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Aujourd&apos;hui</TabButton>
          </TabTrigger>
          <TabTrigger name="semaine" href="/semaine" asChild>
            <TabButton>Semaine</TabButton>
          </TabTrigger>
          <TabTrigger name="objectifs" href="/objectifs" asChild>
            <TabButton>Objectifs</TabButton>
          </TabTrigger>
          <TabTrigger name="journal" href="/journal" asChild>
            <TabButton>Journal</TabButton>
          </TabTrigger>
          <TabTrigger name="reglages" href="/reglages" asChild>
            <TabButton>Réglages</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const narrow = useWindowDimensions().width < 640;
  return (
    // Les props du déclencheur d'onglet ne correspondent pas exactement à celles de Pressable avec React 19.3.
    <Pressable
      {...(props as unknown as PressableProps)}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, narrow && { paddingHorizontal: Spacing.two }]}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** Barre d'onglets de la version web : le nom de l'appli n'apparaît que s'il y a la place. */
export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const narrow = width < 640;
  return (
    <View {...props} style={[styles.tabListContainer, narrow && styles.tabListNarrow]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, narrow && styles.innerNarrow]}>
        {narrow ? null : (
          <ThemedText type="smallBold" style={styles.brandText}>
            Carnet d&apos;aube
          </ThemedText>
        )}
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  tabListNarrow: {
    padding: Spacing.two,
  },
  innerNarrow: {
    flexShrink: 1,
    width: '100%',
    paddingHorizontal: Spacing.two,
    gap: 2,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
