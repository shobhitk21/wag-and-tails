/* Shared native components, ported from js/ui.js.
   Same vocabulary as the web's primitives so a screen reads the same in either
   codebase: Row, Pill, Price, CareNote, Card, Button, StepBar. */
import { forwardRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, ScrollView
} from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';
import { colors, type, radii, space, shadow, toneColor, statusTone, inr } from '@wag/theme';

export { inr };

/* ---------- icons ---------- */
const ICONS = {
  home: 'M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z',
  chev: 'm9 5 7 7-7 7',
  chevD: 'm5 9 7 7 7-7',
  back: 'm15 5-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.6 4.4 4.4L19 7.4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  edit: 'M15.6 4.6 19.4 8.4 8.8 19H5v-3.8ZM13.4 6.8 17.2 10.6',
  filter: 'M4 6.6h16M7 12h10M10 17.4h4',
  logout: 'M15 4.6H6.6v14.8H15M12.6 12h8.2m0 0-3-3m3 3-3 3',
  send: 'M4 20.2 20.6 12 4 3.8l2 8.2ZM6 12h14.6',
  nav: 'M20.6 3.4 3.6 10.6l7.2 2.6 2.6 7.2Z',
  star: 'm12 3.4 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
  heart: 'M12 20.4S3.6 15.6 3.6 9.8A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 10.6-8.4 10.6Z',
  wallet: 'M2.8 5.8h18.4v13.4H2.8ZM2.8 10h18.4'
};

const MULTI = {
  cal: ['M3.2 5h17.6v16H3.2z', 'M8 3v4M16 3v4M3.2 10h17.6'],
  user: ['M12 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z', 'M4.6 20.4c.6-4.1 3.8-6.6 7.4-6.6s6.8 2.5 7.4 6.6'],
  bag: ['M5.4 8h13.2l1 12.4H4.4Z', 'M8.8 8V6a3.2 3.2 0 0 1 6.4 0v2'],
  paw: ['M11.6 12.6c2.9 0 5.2 2.2 5.2 4.6s-2.3 4.8-5.2 4.8-5.2-2.4-5.2-4.8 2.3-4.6 5.2-4.6Z',
        'M6.6 6.6a2 2 0 0 1 2 2.6 2 2 0 0 1-4 0 2 2 0 0 1 2-2.6ZM16.6 6.6a2 2 0 0 1 2 2.6 2 2 0 0 1-4 0 2 2 0 0 1 2-2.6Z'],
  clock: ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z', 'M12 7v5.4l3.4 2'],
  pin: ['M12 21.4s6.8-6.2 6.8-11.4A6.8 6.8 0 0 0 5.2 10c0 5.2 6.8 11.4 6.8 11.4Z', 'M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z'],
  alert: ['M12 3.6 21.4 20H2.6Z', 'M12 10v4M12 16.6v.4'],
  info: ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z', 'M12 11v5.4M12 7.4v.4'],
  bell: ['M12 3.2a5.8 5.8 0 0 0-5.8 5.8v3.6L4 16.4h16l-2.2-3.8V9A5.8 5.8 0 0 0 12 3.2Z', 'M9.6 19a2.5 2.5 0 0 0 4.8 0'],
  cam: ['M2.8 7h18.4v13.4H2.8Z', 'M12 10.2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2ZM8.6 7 10 4h4l1.4 3'],
  phone: ['M6.2 3.4h3l2 4.9-2.2 1.6a12.4 12.4 0 0 0 5.4 5.4l1.6-2.2 4.9 2v3a2 2 0 0 1-2.2 2A17.4 17.4 0 0 1 4.2 5.6a2 2 0 0 1 2-2.2Z'],
  chat: ['M20.6 11.8c0 4.2-3.8 7.6-8.6 7.6a10 10 0 0 1-2.8-.4L4 20.6l1.5-4a7.2 7.2 0 0 1-1.5-4.4c0-4.2 3.8-7.6 8.6-7.6s8 3.4 8 7.2Z'],
  route: ['M8.6 18h5.6a3.8 3.8 0 0 0 0-7.6h-4.4a3.8 3.8 0 0 1 0-7.6', 'M6 15.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM18 3.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z'],
  gift: ['M3.2 8.6h17.6v12.2H3.2Z', 'M3.2 13h17.6M12 8.6v12.2'],
  card: ['M2.8 5.4h18.4v13.2H2.8Z', 'M2.8 10h18.4'],
  doc: ['M6 3.4h7.4L19 9v11.6H6Z', 'M13.2 3.4V9H19M9 13.4h6M9 16.8h4'],
  shield: ['M12 3.2 20 6v6c0 4.6-3.3 8-8 9.6C7.3 20 4 16.6 4 12V6Z', 'm8.8 12.2 2.2 2.2 4.2-4.2'],
  syringe: ['m13.4 4.6 6 6M17 3l4 4M11.6 6.4 17.6 12.4 9 21H3.6v-5.4Z', 'm9.4 10.6 4 4'],
  help: ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z', 'M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .9-1 1.6v.3M12 17v.2'],
  search: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'm16.2 16.2 4.4 4.4'],
  brief: ['M2.8 7.2h18.4v13H2.8Z', 'M8.6 7.2V5.8A2.4 2.4 0 0 1 11 3.4h2a2.4 2.4 0 0 1 2.4 2.4v1.4'],
  /* The two handle loops are circles in the original SVG; drawn here as closed
     arc paths since Ico only ever emits <Path> elements. Without them the
     glyph was rendering as a bare X. */
  scissors: [
    'M6.4 3.8a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z',
    'M6.4 15a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z',
    'M8.6 8.2 20 18.4M8.6 15.8 20 5.6'
  ],
  spark: ['M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 11l5.8-1.9Z']
};

export function Ico({ name, size = 20, color = colors.ink[2] }) {
  const single = ICONS[name];
  const multi = MULTI[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {multi
        ? multi.map((d, i) => (
            <Path key={i} d={d} stroke={color} strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" />
          ))
        : single && (
            <Path d={single} stroke={color} strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" />
          )}
    </Svg>
  );
}

export function StarIcon({ size = 13, filled = true, color = colors.accent[400] }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICONS.star} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6}
        strokeLinejoin="round" opacity={filled ? 1 : 0.28} />
    </Svg>
  );
}

/* ---------- text ---------- */
export const T = {
  Hero: (p) => <Text {...p} style={[type.hero, { color: colors.ink[1] }, p.style]} />,
  H1: (p) => <Text {...p} style={[type.h1, { color: colors.ink[1] }, p.style]} />,
  H2: (p) => <Text {...p} style={[type.h2, { color: colors.ink[1] }, p.style]} />,
  H3: (p) => <Text {...p} style={[type.h3, { color: colors.ink[1] }, p.style]} />,
  Body: (p) => <Text {...p} style={[type.body, { color: colors.ink[2] }, p.style]} />,
  Sm: (p) => <Text {...p} style={[type.sm, { color: colors.ink[2] }, p.style]} />,
  Xs: (p) => <Text {...p} style={[type.xs, { color: colors.ink[3] }, p.style]} />,
  Dim: (p) => <Text {...p} style={[type.sm, { color: colors.ink[3] }, p.style]} />,
  Eyebrow: (p) => <Text {...p} style={[type.eyebrow, { color: colors.ink[3] }, p.style]} />
};

/* ---------- price ----------
   The live price in the display face with the struck MRP beside it, tabular
   figures, MRP at ~59% of the price size. */
export function Price({ now, was, size = 18, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }, style]}>
      <Text style={{
        fontFamily: type.h1.fontFamily, fontSize: size, color: colors.ink[1],
        letterSpacing: -0.4, fontVariant: ['tabular-nums']
      }}>
        {inr(now)}
      </Text>
      {was && was > now ? (
        <Text style={{
          fontFamily: type.body.fontFamily, fontSize: Math.round(size * 0.59),
          color: colors.ink[4], textDecorationLine: 'line-through',
          fontVariant: ['tabular-nums']
        }}>
          {inr(was)}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- pill ---------- */
/* `icon` renders outside the Text node — React Native's <Text> only accepts
   text-like children, so an <Ico> passed as `children` alongside a string
   would silently fail to lay out correctly. */
export function Pill({ children, tone = 'muted', live = false, icon, style }) {
  const c = toneColor[tone] ?? toneColor.muted;
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: c.bg, borderRadius: radii.pill,
      paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start'
    }, style]}>
      {live && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />}
      {icon ? <Ico name={icon} size={11} color={c.fg} /> : null}
      <Text style={{ fontFamily: type.h3.fontFamily, fontSize: 11.5, color: c.fg }}>{children}</Text>
    </View>
  );
}

export function StatusPill({ status }) {
  const tone = statusTone[status] ?? 'muted';
  const live = ['On the way', 'In progress', 'Walking now'].includes(status);
  return <Pill tone={tone} live={live}>{status}</Pill>;
}

export function RatingChip({ value, size = 13 }) {
  if (!value || Number(value) === 0) return <T.Xs>—</T.Xs>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <StarIcon size={size} />
      <Text style={{ fontFamily: type.h3.fontFamily, fontSize: size, color: colors.ink[1] }}>
        {value}
      </Text>
    </View>
  );
}

export function Stars({ value = 0, size = 14, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={onChange ? () => onChange(i) : undefined}
          hitSlop={6} disabled={!onChange}>
          <StarIcon size={size} filled={i <= value} />
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- card ---------- */
export function Card({ children, style, onPress, flat = false }) {
  const body = (
    <View style={[{
      backgroundColor: colors.surface, borderRadius: radii.lg, padding: space[4],
      borderWidth: 1, borderColor: colors.line
    }, !flat && shadow.card, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>{body}</Pressable>;
}

export function SectionHead({ title, action, onAction, style }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: space[3]
    }, style]}>
      <T.H3>{title}</T.H3>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.accent[600] }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- the list row used everywhere ---------- */
export function Row({ icon, iconTone = 'muted', lead, title, subtitle, value, trailing, onPress, chevron = true }) {
  const tone = toneColor[iconTone] ?? toneColor.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space[3],
        paddingVertical: 12, opacity: pressed ? 0.7 : 1
      })}
    >
      {lead}
      {icon && !lead ? (
        <View style={{
          width: 38, height: 38, borderRadius: radii.md, backgroundColor: tone.bg,
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Ico name={icon} size={19} color={tone.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.ink[1] }}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <T.Xs numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</T.Xs> : null}
      </View>
      {value ? <T.Sm style={{ fontFamily: type.h3.fontFamily }}>{value}</T.Sm> : null}
      {trailing}
      {onPress && chevron ? <Ico name="chev" size={17} color={colors.ink[4]} /> : null}
    </Pressable>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

export function KV({ k, v, style }) {
  return (
    <View style={[{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: space[3], paddingVertical: 7
    }, style]}>
      <T.Sm style={{ color: colors.ink[3] }}>{k}</T.Sm>
      <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.ink[1],
        textAlign: 'right', flexShrink: 1 }}>
        {v}
      </Text>
    </View>
  );
}

/* ---------- buttons ----------
   14px radius, not pills — rounded rectangles read more premium and match the
   reference apps. White on brand brown is 12:1; white on marigold is 2.77:1
   and never used, so `accent` is a text-only treatment. */
export function Button({
  title, onPress, variant = 'primary', disabled, loading, icon, style, full = true
}) {
  const palette = {
    primary: { bg: colors.brand[700], fg: colors.white, border: 'transparent' },
    secondary: { bg: colors.surface, fg: colors.ink[1], border: colors.line2 },
    ghost: { bg: 'transparent', fg: colors.brand[700], border: 'transparent' },
    danger: { bg: colors.danger[50], fg: colors.danger[600], border: colors.danger[600] }
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: palette.border === 'transparent' ? 0 : 1,
        borderRadius: radii.btn,
        paddingVertical: 14, paddingHorizontal: space[5],
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        alignSelf: full ? 'stretch' : 'flex-start',
        opacity: disabled ? 0.45 : pressed ? 0.88 : 1
      }, style]}
    >
      {loading ? <ActivityIndicator color={palette.fg} size="small" /> : icon}
      <Text style={{ fontFamily: type.h3.fontFamily, fontSize: 15, color: palette.fg }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill,
        backgroundColor: selected ? colors.brand[700] : colors.surface,
        borderWidth: 1, borderColor: selected ? colors.brand[700] : colors.line2,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1
      }, style]}
    >
      <Text style={{
        ...type.sm, fontFamily: type.h3.fontFamily,
        color: selected ? colors.white : colors.ink[2]
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- care note ----------
   The owner's own sentence, rendered the same on every surface.
   Variants: light (customer), loud (groomer's job sheet), onbrand (walker). */
export function CareNote({ note, petName, by, variant = 'light', style }) {
  if (!note) return null;

  const skin = {
    light: { bg: colors.accent[50], border: colors.accent[100], fg: colors.ink[1], sub: colors.ink[3] },
    loud: { bg: colors.accent[500], border: 'transparent', fg: colors.white, sub: 'rgba(255,255,255,.8)' },
    onbrand: { bg: 'rgba(255,255,255,.09)', border: 'rgba(255,255,255,.16)', fg: colors.white, sub: 'rgba(255,255,255,.75)' }
  }[variant];

  return (
    <View style={[{
      borderRadius: radii.lg, padding: 15,
      backgroundColor: skin.bg, borderWidth: 1, borderColor: skin.border
    }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, opacity: 0.85 }}>
        <Ico name="alert" size={15} color={skin.fg} />
        <Text style={{ ...type.eyebrow, color: skin.fg }}>
          Care note{by ? ` from ${by}` : ''}
        </Text>
      </View>
      <Text style={{
        fontFamily: type.h3.fontFamily, fontSize: 15, lineHeight: 22,
        letterSpacing: -0.1, color: skin.fg
      }}>
        “{note}”
      </Text>
      {petName ? (
        <Text style={{ ...type.xs, color: skin.sub, marginTop: 8 }}>
          Written on {petName}’s profile by the owner.
        </Text>
      ) : null}
    </View>
  );
}

export function Banner({ tone = 'info', icon = 'info', children, style }) {
  const c = toneColor[tone] ?? toneColor.info;
  return (
    <View style={[{
      flexDirection: 'row', gap: 10, padding: 13, borderRadius: radii.md,
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.bg
    }, style]}>
      <Ico name={icon} size={17} color={c.fg} />
      <Text style={{ ...type.xs, color: colors.ink[2], flex: 1, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/* ---------- form ---------- */
export const Field = forwardRef(({ label, hint, error, style, ...rest }, ref) => (
  <View style={style}>
    {label ? <Text style={{ ...type.eyebrow, marginBottom: 7 }}>{label}</Text> : null}
    <TextInput
      ref={ref}
      placeholderTextColor={colors.ink[4]}
      style={{
        backgroundColor: colors.surface, borderWidth: 1,
        borderColor: error ? colors.danger[600] : colors.line2,
        borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12,
        ...type.body, color: colors.ink[1]
      }}
      {...rest}
    />
    {error ? <T.Xs style={{ color: colors.danger[600], marginTop: 5 }}>{error}</T.Xs> : null}
    {hint && !error ? <T.Xs style={{ marginTop: 5 }}>{hint}</T.Xs> : null}
  </View>
));
Field.displayName = 'Field';

/* ---------- progress ---------- */
export function ProgressBar({ value = 0, tone = 'accent', height = 6 }) {
  const c = toneColor[tone] ?? toneColor.accent;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.brand[100], overflow: 'hidden' }}>
      <View style={{
        width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%',
        backgroundColor: c.fg, borderRadius: height
      }} />
    </View>
  );
}

/* Four-step booking flow indicator. */
export function StepBar({ step, total }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{
          flex: 1, height: 4, borderRadius: 4,
          backgroundColor: i < step ? colors.brand[700] : colors.brand[100]
        }} />
      ))}
    </View>
  );
}

/* ---------- states ---------- */
/* The platform spinner, matching the ring the two web consoles use, so
   "working" looks the same on every surface. */
export function Loading({ label }) {
  return (
    <View style={{ padding: space[8], alignItems: 'center', gap: 10 }}>
      <ActivityIndicator size="large" color={colors.brand[700]} />
      {label ? <Text style={{ ...type.xs, color: colors.ink[3] }}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <View style={{ padding: space[6], gap: 12 }}>
      <View style={{
        borderWidth: 1, borderColor: colors.danger[600], backgroundColor: colors.danger[50],
        borderRadius: radii.lg, padding: space[4], gap: 6
      }}>
        <T.H3>Could not load this screen.</T.H3>
        <T.Xs>{String(error?.message ?? error)}</T.Xs>
      </View>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ icon = 'paw', title, subtitle, action, onAction, style }) {
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 30, gap: 6 }, style]}>
      <View style={{
        width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand[50],
        alignItems: 'center', justifyContent: 'center', marginBottom: 10
      }}>
        <Ico name={icon} size={30} color={colors.brand[700]} />
      </View>
      <T.H3>{title}</T.H3>
      {subtitle ? <T.Xs style={{ textAlign: 'center' }}>{subtitle}</T.Xs> : null}
      {action ? <Button title={action} variant="secondary" full={false} onPress={onAction}
        style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

/* Weekday earnings chart. */
export function Bars({ data, height = 110, onDark = false }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d) => (
        <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{
            width: '100%',
            height: Math.max((d.value / max) * (height - 24), 3),
            borderRadius: 6,
            backgroundColor: d.value === 0
              ? (onDark ? 'rgba(255,255,255,.14)' : colors.brand[100])
              : (onDark ? colors.accent[400] : colors.brand[700])
          }} />
          <Text style={{ ...type.xxs, color: onDark ? 'rgba(255,255,255,.6)' : colors.ink[4] }}>
            {d.day}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function Timeline({ steps }) {
  return (
    <View>
      {steps.map((s, i) => {
        const active = s.state === 'now';
        const done = s.state === 'done';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 16 }}>
              <View style={{
                width: 11, height: 11, borderRadius: 6, marginTop: 4,
                backgroundColor: done ? colors.ok[600] : active ? colors.accent[400] : colors.brand[100]
              }} />
              {i < steps.length - 1 && (
                <View style={{
                  flex: 1, width: 2, marginVertical: 3,
                  backgroundColor: done ? colors.ok[600] : colors.brand[100]
                }} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={{
                ...type.sm, fontFamily: type.h3.fontFamily,
                color: done || active ? colors.ink[1] : colors.ink[4]
              }}>
                {s.title}
              </Text>
              {s.detail ? <T.Xs style={{ marginTop: 2 }}>{s.detail}</T.Xs> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  padded: { paddingHorizontal: space[5] },
  gap3: { gap: space[3] },
  gap4: { gap: space[4] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space[3] }
});

export { ScrollView, Svg, Path, Circle, Rect, Ellipse };
