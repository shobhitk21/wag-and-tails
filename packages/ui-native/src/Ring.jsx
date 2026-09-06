/* The pet avatar ring — the product's signature element, carried across every
   surface. States: idle biscuit, active marigold pulse, progress marigold arc,
   searching spinner, done green. It doubles as the map marker.

   The web draws the pulse with a CSS animation; React Native has no CSS, so
   the same motion comes from Animated here. */
import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Pressable } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Rect, Ellipse, Path, G } from 'react-native-svg';
import { colors, ringStates } from '@wag/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* The pet portrait. Ear types: drop, fluff, prick. */
export function DogSvg({ art = {}, size = 64 }) {
  const a = {
    bg1: '#E9CBA0', bg2: '#C2914F', coat: '#F5E7D6', coatDark: '#C68B4A',
    ear: 'drop', ear2: '#8B4E22', muzzle: '#FFF7EC', id: 'p', ...art
  };
  const gid = `bg${a.id}`;

  const ears =
    a.ear === 'drop' ? (
      <>
        <Path d="M23 42c-8 5-10 22-4 33 5 9 14 8 16 1 2-8-3-20-3-27 0-6-3-10-9-7Z" fill={a.ear2} />
        <Path d="M77 42c8 5 10 22 4 33-5 9-14 8-16 1-2-8 3-20 3-27 0-6 3-10 9-7Z" fill={a.ear2} />
      </>
    ) : a.ear === 'fluff' ? (
      <>
        <Path d="M20 45c-7 9-6 26 2 34 8 8 17 3 18-5 1-9-4-17-7-25-2-7-9-10-13-4Z" fill={a.ear2} />
        <Path d="M80 45c7 9 6 26-2 34-8 8-17 3-18-5-1-9 4-17 7-25 2-7 9-10 13-4Z" fill={a.ear2} />
        <Path d="M35 23c7-7 23-7 30 0 5 5-4 9-15 9s-20-4-15-9Z" fill={a.ear2} />
      </>
    ) : (
      <>
        <Path d="M25 43 20 12l25 15-20 16Z" fill={a.ear2} />
        <Path d="M75 43 80 12 55 27l20 16Z" fill={a.ear2} />
        <Path d="M28 39 26 21l13 8-11 10Z" fill={a.coatDark} opacity={0.5} />
        <Path d="M72 39 74 21l-13 8 11 10Z" fill={a.coatDark} opacity={0.5} />
      </>
    );

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a.bg1} />
          <Stop offset="1" stopColor={a.bg2} />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${gid})`} />
      {ears}
      <Ellipse cx="50" cy="53" rx="27" ry="28" fill={a.coat} />
      <Path d="M50 25c-9 0-17 5-20 13 5-5 12-7 20-7s15 2 20 7c-3-8-11-13-20-13Z"
        fill={a.coatDark} opacity={0.45} />
      <Ellipse cx="50" cy="68" rx="15" ry="12" fill={a.muzzle} />
      <Ellipse cx="50" cy="62" rx="6" ry="4.6" fill="#26170F" />
      <Path d="M50 67v4m0 0c-2.6 3-7.2 2.6-8.2-.5M50 71c2.6 3 7.2 2.6 8.2-.5"
        stroke="#26170F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Ellipse cx="38.5" cy="49" rx="4.7" ry="5.3" fill="#26170F" />
      <Ellipse cx="61.5" cy="49" rx="4.7" ry="5.3" fill="#26170F" />
      <Circle cx="40.3" cy="47.1" r="1.7" fill="#fff" />
      <Circle cx="63.3" cy="47.1" r="1.7" fill="#fff" />
    </Svg>
  );
}

const CIRCUMFERENCE = 2 * Math.PI * 45; // r = 45 on a 100×100 viewBox

export function Ring({
  pet, size = 64, state = 'idle', progress = 0, onPress, badge, style
}) {
  const spec = ringStates[state] ?? ringStates.idle;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'active') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    if (state === 'searching') {
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => loop.stop();
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clamped);

  const inset = size * 0.09;
  const media = size - inset * 2;

  const content = (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* The pulse is a second ring fading outward, matching the web's keyframes. */}
      {state === 'active' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            borderWidth: 2, borderColor: colors.accent[400],
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }]
          }}
        />
      )}

      <Animated.View
        style={{
          position: 'absolute', width: size, height: size,
          transform: state === 'searching'
            ? [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
            : []
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="45" fill="none"
            stroke={colors.brand[100]} strokeWidth={spec.width} />
          {(state === 'progress' || state === 'searching' || state === 'done') && (
            <AnimatedCircle
              cx="50" cy="50" r="45" fill="none"
              stroke={spec.stroke}
              strokeWidth={spec.width}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={state === 'searching' ? CIRCUMFERENCE * 0.75 : dashOffset}
              transform="rotate(-90 50 50)"
            />
          )}
          {(state === 'idle' || state === 'active') && (
            <Circle cx="50" cy="50" r="45" fill="none"
              stroke={spec.stroke} strokeWidth={spec.width} />
          )}
        </Svg>
      </Animated.View>

      <View style={{
        width: media, height: media, borderRadius: media / 2, overflow: 'hidden',
        backgroundColor: colors.brand[50]
      }}>
        <DogSvg art={pet?.art} size={media} />
      </View>

      {badge ? (
        <View style={{
          position: 'absolute', right: -2, bottom: -2, backgroundColor: colors.accent[400],
          borderRadius: 999, padding: 4, borderWidth: 2, borderColor: colors.surface
        }}>
          {badge}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={pet?.name}>
      {content}
    </Pressable>
  );
}

/* The dashed "add a pet" ring. */
export function AddRing({ size = 64, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add a pet"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Circle cx="50" cy="50" r="45" fill="none" stroke={colors.brand[300]}
          strokeWidth="3" strokeDasharray="7 7" />
      </Svg>
      <Svg width={size * 0.34} height={size * 0.34} viewBox="0 0 24 24">
        <Path d="M12 5v14M5 12h14" stroke={colors.brand[700]} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

/* Partner and staff avatar. */
export function PersonAvatar({ name = '', from = colors.accent[400], to = colors.accent[700], size = 44 }) {
  const id = `pa${String(name).replace(/\W/g, '')}`;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
        <Circle cx="50" cy="39" r="17" fill="rgba(255,255,255,.9)" />
        <Path d="M17 93c3-19 16-29 33-29s30 10 33 29Z" fill="rgba(255,255,255,.9)" />
      </Svg>
    </View>
  );
}

export const partnerArt = (kind) =>
  kind === 'Walker' ? ['#1F7A4D', '#0E4229'] : ['#F07B2C', '#A8480C'];

export { G };
