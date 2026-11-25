import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const noop = () => () => {};

/**
 * Rendu statique (web) : le thème du système n'est connu qu'une fois dans le navigateur ;
 * avant (rendu côté serveur), on renvoie « light ».
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const colorScheme = useRNColorScheme();
  return hydrated ? colorScheme : 'light';
}
