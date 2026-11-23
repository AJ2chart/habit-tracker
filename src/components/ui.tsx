import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useKeyboardHeight } from '@/hooks/use-keyboard';
import { useTheme } from '@/hooks/use-theme';

/** Écran défilant avec titre, sous-titre et boutons optionnels de part et d'autre du titre. */
export function Screen({
  title,
  subtitle,
  left,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const c = useTheme();
  const centered = !!(left || right);
  const insets = useSafeAreaInsets();
  const kbRaw = useKeyboardHeight();
  const kb = kbRaw ? kbRaw + (Platform.OS === 'android' ? insets.bottom : 0) : 0;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);

  // Quand le clavier s'ouvre, fait défiler pour garder le champ en cours de saisie visible.
  useEffect(() => {
    if (!kb) return;
    const t = setTimeout(
      () => {
        const input = TextInput.State.currentlyFocusedInput() as unknown as {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        } | null;
        input?.measureInWindow?.((_x, y, _w, h) => {
          const visibleBottom = Dimensions.get('window').height - kb - Spacing.three;
          const bottom = y + Math.min(h, 160);
          if (bottom > visibleBottom) scrollRef.current?.scrollTo({ y: offset.current + bottom - visibleBottom, animated: true });
        });
      },
      Platform.OS === 'android' ? 60 : 260,
    );
    return () => clearTimeout(t);
  }, [kb]);

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: c.background }]}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.scroll, kb ? { paddingBottom: kb + Spacing.five } : null]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.header, centered && styles.headerRow]}>
          {left}
          <View style={[styles.flex, centered && styles.center]}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
            {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children?: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.line }, style]}>
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const c = useTheme();
  return <Text style={[styles.muted, { color: c.textSecondary }, style]}>{children}</Text>;
}

export function Body({ children, style, numberOfLines }: { children: ReactNode; style?: TextStyle; numberOfLines?: number }) {
  const c = useTheme();
  return (
    <Text style={[styles.body, { color: c.text }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'small';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        variant === 'small' ? styles.btnSmall : styles.btn,
        primary ? { backgroundColor: c.accent } : { borderColor: c.line, borderWidth: 1 },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
        style,
      ]}>
      <Text style={[styles.btnText, variant === 'small' && styles.btnTextSmall, { color: primary ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Bouton icône carré (flèches de navigation). */
export function IconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { borderColor: c.line, backgroundColor: c.backgroundElement }, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.iconGlyph, { color: c.text }]}>{glyph}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  children,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? c.text : c.line, backgroundColor: selected ? c.backgroundSelected : 'transparent' },
        pressed && { opacity: 0.7 },
        style,
      ]}>
      {children}
      <Text style={[styles.chipText, { color: c.text, fontWeight: selected ? '600' : '400' }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textSecondary}
        style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.line }, style]}
        {...props}
      />
    </View>
  );
}

/** Feuille qui monte du bas de l'écran. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useTheme();
  const kb = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  // Sur Android plein écran, la hauteur annoncée du clavier n'inclut pas la barre de navigation du système.
  const lift = kb ? kb + (Platform.OS === 'android' ? insets.bottom : 0) : 0;
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        {/* La feuille remonte au-dessus du clavier, sur iPhone comme sur Android. */}
        <View style={[styles.sheet, { backgroundColor: c.backgroundElement, marginBottom: lift, maxHeight: lift ? Dimensions.get('window').height - lift - 48 : '85%' }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            // Clavier fermé : laisse la place à la barre de navigation du téléphone (ou à la barre d'accueil de l'iPhone).
            contentContainerStyle={[styles.sheetContent, { paddingBottom: Spacing.five + (lift ? 0 : insets.bottom) }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const uiStyles = StyleSheet.create({ hairline: { height: StyleSheet.hairlineWidth } });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: { paddingTop: Spacing.three, gap: Spacing.half },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  muted: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 21 },
  btn: { borderRadius: Radius.control, paddingVertical: 11, paddingHorizontal: Spacing.three, alignItems: 'center' },
  btnSmall: { borderRadius: Radius.chip, paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-start' },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnTextSmall: { fontSize: 13, fontWeight: '500' },
  iconBtn: { width: 38, height: 38, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 20, lineHeight: 22 },
  chip: { borderWidth: 1, borderRadius: Radius.control, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  chipText: { fontSize: 12 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' },
  sheetContent: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
