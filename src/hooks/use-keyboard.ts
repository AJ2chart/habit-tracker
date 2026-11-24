import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, TextInput } from 'react-native';

/**
 * Hauteur actuelle du clavier (0 quand il est fermé).
 * Sur Android en plein écran, le système ne redimensionne pas les fenêtres :
 * on décale nous-mêmes le contenu de cette hauteur.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
type Scrollable = { scrollTo: (o: { y: number; animated?: boolean }) => void } | null;

/**
 * Garde le champ en cours de saisie au-dessus du clavier, pour tous les champs d'un écran défilant.
 * - à l'ouverture du clavier, puis de nouveau un peu après (le temps que la marge du bas soit appliquée) ;
 * - quand on passe d'un champ à un autre clavier ouvert (un champ qui apparaît au toucher, par exemple).
 * `lift` : hauteur couverte par le clavier, barre de navigation comprise ; `offset` : position de défilement actuelle.
 */
export function useKeepFocusedInputVisible(lift: number, scrollRef: RefObject<Scrollable>, offset: RefObject<number>) {
  const liftRef = useRef(lift);
  liftRef.current = lift;

  useEffect(() => {
    if (!lift) return;
    const reveal = () => {
      const input = TextInput.State.currentlyFocusedInput() as unknown as Measurable | null;
      input?.measureInWindow?.((_x, y, _w, h) => {
        if (!liftRef.current) return;
        const visibleBottom = Dimensions.get('window').height - liftRef.current - 16;
        // Un champ très haut (note longue) : on montre au moins ses premières lignes.
        const bottom = y + Math.min(h, 160);
        if (bottom > visibleBottom) scrollRef.current?.scrollTo({ y: (offset.current ?? 0) + bottom - visibleBottom, animated: true });
      });
    };
    const later = (ms: number[]) => ms.map((d) => setTimeout(reveal, d));
    let timers = later(Platform.OS === 'android' ? [60, 300] : [260, 450]);
    let last: unknown = TextInput.State.currentlyFocusedInput();
    // Pas d'événement global « un champ a pris le focus » : on regarde régulièrement tant que le clavier est ouvert.
    const watch = setInterval(() => {
      const cur = TextInput.State.currentlyFocusedInput();
      if (cur && cur !== last) {
        last = cur;
        timers.forEach(clearTimeout);
        timers = later([40, 250]);
      }
    }, 150);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(watch);
    };
  }, [lift, scrollRef, offset]);
}
