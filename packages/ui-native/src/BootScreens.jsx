/* Splash, onboarding, phone and OTP — the four boot screens, shared by both
   apps with their own copy passed in. */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, TextInput } from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space } from '@wag/theme';
import { Screen, AppBar, Body, Dock } from './Shell.jsx';
import { Button, Field, T, Ico, Loading, Chip } from './primitives.jsx';
import { useAuth } from './auth.jsx';

/* The logo: dog standing behind, cat sitting in front on a ground arc.
   The cat carries a brown halo so it separates from the dog. */
export function LogoMark({ size = 96, ink = '#FFFFFF', ground = '#4A1E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <G fill={ink}>
        <Path d="M176 92c22 0 32 24 30 54-2 24-4 42-4 60h-42c0-20-2-38-6-58-5-26-2-56 22-56Z" />
        <Path d="M161 54h32l5 54c0 9-34 11-35 3Z" />
        <Ellipse cx="176" cy="54" rx="30" ry="27" />
        <Ellipse cx="206" cy="64" rx="17" ry="12.5" />
        <Path d="M152 32c-15 9-22 30-18 50 3 14 12 21 18 16-7-22-7-46 4-62 2-4-1-6-4-4Z" />
        <Path fill="none" stroke={ink} strokeWidth={17} strokeLinecap="round"
          d="M162 150c-36-6-74 10-88 44" />
      </G>
      <Circle fill={ground} cx="183" cy="49" r="6.5" />
      <Circle fill={ground} cx="220" cy="62" r="4.5" />
      <G transform="translate(-12,4)">
        <Path fill={ink} stroke={ground} strokeWidth={11} strokeLinejoin="round"
          d="M110 130l-6-26c-1-5 3-8 7-5l18 14c8-3 17-3 25 0l18-14c4-3 8 0 7 5l-6 26c9 10 13 24 9 37-3 10-7 19-7 29 0 5 1 10 2 15h-64c2-9 3-19 2-28-1-8-4-15-5-23-2-12 2-24 10-33Z" />
        <Path fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round"
          d="M170 194c15-3 24-15 21-29" />
        <Circle fill={ground} cx="129" cy="146" r="4.5" />
        <Circle fill={ground} cx="153" cy="146" r="4.5" />
      </G>
      <Path fill={ink} d="M16 210c50-14 158-14 208 0-50 9-158 9-208 0Z" />
    </Svg>
  );
}

export function LogoLockup({ width = 220, ink = '#FFFFFF', ground = '#4A1E0B' }) {
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <LogoMark size={Math.round(width * 0.6)} ink={ink} ground={ground} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          fontFamily: type.hero.fontFamily, fontSize: Math.round(width * 0.132),
          color: ink, letterSpacing: 0.5
        }}>
          WAG &amp; TAILS
        </Text>
        <Text style={{
          fontSize: Math.round(width * 0.048), letterSpacing: 5,
          color: ink, opacity: 0.6, marginTop: 9
        }}>
          EST. 2022
        </Text>
      </View>
    </View>
  );
}

export function SplashScreen({ navigation }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const t = setTimeout(() => navigation.replace('Onboard'), 1400);
    return () => clearTimeout(t);
  }, [fade, navigation]);

  return (
    <Screen onBrand edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
        <LogoLockup width={240} />
      </Animated.View>
    </Screen>
  );
}

export function OnboardScreen({ navigation, slides }) {
  const [i, setI] = useState(0);
  const last = i === slides.length - 1;

  return (
    <Screen onBrand edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'space-between', padding: space[6] }}>
        <View style={{ alignItems: 'center', marginTop: space[7] }}>
          <LogoMark size={72} />
        </View>

        <View style={{ gap: space[3] }}>
          <Text style={{ ...type.hero, color: colors.white, fontSize: 32 }}>
            {slides[i].title}
          </Text>
          <Text style={{ ...type.body, color: 'rgba(255,255,255,.75)', fontSize: 16, lineHeight: 24 }}>
            {slides[i].body}
          </Text>
        </View>

        <View style={{ gap: space[4] }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {slides.map((_, n) => (
              <View key={n} style={{
                height: 4, flex: 1, borderRadius: 2,
                backgroundColor: n <= i ? colors.accent[400] : 'rgba(255,255,255,.2)'
              }} />
            ))}
          </View>
          <Button
            title={last ? 'Get started' : 'Next'}
            onPress={() => (last ? navigation.replace('Phone') : setI(i + 1))}
            style={{ backgroundColor: colors.white }}
          />
          {!last ? (
            <Pressable onPress={() => navigation.replace('Phone')} hitSlop={10}>
              <Text style={{ ...type.sm, color: 'rgba(255,255,255,.7)', textAlign: 'center' }}>
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

export function PhoneScreen({ navigation, role, blurb }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    appApi.auth.demoAccounts(role).then((r) => setAccounts(r.accounts)).catch(() => {});
  }, [role]);

  async function submit(value) {
    const number = value ?? phone;
    setBusy(true);
    setError(null);
    try {
      const r = await appApi.auth.requestOtp(number, role);
      navigation.navigate('Otp', { phone: number, name: r.name, demoCode: r.demoCode });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Sign in" onBack={navigation.canGoBack() ? navigation.goBack : undefined} border={false} />
      <Body>
        <T.Hero style={{ marginBottom: 10 }}>What’s your number?</T.Hero>
        <T.Body style={{ marginBottom: space[6] }}>{blurb}</T.Body>

        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 98204 11233"
          keyboardType="phone-pad"
          autoComplete="tel"
          error={error}
        />

        {accounts.length > 0 ? (
          <View style={{ marginTop: space[6] }}>
            <T.Eyebrow style={{ marginBottom: 10 }}>Or continue as</T.Eyebrow>
            <View style={{ gap: 8 }}>
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => { setPhone(a.phone); submit(a.phone); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingVertical: 12, paddingHorizontal: 14,
                    borderRadius: radii.md, borderWidth: 1, borderColor: colors.line2,
                    backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily }}>{a.name}</Text>
                    <T.Xs style={{ marginTop: 2 }}>
                      {a.phone}{a.kind ? ` · ${a.kind}` : ''}{a.area ? ` · ${a.area}` : ''}
                    </T.Xs>
                  </View>
                  <Ico name="chev" size={16} color={colors.ink[4]} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Body>

      <Dock>
        <Button title={busy ? 'Sending…' : 'Send code'} onPress={() => submit()}
          loading={busy} disabled={phone.trim().length < 6} />
      </Dock>
    </Screen>
  );
}

export function OtpScreen({ navigation, route, role }) {
  const { phone, name, demoCode } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function verify(value) {
    const entered = value ?? code;
    setBusy(true);
    setError(null);
    try {
      const { user } = await appApi.auth.verifyOtp(phone, entered, role);
      signIn(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Verify" onBack={navigation.goBack} border={false} />
      <Body>
        <T.Hero style={{ marginBottom: 10 }}>Enter the code</T.Hero>
        <T.Body style={{ marginBottom: space[6] }}>
          {name ? `Welcome back, ${name.split(' ')[0]}. ` : ''}We sent a 4-digit code to {phone}.
        </T.Body>

        <TextInput
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 4);
            setCode(digits);
            if (digits.length === 4) verify(digits);
          }}
          keyboardType="number-pad"
          maxLength={4}
          autoFocus
          style={{
            fontFamily: type.hero.fontFamily, fontSize: 32, letterSpacing: 14,
            textAlign: 'center', color: colors.ink[1],
            borderWidth: 1, borderColor: error ? colors.danger[600] : colors.line2,
            borderRadius: radii.md, paddingVertical: 16, backgroundColor: colors.surface
          }}
        />
        {error ? <T.Xs style={{ color: colors.danger[600], marginTop: 8 }}>{error}</T.Xs> : null}

        {demoCode ? (
          <View style={{
            marginTop: space[5], padding: 14, borderRadius: radii.md,
            backgroundColor: colors.info[50], flexDirection: 'row', gap: 10
          }}>
            <Ico name="info" size={17} color={colors.info[600]} />
            <T.Xs style={{ flex: 1 }}>
              No SMS provider is wired in this build, so the code is {demoCode}.
            </T.Xs>
          </View>
        ) : null}
      </Body>

      <Dock>
        <Button title={busy ? 'Checking…' : 'Verify'} onPress={() => verify()}
          loading={busy} disabled={code.length !== 4} />
      </Dock>
    </Screen>
  );
}

export function RestoringScreen() {
  return (
    <Screen onBrand edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={80} />
      </View>
    </Screen>
  );
}
