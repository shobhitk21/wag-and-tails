/* The groomer's job: claim → start → checklist → photos → complete.

   The care note is the highlighted block above the checklist — the same
   sentence the owner wrote on the pet's profile.

   Completion is gated on every checklist row. Rows are keyed p:<name> for
   package inclusions and a:<name> for add-ons, so an add-on that shares a name
   with an inclusion cannot untick it. */
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import appApi from '@wag/api-client/app';
import { colors, type, radii, space, inr } from '@wag/theme';
import {
  Screen, AppBar, Body, Dock, Toast,
  Card, Button, KV, Divider, Pill, StatusPill, Banner, CareNote,
  Ring, PhotoTile, ProgressBar, T, Ico,
  Loading, ErrorState, useApi
} from '@wag/ui-native';

export function JobScreen({ route, navigation }) {
  const { id } = route.params;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const { data, error, loading, reload, setData } = useApi(() => appApi.jobs.get(id), [id]);

  if (loading) return <Screen><AppBar title="Job" onBack={navigation.goBack} /><Loading /></Screen>;
  if (error) {
    return (
      <Screen>
        <AppBar title="Job" onBack={navigation.goBack} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const { job, checklist, progress, addons, photos } = data;
  const mine = job.partner_id != null;
  const started = job.status === 'In progress';
  const travelling = job.status === 'On the way';
  const complete = job.status === 'Completed';
  const allTicked = progress.total > 0 && progress.done === progress.total;

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  async function act(fn, message) {
    setBusy(true);
    try {
      await fn();
      if (message) flash(message);
      reload();
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(false);
    }
  }

  /* Tick optimistically — the row should respond to the tap immediately, then
     reconcile with what the server actually stored. */
  async function tick(item) {
    const next = !item.done;
    setData({
      ...data,
      checklist: checklist.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.item_key === item.item_key ? { ...i, done: next } : i))
      })),
      progress: { ...progress, done: progress.done + (next ? 1 : -1) }
    });
    try {
      const r = await appApi.jobs.tick(id, item.item_key, next);
      setData((d) => ({ ...d, progress: r.progress }));
    } catch (err) {
      flash(err.message);
      reload();
    }
  }

  return (
    <Screen>
      <AppBar title={job.service_label} subtitle={job.id} onBack={navigation.goBack} />
      <Body>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Ring pet={{ art: job.pet_art }} size={56} state={started ? 'active' : 'idle'} />
            <View style={{ flex: 1 }}>
              <T.H2>{job.pet_name}</T.H2>
              <T.Xs style={{ marginTop: 3 }}>
                {job.pet_breed}{job.package_mins ? ` · ${job.package_mins} min` : ''}
              </T.Xs>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <StatusPill status={job.status} />
              <Text style={{ ...type.h3 }}>{inr(job.payout)}</Text>
            </View>
          </View>

          <Divider style={{ marginVertical: space[4] }} />
          <KV k="Customer" v={job.customer_name} />
          <KV k="When" v={job.scheduled_label} />
          {job.line1 ? <KV k="Where" v={[job.line1, job.line2].filter(Boolean).join(', ')} /> : null}
          {job.allergies ? <KV k="Allergies" v={job.allergies} /> : null}
          {job.temperament ? <KV k="Temperament" v={job.temperament} /> : null}
        </Card>

        {/* The loud variant: this is the thing the groomer must read. */}
        {job.care_note ? (
          <CareNote note={job.care_note} petName={job.pet_name} variant="loud"
            style={{ marginTop: space[4] }} />
        ) : null}

        {addons.length > 0 ? (
          <Card style={{ marginTop: space[4] }}>
            <T.Eyebrow style={{ marginBottom: 8 }}>Add-ons booked</T.Eyebrow>
            {addons.map((a) => <KV key={a.name} k={a.name} v={inr(a.price)} />)}
          </Card>
        ) : null}

        {mine && (started || complete) ? (
          <>
            <View style={{ marginTop: space[5], marginBottom: space[3] }}>
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8
              }}>
                <T.Eyebrow>Checklist</T.Eyebrow>
                <T.Xs>{progress.done} of {progress.total}</T.Xs>
              </View>
              <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
            </View>

            {checklist.map((group) => (
              <Card key={group.group} style={{ marginBottom: space[3], paddingVertical: space[2] }}>
                <T.Eyebrow style={{ marginTop: space[2], marginBottom: 4 }}>{group.group}</T.Eyebrow>
                {group.items.map((item) => (
                  <Pressable
                    key={item.item_key}
                    onPress={() => !complete && tick(item)}
                    disabled={complete}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: space[3],
                      paddingVertical: 11, opacity: pressed ? 0.7 : 1
                    })}
                  >
                    <View style={{
                      width: 24, height: 24, borderRadius: 7, borderWidth: 2,
                      borderColor: item.done ? colors.ok[600] : colors.line2,
                      backgroundColor: item.done ? colors.ok[600] : 'transparent',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      {item.done ? <Ico name="check" size={15} color={colors.white} /> : null}
                    </View>
                    <Text style={{
                      ...type.sm, flex: 1,
                      color: item.done ? colors.ink[3] : colors.ink[1],
                      textDecorationLine: item.done ? 'line-through' : 'none'
                    }}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            ))}

            <Card style={{ marginTop: space[2] }}>
              <T.Eyebrow style={{ marginBottom: space[3] }}>Photos</T.Eyebrow>
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                {['before', 'after'].map((phase) => {
                  const shot = photos.find((p) => p.phase === phase);
                  return (
                    <View key={phase} style={{ flex: 1, gap: 6 }}>
                      <T.Xs style={{ textTransform: 'capitalize' }}>{phase}</T.Xs>
                      {shot ? (
                        <PhotoTile seed={shot.seed} size={999} radius={radii.md} />
                      ) : (
                        <Pressable
                          onPress={() => act(() => appApi.jobs.photo(id, phase), `${phase} photo added.`)}
                          style={{
                            height: 96, borderRadius: radii.md, borderWidth: 1,
                            borderStyle: 'dashed', borderColor: colors.line2,
                            alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <Ico name="cam" size={22} color={colors.ink[4]} />
                          <T.Xs>Add</T.Xs>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        ) : null}

        {mine && started && !allTicked ? (
          <Banner tone="warn" icon="alert" style={{ marginTop: space[4] }}>
            {progress.total - progress.done} row
            {progress.total - progress.done === 1 ? '' : 's'} still to tick before you can complete.
          </Banner>
        ) : null}
      </Body>

      <Dock>
        {complete ? (
          <Button title="Job complete" variant="secondary" disabled />
        ) : !mine ? (
          <Button
            title={busy ? 'Claiming…' : `Claim · ${inr(job.payout)}`}
            loading={busy}
            onPress={() => act(() => appApi.jobs.claim(id), 'Job claimed.')}
          />
        ) : !travelling && !started ? (
          <Button
            title="Head over"
            loading={busy}
            onPress={() => act(() => appApi.jobs.setStatus(id, 'On the way'), 'Marked on the way.')}
          />
        ) : travelling ? (
          <>
            <Button
              title="Start grooming"
              loading={busy}
              onPress={() => act(() => appApi.jobs.setStatus(id, 'In progress'), 'Started.')}
            />
            <Button title="Navigate" variant="secondary" style={{ marginTop: 8 }}
              onPress={() => flash('Turn-by-turn navigation is not wired in this build.')} />
          </>
        ) : (
          <Button
            title={allTicked ? 'Complete job' : `Complete (${progress.done}/${progress.total})`}
            disabled={!allTicked}
            loading={busy}
            onPress={() => act(async () => {
              await appApi.jobs.complete(id);
              navigation.replace('JobDone', { id });
            })}
          />
        )}
      </Dock>
      <Toast message={toast} />
    </Screen>
  );
}

export function JobDoneScreen({ route, navigation }) {
  const { id } = route.params;
  const { data, loading } = useApi(() => appApi.jobs.get(id), [id]);

  if (loading) return <Screen><Loading /></Screen>;
  const job = data.job;

  return (
    <Screen>
      <Body contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space[4] }}>
          <Ring pet={{ art: job.pet_art }} size={110} state="done" progress={1} />
          <T.Hero style={{ textAlign: 'center' }}>Nicely done</T.Hero>
          <T.Body style={{ textAlign: 'center' }}>
            {job.pet_name}’s {job.service_label.toLowerCase()} is complete. The owner can
            see the before and after now.
          </T.Body>
          <Card style={{ alignSelf: 'stretch', marginTop: space[3] }}>
            <KV k="Payout" v={inr(job.payout)} />
            <KV k="Added to" v="Your next batch" />
          </Card>
        </View>
      </Body>
      <Dock>
        <Button title="Back to jobs" onPress={() => navigation.navigate('JobsHome')} />
      </Dock>
    </Screen>
  );
}
