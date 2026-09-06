/* The walk map.

   Generated imagery, as the Build Book records — no tiles, no provider. The web
   drew this as an SVG with the pet ring travelling along `offset-path`; React
   Native has no offset-path, so the marker's position is sampled off the same
   path data with getPointAtLength and the ring is placed there absolutely.
   Same route, same motion. */
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Path, Circle, G } from 'react-native-svg';
import { colors, radii, type } from '@wag/theme';
import { Ring } from './Ring.jsx';

/* The route the prototype drew, unchanged. */
export const ROUTE_D =
  'M40 260 C 70 210, 96 208, 118 178 S 158 120, 196 116 C 236 112, 252 148, 286 152 C 314 155, 328 128, 336 96';

const VB_W = 390;
const VB_H = 300;

/* Cubic and smooth-cubic segments of ROUTE_D, flattened once into points so a
   position along the route can be looked up without a DOM. */
function buildRoutePoints(steps = 240) {
  const segs = [
    { p0: [40, 260], p1: [70, 210], p2: [96, 208], p3: [118, 178] },
    { p0: [118, 178], p1: [140, 148], p2: [158, 120], p3: [196, 116] },
    { p0: [196, 116], p1: [236, 112], p2: [252, 148], p3: [286, 152] },
    { p0: [286, 152], p1: [314, 155], p2: [328, 128], p3: [336, 96] }
  ];
  const pts = [];
  for (const s of segs) {
    for (let i = 0; i <= steps / segs.length; i += 1) {
      const t = i / (steps / segs.length);
      const u = 1 - t;
      const x = u * u * u * s.p0[0] + 3 * u * u * t * s.p1[0] + 3 * u * t * t * s.p2[0] + t * t * t * s.p3[0];
      const y = u * u * u * s.p0[1] + 3 * u * u * t * s.p1[1] + 3 * u * t * t * s.p2[1] + t * t * t * s.p3[1];
      pts.push([x, y]);
    }
  }
  return pts;
}

const ROUTE_POINTS = buildRoutePoints();

export function pointAt(progress) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const i = Math.min(Math.round(clamped * (ROUTE_POINTS.length - 1)), ROUTE_POINTS.length - 1);
  return ROUTE_POINTS[i];
}

export function MapView({ pet, progress = 0, height = 260, chip, overlay, style, markerSize = 46 }) {
  const [px, py] = useMemo(() => pointAt(progress), [progress]);
  const clamped = Math.max(0, Math.min(1, progress));

  /* The route is drawn as one dashed stroke whose offset retreats as the walk
     advances, so the travelled part reads solid. */
  const routeLength = 900;

  return (
    <View style={[{
      height, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#EBE1D4'
    }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Rect width={VB_W} height={VB_H} fill="#EBE1D4" />

        {/* roads */}
        <G stroke="#FCF8F3" strokeWidth={17}>
          <Path d="M-10 60h410M-10 210h410M90 -10v320M250 -10v320" />
        </G>
        <G stroke="#FCF8F3" strokeWidth={10}>
          <Path d="M-10 130h410M170 -10v320M320 -10v320" />
        </G>

        {/* blocks */}
        <G fill="#E0D4C3">
          <Rect x="10" y="70" width="66" height="48" rx="7" />
          <Rect x="106" y="72" width="50" height="44" rx="7" />
          <Rect x="186" y="70" width="52" height="48" rx="7" />
          <Rect x="266" y="76" width="42" height="40" rx="7" />
          <Rect x="332" y="70" width="50" height="48" rx="7" />
          <Rect x="10" y="146" width="66" height="52" rx="7" />
          <Rect x="266" y="146" width="42" height="52" rx="7" />
          <Rect x="332" y="146" width="50" height="52" rx="7" />
          <Rect x="10" y="222" width="120" height="60" rx="7" />
          <Rect x="150" y="222" width="90" height="60" rx="7" />
          <Rect x="262" y="222" width="120" height="60" rx="7" />
        </G>

        {/* park */}
        <G fill="#D3E0C8">
          <Rect x="106" y="146" width="50" height="52" />
          <Rect x="186" y="146" width="52" height="52" />
        </G>
        <Circle cx="131" cy="172" r="10" fill="#C0D3B3" />
        <Circle cx="212" cy="168" r="13" fill="#C0D3B3" />

        {/* the route: ghost behind, travelled portion on top */}
        <Path d={ROUTE_D} fill="none" stroke="rgba(74,30,11,.16)" strokeWidth={5}
          strokeLinecap="round" strokeDasharray="8 9" />
        <Path
          d={ROUTE_D}
          fill="none"
          stroke={colors.accent[400]}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={routeLength}
          strokeDashoffset={routeLength * (1 - clamped)}
        />

        {/* pickup pin */}
        <Circle cx="40" cy="260" r="7" fill={colors.brand[700]} stroke="#fff" strokeWidth={3} />
      </Svg>

      {/* The pet ring is the map marker — the same component, not a lookalike. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${(px / VB_W) * 100}%`,
          top: `${(py / VB_H) * 100}%`,
          marginLeft: -markerSize / 2,
          marginTop: -markerSize / 2
        }}
      >
        <Ring pet={pet} size={markerSize} state="progress" progress={clamped} />
      </View>

      {chip ? (
        <View style={{
          position: 'absolute', top: 12, left: 12, backgroundColor: colors.surface,
          borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7,
          shadowColor: '#2B1206', shadowOpacity: 0.14, shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 }, elevation: 3
        }}>
          <Text style={{ ...type.xs, fontFamily: type.h3.fontFamily, color: colors.ink[1] }}>
            {chip}
          </Text>
        </View>
      ) : null}

      {overlay}
    </View>
  );
}

/* Photo placeholder — before/after shots are generated illustrations too. */
export function PhotoTile({ seed = '', size = 96, radius = radii.md }) {
  const hash = String(seed).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const tones = [
    ['#F6EDE3', '#DCC3A9'], ['#EAF1EC', '#B9D2C2'],
    ['#F4EAF1', '#DCC0D2'], ['#EAEFF5', '#BFD0E0']
  ][hash % 4];

  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width="100" height="100" fill={tones[0]} />
        <Circle cx="50" cy="42" r="22" fill={tones[1]} />
        <Path d="M14 100c6-22 18-32 36-32s30 10 36 32Z" fill={tones[1]} />
        <Circle cx="42" cy="38" r="3" fill="#26170F" opacity={0.55} />
        <Circle cx="58" cy="38" r="3" fill="#26170F" opacity={0.55} />
      </Svg>
    </View>
  );
}

/* Product illustrations, matching the 15 types in the web's ProductSvg. */
const PROD_TONES = [
  { bg: '#F6EDE3', a: '#4A1E0B', b: '#E86A1C' },
  { bg: '#EAF1EC', a: '#1F5C3D', b: '#4C9B72' },
  { bg: '#F4EAF1', a: '#5B2545', b: '#B0648E' },
  { bg: '#EAEFF5', a: '#1F3F5C', b: '#5B8CB8' }
];

export function ProductArt({ art = 'bottle', tone = 0, size = 96 }) {
  const t = PROD_TONES[tone % PROD_TONES.length];
  const shapes = {
    bottle: <><Rect x="46" y="34" width="28" height="60" rx="9" fill={t.a} /><Rect x="52" y="22" width="16" height="14" rx="4" fill={t.b} /><Rect x="50" y="52" width="20" height="24" rx="4" fill={t.bg} opacity={0.85} /></>,
    spray: <><Rect x="48" y="46" width="26" height="48" rx="8" fill={t.a} /><Rect x="54" y="30" width="12" height="18" rx="3" fill={t.b} /><Path d="M54 30h-14l-4-8h18Z" fill={t.b} /></>,
    tub: <><Rect x="36" y="48" width="48" height="38" rx="8" fill={t.a} /><Rect x="32" y="38" width="56" height="14" rx="6" fill={t.b} /><Circle cx="60" cy="68" r="10" fill={t.bg} opacity={0.85} /></>,
    brush: <><Rect x="40" y="30" width="40" height="34" rx="8" fill={t.a} /><Rect x="52" y="62" width="16" height="30" rx="7" fill={t.b} /></>,
    comb: <><Rect x="34" y="40" width="52" height="14" rx="6" fill={t.a} /><Rect x="48" y="78" width="24" height="12" rx="6" fill={t.b} /></>,
    clipper: <><Path d="M42 34c-6 8-6 22 2 32l16 20 16-20c8-10 8-24 2-32" fill="none" stroke={t.a} strokeWidth={9} strokeLinecap="round" /><Circle cx="60" cy="86" r="8" fill={t.b} /></>,
    kit: <><Rect x="30" y="52" width="34" height="14" rx="7" fill={t.a} /><Rect x="60" y="54" width="30" height="10" rx="5" fill={t.b} /><Rect x="26" y="46" width="14" height="26" rx="6" fill={t.b} /></>,
    harness: <><Rect x="34" y="42" width="52" height="26" rx="10" fill={t.a} /><Circle cx="60" cy="55" r="8" fill={t.bg} /><Path d="M46 68v14M74 68v14" stroke={t.a} strokeWidth={6} strokeLinecap="round" /></>,
    leash: <><Path d="M34 84c14-30 38-30 52 0" stroke={t.a} strokeWidth={8} fill="none" strokeLinecap="round" /><Circle cx="34" cy="84" r="10" fill="none" stroke={t.b} strokeWidth={7} /></>,
    bag: <><Path d="M38 40h44l6 52H32Z" fill={t.a} /><Path d="M38 40c4-8 8-12 22-12s18 4 22 12" fill={t.b} /><Rect x="44" y="58" width="32" height="22" rx="4" fill={t.bg} opacity={0.85} /></>,
    chew: <>{[0, 1, 2].map((i) => <Rect key={i} x={34 + i * 8} y={34 + i * 6} width="14" height="52" rx="7" fill={i === 1 ? t.b : t.a} />)}</>,
    rope: <><Path d="M32 60c10-14 24-14 28 0s18 14 28 0" stroke={t.a} strokeWidth={13} fill="none" strokeLinecap="round" /><Circle cx="32" cy="60" r="9" fill={t.b} /><Circle cx="88" cy="60" r="9" fill={t.b} /></>,
    ball: <><Circle cx="48" cy="66" r="20" fill={t.a} /><Circle cx="76" cy="48" r="14" fill={t.b} /></>,
    mat: <><Rect x="26" y="44" width="68" height="42" rx="10" fill={t.a} /><Rect x="34" y="52" width="52" height="26" rx="6" fill={t.b} opacity={0.5} /></>,
    flask: <><Rect x="48" y="30" width="24" height="46" rx="8" fill={t.a} /><Path d="M40 78h40l-4 16H44Z" fill={t.b} /><Rect x="54" y="20" width="12" height="12" rx="4" fill={t.b} /></>
  };

  return (
    <View style={{ width: size, height: size, borderRadius: radii.md, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Rect width="120" height="120" fill={t.bg} />
        {shapes[art] ?? shapes.bottle}
      </Svg>
    </View>
  );
}
