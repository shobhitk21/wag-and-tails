import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, Body, Card, Button, Row, Ring, AddRing, Pill, StatusPill,
  T, Ico, Loading, ErrorState, SectionHead, Banner, PersonAvatar,
  useApi, useAuth, useToast, Toast
} from '@wag/ui-native';

/* The customer home screen — matches js/screens-customer.js: scHome().

   Structure, in order: brand-coloured hero (greeting, location, bell) with the
   pet switcher inside it; an overlapping white card for whatever is happening
   right now (a live job, or an idle prompt for the switched pet); two service
   cards; a health nudge scoped to the switched pet; a promo banner; a chat
   prompt (scripted in the prototype — here it says so, rather than half
   building it); a "book again" rail; a static trust card; help. */
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [toast, setToast] = useToast();
  const { data, error, loading, reload } = useApi(() => appApi.customer.home(), []);
  const [petId, setPetId] = useState(null);

  if (loading) return <Screen><Loading /></Screen>;
  if (error) return <Screen><ErrorState error={error} onRetry={reload} /></Screen>;

  const { pets, active, upcoming, offers, unreadCount, dueVaccines, recentCompleted, address } = data;
  const selected = pets.find((p) => p.id === petId) ?? pets[0];

  const scopedRebook = recentCompleted.filter((b) => b.pet_id === selected?.id);
  const rebook = (scopedRebook.length ? scopedRebook : recentCompleted).slice(0, 4);

  const dueForSelected = dueVaccines.find((v) => v.pet_id === selected?.id);
  const weeksAgo = selected?.last_visit_weeks_ago;
  const showHealthNudge = selected && (dueForSelected || (weeksAgo != null && weeksAgo >= 6));

  return (
    <Screen onBrand edges={['top']}>
      {/* Everything, hero included, lives inside the one scroller: the header
          is part of the page rather than a fixed bar, so it scrolls away and
          gives the list the full screen.

          It has to be inside the ScrollView for the overlapping card to work
          at all. A negative margin on the scroller's *first* child is clipped
          at its top bound, which was cutting the top off that card while the
          hero sat outside; with the hero as the first child the card is simply
          the second one and there is nothing to clip against. */}
      <Body
        style={{ backgroundColor: colors.canvas }}
        horizontalPadding={0}
        contentStyle={{ paddingTop: 0 }}
      >
      <View style={{
        backgroundColor: colors.brand[700],
        paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[7],
        borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...type.sm, color: 'rgba(255,255,255,.68)' }}>Good morning</Text>
            <Text style={{ ...type.hero, fontSize: 26, color: colors.white, marginTop: 2 }}>
              {user?.first_name ?? user?.name?.split(' ')[0] ?? 'there'}
            </Text>
            {address ? (
              <Pressable
                onPress={() => navigation.navigate('AccountTab', { screen: 'Addresses' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}
              >
                <Ico name="pin" size={13} color="rgba(255,255,255,.75)" />
                <Text style={{ ...type.xs, color: 'rgba(255,255,255,.75)' }} numberOfLines={1}>
                  {address.label} · {address.area}
                </Text>
                <Ico name="chevD" size={13} color="rgba(255,255,255,.6)" />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}>
            <View style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.14)',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Ico name="bell" size={19} color={colors.white} />
              {unreadCount > 0 ? (
                <View style={{
                  position: 'absolute', top: 7, right: 8, width: 8, height: 8,
                  borderRadius: 4, backgroundColor: colors.accent[400],
                  borderWidth: 1.5, borderColor: colors.brand[700]
                }} />
              ) : null}
            </View>
          </Pressable>
        </View>

        {/* The pet switcher lives in the header, on-brand — tapping a ring
            here changes which pet the idle card, nudge and rebook rail read. */}
        <View style={{ flexDirection: 'row', gap: space[4], marginTop: space[5] }}>
          {pets.map((p) => {
            const isSelected = p.id === selected?.id;
            const hasActive = active?.pet_name === p.name;
            return (
              <Pressable key={p.id} onPress={() => setPetId(p.id)} style={{ alignItems: 'center', gap: 6 }}>
                <Ring pet={p} size={58} state={hasActive ? 'active' : 'idle'} />
                <Text style={{
                  ...type.xs,
                  fontFamily: isSelected ? type.h3.fontFamily : type.xs.fontFamily,
                  color: isSelected ? colors.white : 'rgba(255,255,255,.6)'
                }}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => navigation.navigate('PetAdd')} style={{ alignItems: 'center', gap: 6 }}>
            <AddRing size={58} />
            <Text style={{ ...type.xs, color: 'rgba(255,255,255,.55)' }}>Add pet</Text>
          </Pressable>
        </View>
      </View>

      {/* The card overlapping the hero. On Android paint order follows
          elevation rather than JSX order, so it needs one to stay on top of
          the hero it is pulled up over. */}
      <View style={{
        paddingHorizontal: space[5],
        marginTop: -space[6],
        zIndex: 2,
        elevation: 4
      }}>
        {active ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[3] }}>
              <T.Eyebrow>Happening now</T.Eyebrow>
              <StatusPill status={active.status} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ring pet={{ art: active.pet_art }} size={52} state="active" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T.H3 numberOfLines={1}>{active.service_label} · {active.pet_name}</T.H3>
                <T.Xs style={{ marginTop: 3 }} numberOfLines={1}>
                  {active.partner_name} · {active.eta ?? active.scheduled_label}
                </T.Xs>
              </View>
              <PersonAvatar name={active.partner_name} size={38} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: space[3] }}>
              <Button
                title="Track"
                onPress={() => navigation.navigate(
                  active.service_kind === 'walk' ? 'WalkLive' : 'Track', { id: active.id }
                )}
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => setToast(`Calling ${active.partner_name}…`)}
                style={{
                  width: 44, height: 44, borderRadius: radii.btn, borderWidth: 1,
                  borderColor: colors.line2, alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Ico name="phone" size={17} color={colors.ink[2]} />
              </Pressable>
              <Button
                title="Details" variant="secondary" full={false}
                onPress={() => navigation.navigate('Booking', { id: active.id })}
                style={{ paddingHorizontal: space[4] }}
              />
            </View>
          </Card>
        ) : selected ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Ring pet={selected} size={50} />
              <View style={{ flex: 1 }}>
                <T.H3>Nothing booked for {selected.name}</T.H3>
                <T.Xs style={{ marginTop: 3 }}>
                  {selected.last_visit_on ? `Last groomed ${selected.last_visit_on}` : 'No visits yet'}
                </T.Xs>
              </View>
              <Button title="Book" full={false} onPress={() => navigation.navigate('BookGroom')} />
            </View>
          </Card>
        ) : null}
      </View>

      {/* The hero is brand-700 and the safe-area container inherits that colour
          so the status bar strip matches it (the fix for the Build Book's
          "status bar unreadable on Home" bug — not a repeat of it). The
          scroller itself is canvas, so once the hero scrolls up past the top
          the rest of the screen keeps its own background. */}
      <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>
        {/* Book a service. */}
        <SectionHead title="Book a service" />
        <T.Xs style={{ marginTop: -8, marginBottom: space[3] }}>At your home, 7 days a week</T.Xs>
        <View style={{ gap: space[3] }}>
          <Pressable onPress={() => navigation.navigate('BookGroom')}>
            <View style={{
              backgroundColor: colors.brand[700], borderRadius: radii.lg, padding: space[4],
              overflow: 'hidden', position: 'relative'
            }}>
              <View style={{ position: 'absolute', right: -10, bottom: -14, opacity: 0.16 }}>
                <Ico name="paw" size={92} color={colors.white} />
              </View>
              <Text style={{ ...type.h2, color: colors.white }}>Grooming</Text>
              <Text style={{ ...type.xs, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>
                Bath, trim and styling at home
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space[3] }}>
                <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.white }}>
                  From {inr(999)}
                </Text>
                <Ico name="chev" size={13} color={colors.white} />
              </View>
            </View>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('BookWalk')}>
            <View style={{
              backgroundColor: colors.brand[100], borderRadius: radii.lg, padding: space[4],
              overflow: 'hidden', position: 'relative'
            }}>
              <View style={{ position: 'absolute', right: -6, bottom: -10, opacity: 0.3 }}>
                <Ico name="route" size={76} color={colors.brand[600]} />
              </View>
              <Text style={{ ...type.h2, color: colors.ink[1] }}>Dog walking</Text>
              <Text style={{ ...type.xs, color: colors.ink[3], marginTop: 4 }}>
                On demand, tracked live
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space[3] }}>
                <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily, color: colors.ink[1] }}>
                  From {inr(249)}
                </Text>
                <Ico name="chev" size={13} color={colors.ink[1]} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* This pet's care — a booster overdue, or it's been 6+ weeks. */}
        {showHealthNudge ? (
          <>
            <SectionHead title={`${selected.name}’s care`} style={{ marginTop: space[5] }} />
            <T.Xs style={{ marginTop: -8, marginBottom: space[3] }}>Based on this pet’s records</T.Xs>
            {dueForSelected ? (
              <Pressable onPress={() => navigation.navigate('PetVaccines', { id: selected.id })}>
                <Banner tone="warn" icon="syringe" style={{ marginBottom: space[3] }}>
                  {selected.name}’s {dueForSelected.name.toLowerCase()} booster is due — due {dueForSelected.due_on}
                </Banner>
              </Pressable>
            ) : null}
            {weeksAgo != null && weeksAgo >= 6 ? (
              <Pressable onPress={() => navigation.navigate('BookGroom')}>
                <Banner tone="accent" icon="scissors">
                  Time for {selected.name}’s next groom — last groomed {weeksAgo} weeks ago · we suggest every 6–8 weeks
                </Banner>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {/* Offers. */}
        {offers.length > 0 ? (
          <Pressable onPress={() => navigation.navigate('Offers')} style={{ marginTop: space[5] }}>
            <View style={{
              backgroundColor: colors.accent[500], borderRadius: radii.lg, padding: space[4],
              flexDirection: 'row', alignItems: 'center', gap: space[3]
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.h3, color: colors.white }}>{offers[0].title}</Text>
                <Text style={{ ...type.xs, color: 'rgba(255,255,255,.85)', marginTop: 3 }}>
                  {offers[0].subtitle}
                </Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(255,255,255,.2)', borderRadius: radii.sm,
                paddingHorizontal: 10, paddingVertical: 6
              }}>
                <Text style={{ ...type.xs, fontFamily: type.h3.fontFamily, color: colors.white }}>
                  {offers[0].code}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* AI chat is scripted in the prototype and out of scope here — the
            honest-dead-end pattern the Build Book uses throughout: say so
            rather than half-build it. */}
        {selected ? (
          <Card
            style={{ marginTop: space[5] }}
            onPress={() => setToast('AI chat is scripted in the original and is not wired in this build.')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{
                width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.accent[50],
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ico name="spark" size={19} color={colors.accent[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <T.H3>Ask about {selected.name}</T.H3>
                <T.Xs style={{ marginTop: 2 }}>Coat care, weight, grooming frequency</T.Xs>
              </View>
              <Ico name="chev" size={17} color={colors.ink[4]} />
            </View>
          </Card>
        ) : null}

        {/* Book again. */}
        {rebook.length > 0 ? (
          <>
            <SectionHead
              title="Book again"
              action="See all"
              onAction={() => navigation.navigate('BookingsTab')}
              style={{ marginTop: space[5] }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
              {rebook.map((b) => (
                <Card key={b.id} style={{ width: '47%' }} onPress={() => navigation.navigate('BookGroom')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ring pet={{ art: b.pet_art }} size={34} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T.Sm numberOfLines={1} style={{ fontFamily: type.h3.fontFamily }}>{b.label}</T.Sm>
                      <T.Xs numberOfLines={1} style={{ marginTop: 1 }}>
                        {b.pet_name} · {b.date_label}
                      </T.Xs>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ ...type.sm, fontFamily: type.h3.fontFamily }}>{inr(b.total)}</Text>
                    <Pill tone="brand">Rebook</Pill>
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {/* Trust — static content, matching the prototype's own hardcoded figures. */}
        <Card style={{ marginTop: space[5], backgroundColor: colors.sunken, borderColor: colors.sunken }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] }}>
            <Ico name="shield" size={19} color={colors.ok[600]} />
            <View style={{ flex: 1 }}>
              <T.H3>Every partner is verified</T.H3>
              <T.Xs style={{ marginTop: 2 }}>
                ID checked, police verified and trained on handling anxious dogs.
              </T.Xs>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <T.H2>4.9</T.H2><T.Xs>Avg rating</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <T.H2>12k+</T.H2><T.Xs>Grooms done</T.Xs>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <T.H2>98%</T.H2><T.Xs>On time</T.Xs>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: space[4] }} onPress={() => navigation.navigate('Help')}>
          <Row icon="help" title="Help & support" subtitle="FAQs, booking issues, contact us" chevron />
        </Card>
      </View>
      </Body>
      <Toast message={toast} />
    </Screen>
  );
}
