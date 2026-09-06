/* Pets: the list, the profile, the health record, a past visit, and add/edit.

   The care note lives here. What the owner types on this screen is the exact
   sentence the groomer reads on their job sheet and the walker reads on their
   incoming request — one row in `pets`, rendered on every surface. */
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, Row, KV, Divider, Chip, Field, Pill, CareNote, Banner,
  Ring, AddRing, PhotoTile, T, Ico, Loading, ErrorState, EmptyState,
  Stars, useApi
} from '@wag/ui-native';

export function PetsScreen({ navigation }) {
  const { data, error, loading, reload } = useApi(() => appApi.pets.list(), []);

  if (loading) return <Screen><AppBar title="Pets" /><Loading /></Screen>;
  if (error) return <Screen><AppBar title="Pets" /><ErrorState error={error} onRetry={reload} /></Screen>;

  return (
    <Screen>
      <AppBar title="Your pets" subtitle={`${data.pets.length} on this account`} />
      <Body>
        {data.pets.map((p) => (
          <Card key={p.id} style={{ marginBottom: space[3] }}
            onPress={() => navigation.navigate('Pet', { id: p.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <Ring pet={p} size={62} state={p.vaccinated === 'Booster due' ? 'searching' : 'idle'} />
              <View style={{ flex: 1 }}>
                <T.H2>{p.name}</T.H2>
                <T.Xs style={{ marginTop: 3 }}>{p.breed}</T.Xs>
                {p.vaccinated === 'Booster due' ? (
                  <Pill tone="warn" style={{ marginTop: 8 }}>Booster due</Pill>
                ) : null}
              </View>
              <Ico name="chev" size={18} color={colors.ink[4]} />
            </View>
            {p.care_note ? (
              <CareNote note={p.care_note} style={{ marginTop: space[4] }} />
            ) : null}
          </Card>
        ))}

        <Pressable
          onPress={() => navigation.navigate('PetAdd')}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: space[4],
            padding: space[4], borderRadius: radii.lg,
            borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2,
            opacity: pressed ? 0.8 : 1
          })}
        >
          <AddRing size={54} />
          <View style={{ flex: 1 }}>
            <T.H3>Add a pet</T.H3>
            <T.Xs style={{ marginTop: 3 }}>Their record travels with every booking.</T.Xs>
          </View>
        </Pressable>
      </Body>
    </Screen>
  );
}

export function PetScreen({ route, navigation }) {
  const { id } = route.params;
  const { data, error, loading, reload } = useApi(() => appApi.pets.get(id), [id]);

  if (loading) return <Screen><AppBar title="Pet" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Pet" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const { pet, vaccines, history } = data;
  const overdue = vaccines.filter((v) => !v.up_to_date);

  return (
    <Screen>
      <AppBar
        title={pet.name}
        subtitle={`${pet.breed}${pet.age ? ` · ${pet.age}` : ''}`}
        onBack={navigation.goBack}
        right={
          <Pressable onPress={() => navigation.navigate('PetEdit', { id: pet.id })} hitSlop={10}>
            <Ico name="edit" size={20} color={colors.ink[2]} />
          </Pressable>
        }
      />
      <Body>
        <View style={{ alignItems: 'center', gap: space[3], marginBottom: space[5] }}>
          <Ring pet={pet} size={116} state={overdue.length ? 'searching' : 'idle'} />
          <T.H1>{pet.name}</T.H1>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pet.sex ? <Pill>{pet.sex}</Pill> : null}
            {pet.weight ? <Pill>{pet.weight}</Pill> : null}
            {pet.size ? <Pill>{pet.size}</Pill> : null}
          </View>
        </View>

        {/* The through-line, editable right here. */}
        <CareNote note={pet.care_note} petName={pet.name} />
        <Button
          title={pet.care_note ? 'Edit care notes' : 'Add care notes'}
          variant="secondary"
          onPress={() => navigation.navigate('PetEdit', { id: pet.id, focus: 'careNote' })}
          style={{ marginTop: space[3] }}
        />
        <T.Xs style={{ marginTop: 8, textAlign: 'center' }}>
          The groomer and walker see this before they start.
        </T.Xs>

        <Card style={{ marginTop: space[5] }}>
          <T.Eyebrow style={{ marginBottom: 8 }}>About</T.Eyebrow>
          {pet.coat ? <KV k="Coat" v={pet.coat} /> : null}
          {pet.temperament ? <KV k="Temperament" v={pet.temperament} /> : null}
          {pet.allergies ? <KV k="Allergies" v={pet.allergies} /> : null}
          {pet.dob ? <KV k="Date of birth" v={pet.dob} /> : null}
          {pet.neutered ? <KV k="Neutered" v={pet.neutered} /> : null}
          {pet.microchip ? <KV k="Microchip" v={pet.microchip} /> : null}
        </Card>

        <Card style={{ marginTop: space[4] }}
          onPress={() => navigation.navigate('PetVaccines', { id: pet.id })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Ico name="syringe" size={22} color={overdue.length ? colors.warn[600] : colors.ok[600]} />
            <View style={{ flex: 1 }}>
              <T.H3>Vaccination record</T.H3>
              <T.Xs style={{ marginTop: 3 }}>
                {overdue.length
                  ? `${overdue.length} overdue · next ${pet.next_vaccine}`
                  : `Up to date · next ${pet.next_vaccine}`}
              </T.Xs>
            </View>
            <Ico name="chev" size={18} color={colors.ink[4]} />
          </View>
        </Card>

        {pet.vet ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: 8 }}>Vet</T.Eyebrow>
            <KV k="Doctor" v={pet.vet} />
            {pet.vet_clinic ? <KV k="Clinic" v={pet.vet_clinic} /> : null}
            {pet.vet_phone ? <KV k="Phone" v={pet.vet_phone} /> : null}
          </Card>
        ) : null}

        {history.length > 0 ? (
          <>
            <T.Eyebrow style={{ marginTop: space[6], marginBottom: space[3] }}>
              Grooming history
            </T.Eyebrow>
            {history.map((h) => (
              <Card key={h.code} style={{ marginBottom: space[3] }}
                onPress={() => navigation.navigate('Visit', { petId: pet.id, code: h.code })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <PhotoTile seed={h.code} size={52} />
                  <View style={{ flex: 1 }}>
                    <T.H3>{h.package_name}</T.H3>
                    <T.Xs style={{ marginTop: 3 }}>
                      {h.visited_on}{h.partner_name ? ` · ${h.partner_name}` : ''}
                      {h.mins ? ` · ${h.mins} min` : ''}
                    </T.Xs>
                  </View>
                  {h.rating ? <Stars value={h.rating} size={12} /> : null}
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </Body>
    </Screen>
  );
}

export function PetVaccinesScreen({ route, navigation }) {
  const { id } = route.params;
  const { data, loading, error, reload } = useApi(() => appApi.pets.get(id), [id]);

  if (loading) return <Screen><AppBar title="Vaccinations" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Vaccinations" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Vaccinations" subtitle={data.pet.name} onBack={navigation.goBack} />
      <Body>
        {data.vaccines.map((v) => (
          <Card key={v.name} style={{ marginBottom: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{
                width: 40, height: 40, borderRadius: radii.md,
                backgroundColor: v.up_to_date ? colors.ok[50] : colors.warn[50],
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ico name="syringe" size={19}
                  color={v.up_to_date ? colors.ok[600] : colors.warn[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <T.H3>{v.name}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>Given {v.given_on} · due {v.due_on}</T.Xs>
              </View>
              <Pill tone={v.up_to_date ? 'ok' : 'warn'}>
                {v.up_to_date ? 'Up to date' : 'Due'}
              </Pill>
            </View>
          </Card>
        ))}
        <Banner tone="info" icon="info" style={{ marginTop: space[3] }}>
          Records are entered by you or your vet. Editing them is not wired in this build.
        </Banner>
      </Body>
    </Screen>
  );
}

export function VisitScreen({ route, navigation }) {
  const { petId, code } = route.params;
  const { data, loading, error, reload } = useApi(() => appApi.pets.visit(petId, code), [petId, code]);

  if (loading) return <Screen><AppBar title="Visit" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Visit" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const v = data.visit;
  return (
    <Screen>
      <AppBar title={v.package_name} subtitle={v.visited_on} onBack={navigation.goBack} />
      <Body>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1, gap: 6 }}>
            <T.Eyebrow>Before</T.Eyebrow>
            <PhotoTile seed={`${code}-before`} size={999} radius={radii.lg} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T.Eyebrow>After</T.Eyebrow>
            <PhotoTile seed={`${code}-after`} size={999} radius={radii.lg} />
          </View>
        </View>

        <Card style={{ marginTop: space[4] }}>
          <KV k="Package" v={v.package_name} />
          {v.partner_name ? <KV k="Groomer" v={v.partner_name} /> : null}
          {v.mins ? <KV k="Duration" v={`${v.mins} minutes`} /> : null}
          {v.rating ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
              <T.Sm style={{ color: colors.ink[3] }}>Your rating</T.Sm>
              <Stars value={v.rating} size={15} />
            </View>
          ) : null}
        </Card>

        {v.note ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: 8 }}>Groomer’s note</T.Eyebrow>
            <T.Body>{v.note}</T.Body>
          </Card>
        ) : null}
      </Body>
    </Screen>
  );
}

/* Add and edit share a form — the only difference is whether it starts empty. */
export function PetFormScreen({ route, navigation }) {
  const id = route.params?.id;
  const editing = Boolean(id);

  const existing = useApi(() => (editing ? appApi.pets.get(id) : Promise.resolve(null)), [id]);
  const breeds = useApi(() => appApi.pets.breeds(), []);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState(null);

  /* Seed the form once the record arrives. */
  if (editing && existing.data && !form) {
    const p = existing.data.pet;
    setForm({
      name: p.name ?? '', breed: p.breed ?? '', weight: p.weight ?? '', age: p.age ?? '',
      sex: p.sex ?? '', size: p.size ?? '', neutered: p.neutered ?? '',
      coat: p.coat ?? '', temperament: p.temperament ?? '',
      allergies: p.allergies ?? '', careNote: p.care_note ?? ''
    });
  }
  if (!editing && !form) {
    setForm({
      name: '', breed: '', weight: '', age: '', sex: '', size: '',
      neutered: '', coat: '', temperament: '', allergies: '', careNote: ''
    });
  }

  if (editing && existing.loading) {
    return <Screen><AppBar title="Edit pet" onBack={navigation.goBack} /><Loading /></Screen>;
  }
  if (!form) return <Screen><Loading /></Screen>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setBusy(true);
    setErrors(null);
    try {
      if (editing) {
        await appApi.pets.update(id, form);
        navigation.goBack();
      } else {
        const { pet } = await appApi.pets.create(form);
        navigation.replace('Pet', { id: pet.id });
      }
    } catch (err) {
      setErrors(err.details ?? null);
      setToast(err.message);
      setTimeout(() => setToast(null), 2400);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppBar title={editing ? `Edit ${form.name || 'pet'}` : 'Add a pet'} onBack={navigation.goBack} />
      <Body>
        <Field label="Name" value={form.name} onChangeText={(v) => set({ name: v })}
          placeholder="What do you call them?" error={errors?.name?.[0]} />

        <T.Eyebrow style={{ marginTop: space[5], marginBottom: 8 }}>Breed</T.Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(breeds.data?.breeds ?? []).map((b) => (
            <Chip key={b} label={b} selected={form.breed === b} onPress={() => set({ breed: b })} />
          ))}
        </View>
        {errors?.breed ? (
          <T.Xs style={{ color: colors.danger[600], marginTop: 6 }}>{errors.breed[0]}</T.Xs>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[5] }}>
          <Field label="Age" value={form.age} onChangeText={(v) => set({ age: v })}
            placeholder="3 yr" style={{ flex: 1 }} />
          <Field label="Weight" value={form.weight} onChangeText={(v) => set({ weight: v })}
            placeholder="12 kg" style={{ flex: 1 }} />
        </View>

        <T.Eyebrow style={{ marginTop: space[5], marginBottom: 8 }}>Sex</T.Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['Male', 'Female'].map((s) => (
            <Chip key={s} label={s} selected={form.sex === s} onPress={() => set({ sex: s })} />
          ))}
        </View>

        <T.Eyebrow style={{ marginTop: space[5], marginBottom: 8 }}>Size</T.Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['Small', 'Medium', 'Large'].map((s) => (
            <Chip key={s} label={s} selected={form.size === s} onPress={() => set({ size: s })} />
          ))}
        </View>

        <Field label="Coat" value={form.coat} onChangeText={(v) => set({ coat: v })}
          placeholder="Short double coat" style={{ marginTop: space[5] }} />

        <Field label="Temperament" value={form.temperament}
          onChangeText={(v) => set({ temperament: v })} multiline
          placeholder="How do they behave with strangers?" style={{ marginTop: space[5] }} />

        <Field label="Allergies" value={form.allergies} onChangeText={(v) => set({ allergies: v })}
          placeholder="Chicken — mild skin flare-ups" style={{ marginTop: space[5] }}
          hint="Used to flag products in the store that would not suit them." />

        {/* This field is the product. */}
        <Field
          label="Care notes"
          value={form.careNote}
          onChangeText={(v) => set({ careNote: v })}
          multiline
          numberOfLines={3}
          placeholder="Hates having his ears touched, go slow."
          style={{ marginTop: space[5] }}
          hint="The groomer and walker read this before they start."
          autoFocus={route.params?.focus === 'careNote'}
        />
      </Body>

      <Dock>
        <Button title={busy ? 'Saving…' : editing ? 'Save changes' : 'Add pet'}
          onPress={save} loading={busy} disabled={!form.name || !form.breed} />
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}
