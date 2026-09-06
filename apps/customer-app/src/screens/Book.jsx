/* Booking a groom and booking a walk.

   Grooming is four steps — pet, package, add-ons, slot — with the packages
   expanding in place rather than pushing a new screen, then a review sheet and
   a partner match. Walking is three. Prices are never computed here: the app
   sends choices and the API resolves the money. */
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Sheet, Toast,
  Card, Button, Chip, Field, KV, Divider, Price, Pill, Banner, CareNote,
  Ring, StepBar, T, Ico, Loading, ErrorState, useApi
} from '@wag/ui-native';

/* The next five days, labelled the way the prototype labelled them. */
function nextDays(n = 5) {
  const today = new Date();
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      key: `d${i}`,
      short: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${d.getDate()} ${MON[d.getMonth()]}`,
      dow: DAY[d.getDay()],
      num: d.getDate()
    };
  });
}

function useBookingData() {
  const pets = useApi(() => appApi.pets.list(), []);
  const home = useApi(() => appApi.customer.home(), []);
  return { pets, home };
}

/* ---------- grooming ---------- */
export function BookGroomScreen({ navigation }) {
  const { pets, home } = useBookingData();
  const days = useMemo(() => nextDays(5), []);

  const [step, setStep] = useState(1);
  const [petId, setPetId] = useState(null);
  const [packageId, setPackageId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [addonIds, setAddonIds] = useState([]);
  const [dateLabel, setDateLabel] = useState(days[0].short);
  const [slot, setSlot] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  if (pets.loading || home.loading) {
    return <Screen><AppBar title="Book a groom" onBack={navigation.goBack} /><Loading /></Screen>;
  }
  if (pets.error || home.error) {
    return (
      <Screen>
        <AppBar title="Book a groom" onBack={navigation.goBack} />
        <ErrorState error={pets.error ?? home.error} onRetry={() => { pets.reload(); home.reload(); }} />
      </Screen>
    );
  }

  const packages = home.data.packages;
  const addons = home.data.addons ?? [];
  const pet = pets.data.pets.find((p) => p.id === petId);
  const pkg = packages.find((p) => p.id === packageId);
  const chosenAddons = addons.filter((a) => addonIds.includes(a.id));
  const total = (pkg?.price ?? 0) + chosenAddons.reduce((s, a) => s + a.price, 0);

  const canAdvance = { 1: !!petId, 2: !!packageId, 3: true, 4: !!slot }[step];

  async function create() {
    setBusy(true);
    try {
      const { booking } = await appApi.bookings.create({
        petId, serviceKind: 'groom', packageId, addonIds,
        dateLabel, slot, couponCode: coupon.trim()
      });
      setReviewing(false);
      navigation.replace('Matching', { id: booking.id });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2600);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar
        title="Book a groom"
        subtitle={`Step ${step} of 4`}
        onBack={() => (step === 1 ? navigation.goBack() : setStep(step - 1))}
      />
      <View style={{ paddingHorizontal: space[5], paddingBottom: space[3] }}>
        <StepBar step={step} total={4} />
      </View>

      <Body contentStyle={{ paddingTop: space[2] }}>
        {step === 1 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>Who is it for?</T.H1>
            <View style={{ gap: space[3] }}>
              {pets.data.pets.map((p) => (
                <Card key={p.id} onPress={() => setPetId(p.id)}
                  style={petId === p.id ? { borderColor: colors.brand[700], borderWidth: 2 } : null}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <Ring pet={p} size={54} state={petId === p.id ? 'done' : 'idle'} />
                    <View style={{ flex: 1 }}>
                      <T.H3>{p.name}</T.H3>
                      <T.Xs style={{ marginTop: 3 }}>{p.breed}{p.weight ? ` · ${p.weight}` : ''}</T.Xs>
                    </View>
                    {petId === p.id ? <Ico name="check" size={20} color={colors.brand[700]} /> : null}
                  </View>
                </Card>
              ))}
            </View>
            {pet?.care_note ? (
              <CareNote note={pet.care_note} petName={pet.name} style={{ marginTop: space[4] }} />
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>Pick a package</T.H1>
            <View style={{ gap: space[3] }}>
              {packages.map((p) => {
                const open = expanded === p.id;
                const selected = packageId === p.id;
                return (
                  <Card key={p.id}
                    style={selected ? { borderColor: colors.brand[700], borderWidth: 2 } : null}>
                    <Pressable onPress={() => { setPackageId(p.id); setExpanded(open ? null : p.id); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <T.H2>{p.name}</T.H2>
                            {p.popular ? <Pill tone="accent">Popular</Pill> : null}
                          </View>
                          <T.Xs style={{ marginTop: 4 }}>{p.blurb}</T.Xs>
                          <T.Xs style={{ marginTop: 4 }}>{p.mins} minutes</T.Xs>
                        </View>
                        <Price now={p.price} was={p.mrp} size={19} />
                      </View>

                      {/* Expand in place rather than pushing a screen — the
                          owner is comparing packages, not navigating. */}
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[3]
                      }}>
                        <Text style={{ ...type.xs, color: colors.accent[600],
                          fontFamily: type.h3.fontFamily }}>
                          {open ? 'Hide what’s included' : 'What’s included'}
                        </Text>
                        <Ico name={open ? 'chevD' : 'chev'} size={14} color={colors.accent[600]} />
                      </View>
                    </Pressable>

                    {open ? (
                      <View style={{ marginTop: space[3], gap: 7 }}>
                        <Divider />
                        {(p.inclusions ?? []).map((item) => (
                          <View key={item} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <Ico name="check" size={15} color={colors.ok[600]} />
                            <T.Sm style={{ flex: 1 }}>{item}</T.Sm>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <T.H1 style={{ marginBottom: 6 }}>Anything extra?</T.H1>
            <T.Body style={{ marginBottom: space[4] }}>Optional. Skip if you’re not sure.</T.Body>
            <View style={{ gap: space[3] }}>
              {addons.map((a) => {
                const on = addonIds.includes(a.id);
                /* An add-on the package already covers is not offered twice —
                   the Build Book records de-matting being sold alongside Luxury,
                   which already includes it. */
                const alreadyIncluded = (pkg?.inclusions ?? [])
                  .some((i) => i.toLowerCase() === a.name.toLowerCase());
                if (alreadyIncluded) return null;

                return (
                  <Card key={a.id}
                    onPress={() => setAddonIds(on ? addonIds.filter((x) => x !== a.id) : [...addonIds, a.id])}
                    style={on ? { borderColor: colors.brand[700], borderWidth: 2 } : null}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 6,
                        borderWidth: 2, borderColor: on ? colors.brand[700] : colors.line2,
                        backgroundColor: on ? colors.brand[700] : 'transparent',
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        {on ? <Ico name="check" size={14} color={colors.white} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <T.H3>{a.name}</T.H3>
                        <T.Xs style={{ marginTop: 3 }}>{a.note}</T.Xs>
                      </View>
                      <Price now={a.price} size={15} />
                    </View>
                  </Card>
                );
              })}
            </View>
            {pkg ? (
              <Banner tone="info" icon="info" style={{ marginTop: space[4] }}>
                Anything already in {pkg.name} is not offered here.
              </Banner>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>When suits you?</T.H1>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: space[5] }}>
              {days.map((d) => (
                <Pressable key={d.key} onPress={() => setDateLabel(d.short)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: dateLabel === d.short ? colors.brand[700] : colors.line2,
                    backgroundColor: dateLabel === d.short ? colors.brand[700] : colors.surface
                  }}>
                  <Text style={{ ...type.xxs,
                    color: dateLabel === d.short ? 'rgba(255,255,255,.7)' : colors.ink[3] }}>
                    {d.dow}
                  </Text>
                  <Text style={{ ...type.h3,
                    color: dateLabel === d.short ? colors.white : colors.ink[1], marginTop: 3 }}>
                    {d.num}
                  </Text>
                </Pressable>
              ))}
            </View>

            <T.Eyebrow style={{ marginBottom: 10 }}>Available slots</T.Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(home.data.slots ?? []).filter((s) => s.enabled).map((s) => (
                <Chip key={s.label} label={s.label} selected={slot === s.label}
                  onPress={() => setSlot(s.label)} />
              ))}
            </View>

            <Field label="Coupon code" value={coupon} onChangeText={setCoupon}
              autoCapitalize="characters" placeholder="FIRST20"
              style={{ marginTop: space[6] }}
              hint="Checked when the booking is created." />
          </>
        ) : null}
      </Body>

      <Dock>
        {step === 4 ? (
          <>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: space[3]
            }}>
              <T.Sm>{pkg?.name}{chosenAddons.length ? ` + ${chosenAddons.length} extra` : ''}</T.Sm>
              <Price now={total} size={18} />
            </View>
            <Button title="Review booking" onPress={() => setReviewing(true)} disabled={!slot} />
          </>
        ) : (
          <Button title="Continue" onPress={() => setStep(step + 1)} disabled={!canAdvance} />
        )}
      </Dock>

      <Sheet
        visible={reviewing}
        title="Review"
        onClose={() => setReviewing(false)}
        footer={
          <Button title={busy ? 'Confirming…' : `Confirm · ${inr(total)}`}
            onPress={create} loading={busy} />
        }
      >
        <KV k="Pet" v={pet ? `${pet.name} · ${pet.breed}` : '—'} />
        <KV k="Package" v={pkg?.name ?? '—'} />
        {chosenAddons.map((a) => <KV key={a.id} k={a.name} v={inr(a.price)} />)}
        <KV k="When" v={`${dateLabel}, ${slot ?? ''}`} />
        <Divider style={{ marginVertical: 10 }} />
        <KV k="Total" v={inr(total)} />
        {coupon ? <T.Xs style={{ marginTop: 6 }}>Coupon {coupon.toUpperCase()} applied at confirmation.</T.Xs> : null}
        {pet?.care_note ? (
          <CareNote note={pet.care_note} petName={pet.name} style={{ marginTop: space[4] }} />
        ) : null}
        <T.Xs style={{ marginTop: space[3] }}>
          Pay after the service. Free cancellation up to 4 hours before.
        </T.Xs>
      </Sheet>

      <Toast message={toast} />
    </Screen>
  );
}

/* ---------- walking ---------- */
export function BookWalkScreen({ navigation }) {
  const { pets, home } = useBookingData();
  const days = useMemo(() => nextDays(5), []);

  const [step, setStep] = useState(1);
  const [petId, setPetId] = useState(null);
  const [walkId, setWalkId] = useState(null);
  const [dateLabel, setDateLabel] = useState(days[0].short);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  if (pets.loading || home.loading) {
    return <Screen><AppBar title="Book a walk" onBack={navigation.goBack} /><Loading /></Screen>;
  }

  const walks = home.data.walks;
  const pet = pets.data.pets.find((p) => p.id === petId);
  const walk = walks.find((w) => w.id === walkId);
  const canAdvance = { 1: !!petId, 2: !!walkId, 3: !!slot }[step];

  async function create() {
    setBusy(true);
    try {
      const { booking } = await appApi.bookings.create({
        petId, serviceKind: 'walk', walkId, dateLabel, slot
      });
      navigation.replace('Matching', { id: booking.id, kind: 'walk' });
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 2600);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Book a walk" subtitle={`Step ${step} of 3`}
        onBack={() => (step === 1 ? navigation.goBack() : setStep(step - 1))} />
      <View style={{ paddingHorizontal: space[5], paddingBottom: space[3] }}>
        <StepBar step={step} total={3} />
      </View>

      <Body contentStyle={{ paddingTop: space[2] }}>
        {step === 1 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>Who’s going out?</T.H1>
            <View style={{ gap: space[3] }}>
              {pets.data.pets.map((p) => (
                <Card key={p.id} onPress={() => setPetId(p.id)}
                  style={petId === p.id ? { borderColor: colors.brand[700], borderWidth: 2 } : null}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <Ring pet={p} size={54} state={petId === p.id ? 'done' : 'idle'} />
                    <View style={{ flex: 1 }}>
                      <T.H3>{p.name}</T.H3>
                      <T.Xs style={{ marginTop: 3 }}>{p.breed}</T.Xs>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
            {pet?.care_note ? (
              <CareNote note={pet.care_note} petName={pet.name} style={{ marginTop: space[4] }} />
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>How long?</T.H1>
            <View style={{ gap: space[3] }}>
              {walks.map((w) => (
                <Card key={w.id} onPress={() => setWalkId(w.id)}
                  style={walkId === w.id ? { borderColor: colors.brand[700], borderWidth: 2 } : null}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <View style={{ flex: 1 }}>
                      <T.H2>{w.mins} minutes</T.H2>
                      <T.Xs style={{ marginTop: 4 }}>{w.note}</T.Xs>
                      <T.Xs style={{ marginTop: 2 }}>{w.km}</T.Xs>
                    </View>
                    <Price now={w.price} size={19} />
                  </View>
                </Card>
              ))}
            </View>
            {walks.some((w) => w.provisional) ? (
              <Banner tone="warn" icon="alert" style={{ marginTop: space[4] }}>
                Walk pricing is provisional while we finish a route and payout study.
              </Banner>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <T.H1 style={{ marginBottom: space[4] }}>When?</T.H1>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: space[5] }}>
              {days.map((d) => (
                <Pressable key={d.key} onPress={() => setDateLabel(d.short)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: dateLabel === d.short ? colors.brand[700] : colors.line2,
                    backgroundColor: dateLabel === d.short ? colors.brand[700] : colors.surface
                  }}>
                  <Text style={{ ...type.xxs,
                    color: dateLabel === d.short ? 'rgba(255,255,255,.7)' : colors.ink[3] }}>
                    {d.dow}
                  </Text>
                  <Text style={{ ...type.h3,
                    color: dateLabel === d.short ? colors.white : colors.ink[1], marginTop: 3 }}>
                    {d.num}
                  </Text>
                </Pressable>
              ))}
            </View>
            <T.Eyebrow style={{ marginBottom: 10 }}>Slots</T.Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(home.data.slots ?? []).filter((s) => s.enabled).map((s) => (
                <Chip key={s.label} label={s.label} selected={slot === s.label}
                  onPress={() => setSlot(s.label)} />
              ))}
            </View>
          </>
        ) : null}
      </Body>

      <Dock>
        {step === 3 ? (
          <Button title={busy ? 'Confirming…' : `Confirm · ${inr(walk?.price ?? 0)}`}
            onPress={create} loading={busy} disabled={!slot} />
        ) : (
          <Button title="Continue" onPress={() => setStep(step + 1)} disabled={!canAdvance} />
        )}
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}
