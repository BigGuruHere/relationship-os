<script lang="ts">
  // Stage 8.12.2: the person has a history even when no Introduction or touchpoint exists.
  // Pilot operations are administrator-authored; they are not participant verification or disclosure consent.
  export let data: any;
  export let form: any;
  let newTouchpoint = false;
  let newReflection = false;
</script>
<svelte:head><title>{data.person.name} - Personal history - Relish</title></svelte:head>
<div class="container person-page">
  <a href="/dating/people">← Dating people</a>
  <header>
    <h1>{data.person.name}</h1>
    <p class="muted">Their private, evolving history. An Introduction is optional, not the starting point.</p>
    <a class="btn" href={`/dating/people/${data.person.id}/understanding`}>Living Understanding</a>
  </header>
  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  <section class="card panel">
    <h2>Personal history</h2>
    <p class="muted">One chronological view of this person's experiences, including those without introductions or encounters.</p>
    {#if !data.timeline.length}<p class="muted">There is no history yet. Start with a personal reflection or record an encounter below.</p>{/if}
    {#each data.timeline as item (item.type + item.id)}
      <article class="entry">
        <p class="muted small">{new Date(item.at).toLocaleString()} · {item.type === 'REFLECTION' ? 'Private reflection' : item.type === 'TOUCHPOINT' ? 'Touchpoint' : 'Introduction'}</p>
        {#if item.href}<p><a href={item.href}><strong>{item.label}</strong></a></p>{:else}<p><strong>{item.label}</strong></p>{/if}
        <p>{item.detail}</p>
      </article>
    {/each}
  </section>
  <section class="card panel">
    <h2>Personal reflections</h2>
    <p class="muted">A thought, experience or conversation can be recorded without a meeting or introduction. These are operator-recorded accounts for this pilot.</p>
    <button class="btn primary" type="button" on:click={() => newReflection = !newReflection}>{newReflection ? 'Close' : 'Add reflection'}</button>
    {#if newReflection}
      <form method="POST" action="?/reflect">
        <label for="reflection">Private reflection</label>
        <textarea id="reflection" name="text" maxlength="5000" rows="4" required></textarea>
        <label for="reflection-touchpoint">Associated encounter (optional)</label>
        <select id="reflection-touchpoint" name="touchpointId"><option value="">No touchpoint - a personal reflection</option>
          {#each data.touchpoints as t}<option value={t.id}>{new Date(t.occurredAt).toLocaleDateString()} - {t.kind}</option>{/each}
        </select>
        <button class="btn primary" type="submit">Save private reflection</button>
      </form>
    {/if}
    {#if !data.reflections.length}<p class="muted">No personal reflections yet.</p>{/if}
    {#each data.reflections as r (r.id)}
      <article class="entry"><p class="muted small">{new Date(r.at).toLocaleString()} · {r.touchpointId ? 'Linked to an encounter' : 'Independent reflection'} · Operator-recorded</p><p>{r.text}</p><p><a href={`/dating/people/${data.person.id}/understanding?sourceInteractionId=${r.id}`}>Propose knowledge from this reflection</a></p></article>
    {/each}
  </section>
  <section class="card panel">
    <h2>Touchpoints</h2>
    <p class="muted">Individual encounters have their own attendees. A touchpoint can be independent or linked to an existing Relating history.</p>
    <button class="btn" type="button" on:click={() => newTouchpoint = !newTouchpoint}>{newTouchpoint ? 'Close' : 'Record touchpoint'}</button>
    {#if newTouchpoint}
      <form method="POST" action="?/touchpoint">
        <label for="kind">Type of encounter</label>
        <select id="kind" name="kind"><option value="IN_PERSON">In-person meeting</option><option value="CALL">Phone call</option><option value="VIDEO">Video call</option><option value="MESSAGE">Message exchange</option><option value="OTHER">Other encounter</option></select>
        <label for="occurredAt">When (optional)</label><input id="occurredAt" type="datetime-local" name="occurredAt" />
        <label for="relatingId">Ongoing Relating history (optional)</label>
        <select id="relatingId" name="relatingId"><option value="">Independent touchpoint</option>{#each data.groups as id}<option value={id}>Relating {id.slice(0,8)}...</option>{/each}</select>
        <fieldset><legend>Other attendees (you can select several)</legend>
          <p class="muted small">{data.person.name} will automatically be included.</p>
          {#each data.contacts as p}
            {#if p.id !== data.person.id}<label class="attendee"><input type="checkbox" name="attendeeIds" value={p.id} /> {p.name}</label>{/if}
          {/each}
        </fieldset>
        <label for="touchpoint-note">Private event note (optional)</label><textarea id="touchpoint-note" name="note" maxlength="3000" rows="2"></textarea>
        <button class="btn primary" type="submit">Save touchpoint</button>
      </form>
    {/if}
    {#if !data.touchpoints.length}<p class="muted">No encounters recorded yet. You can still add reflections above.</p>{/if}
    {#each data.touchpoints as t (t.id)}
      <article class="entry"><p><strong>{t.kind.replaceAll('_',' ')}</strong> · {new Date(t.occurredAt).toLocaleString()}</p><p class="muted small">Attendees: {t.attendees.join(', ')}</p><p class="muted small">{t.relatingId ? 'Part of an ongoing Relating history' : 'Independent encounter'}</p></article>
    {/each}
  </section>
  <section class="card panel">
    <h2>Introductions</h2>
    <p class="muted">Introductions are events in this person's history, not prerequisites for their experiences or reflections.</p>
    {#if !data.introductions.length}<p class="muted">No introductions recorded.</p>{/if}
    {#each data.introductions as item (item.id)}<p><a href={`/dating/introductions/${item.id}`}>{new Date(item.at).toLocaleDateString()} - {item.status}</a></p>{/each}
  </section>
  <p class="muted small"><strong>Privacy:</strong> This is the operator's Dating-custodied account. Neither the event nor a reflection grants other participants access to private information. Cross-context reuse requires a separate grant.</p>
</div>
<style>
  .person-page { max-width: 900px; padding: 16px; } .panel { padding: 18px; margin: 16px 0; } header { margin: 15px 0; }
  .panel form { display: grid; gap: 9px; margin: 15px 0; } .panel textarea, .panel input:not([type="checkbox"]), .panel select { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
  .entry { padding: 12px 0; border-top: 1px solid var(--border); white-space: pre-wrap; } .muted { color: var(--muted); } .small { font-size: .9rem; } .error { color: var(--danger); } .attendee { display:block; padding: 5px 0; }
</style>
