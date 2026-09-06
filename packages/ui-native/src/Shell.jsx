/* App chrome: the screen wrapper, the top app bar and the bottom tab bar.

   The prototype ran inside a 390×844 device frame that dropped away below
   560px; on a real phone there is no frame, so this is the same layout using
   safe-area insets directly. */
import { View, Text, Pressable, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type, radii, space } from '@wag/theme';
import { Ico } from './primitives.jsx';

/* A screen with the brand-coloured header treatment, or the plain canvas. */
export function Screen({ children, onBrand = false, style, edges = ['top'] }) {
  return (
    <>
      <StatusBar barStyle={onBrand ? 'light-content' : 'dark-content'}
        backgroundColor={onBrand ? colors.brand[700] : colors.canvas} />
      <SafeAreaView
        edges={edges}
        style={[{ flex: 1, backgroundColor: onBrand ? colors.brand[700] : colors.canvas }, style]}
      >
        {children}
      </SafeAreaView>
    </>
  );
}

export function AppBar({ title, subtitle, onBack, right, onBrand = false, border = true }) {
  const fg = onBrand ? colors.white : colors.ink[1];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space[3],
      paddingHorizontal: space[4], paddingVertical: 12,
      backgroundColor: onBrand ? colors.brand[700] : colors.canvas,
      borderBottomWidth: border && !onBrand ? 1 : 0,
      borderBottomColor: colors.line
    }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Ico name="back" size={22} color={fg} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...type.h2, color: fg }}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{
            ...type.xs, marginTop: 2,
            color: onBrand ? 'rgba(255,255,255,.72)' : colors.ink[3]
          }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* Body scroller with the bottom inset the tab bar needs. */
export function Body({ children, refreshing, onRefresh, style, contentStyle, horizontalPadding = space[5] }) {
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{
        paddingHorizontal: horizontalPadding,
        paddingTop: space[4],
        paddingBottom: space[8]
      }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );
}

/* A sticky action dock. The Build Book records a bleed-through bug where
   content showed under the dock, so this paints an opaque background and
   carries the bottom safe-area inset itself. */
export function Dock({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      paddingHorizontal: space[5],
      paddingTop: space[3],
      paddingBottom: Math.max(insets.bottom, space[3]),
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.line
    }}>
      {children}
    </View>
  );
}

export function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingBottom: Math.max(insets.bottom, 6),
      paddingTop: 8
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const badge = options.tabBarBadge;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }}
          >
            <View>
              <Ico
                name={options.tabBarIconName ?? 'home'}
                size={22}
                color={focused ? colors.brand[700] : colors.ink[4]}
              />
              {badge ? (
                <View style={{
                  position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16,
                  borderRadius: 8, backgroundColor: colors.accent[400],
                  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4
                }}>
                  <Text style={{ ...type.xxs, color: colors.white, fontSize: 9.5 }}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{
              ...type.xxs,
              fontFamily: focused ? type.h3.fontFamily : type.xxs.fontFamily,
              color: focused ? colors.brand[700] : colors.ink[4]
            }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Transient confirmation, 2.4s, matching toast() in the prototype. */
export function Toast({ message }) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', left: space[5], right: space[5],
        bottom: insets.bottom + 78,
        backgroundColor: colors.brand[800], borderRadius: radii.md,
        paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center', gap: 9
      }}
    >
      <Ico name="check" size={16} color={colors.white} />
      <Text style={{ ...type.sm, color: colors.white, flex: 1 }}>{message}</Text>
    </View>
  );
}

/* Bottom sheet, used for the booking summary, the bill and confirm dialogs. */
export function Sheet({ visible, title, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end' }}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(27,10,3,.45)' }}
      />
      <View style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
        paddingHorizontal: space[5], paddingTop: space[4],
        paddingBottom: Math.max(insets.bottom, space[4]),
        maxHeight: '85%'
      }}>
        <View style={{
          alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
          backgroundColor: colors.line2, marginBottom: space[4]
        }} />
        {title ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: space[3]
          }}>
            <Text style={{ ...type.h2 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ico name="close" size={20} color={colors.ink[3]} />
            </Pressable>
          </View>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        {footer ? <View style={{ marginTop: space[4] }}>{footer}</View> : null}
      </View>
    </View>
  );
}
