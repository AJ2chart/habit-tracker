import { useState } from 'react';

/**
 * Réinitialise un état quand une valeur change (autre jour, feuille rouverte…), pendant le rendu,
 * comme le recommande React (« ajuster l'état quand une prop change ») au lieu d'un effet
 * qui provoquerait un second rendu. `reset` ne doit appeler que des setState du composant.
 * Appelé aussi au premier rendu.
 */
export function useOnChange<T>(value: T, reset: () => void) {
  const [prev, setPrev] = useState<{ v: T } | null>(null);
  if (!prev || !Object.is(prev.v, value)) {
    setPrev({ v: value });
    reset();
  }
}
