<script lang="ts">
  export let data: any;
  const labels: Record<string, string> = { business: 'Business', general: 'Friendship', dating: 'Dating' };
  const names: Record<string, string> = {
    'qr.landing_opened': 'QR-tagged landing', 'profile.viewed': 'Link profile views',
    'dorian.conversation_requested': 'Dorian invitations accepted',
    'dorian.session_issued': 'Voice sessions issued',
    'dorian.conversation_started': 'Provider-confirmed starts',
    'dorian.conversation_completed': 'Confirmed conversations',
    'dorian.conversation_failed': 'Technical failures',
    'dorian.conversation_returned': 'Returning participants', 'value.reported': 'Feedback received',
    'relationship.connection_requested': 'Connection requests'
  };
</script>
<svelte:head><title>Pilot Product Intelligence - Relish</title></svelte:head>
<div class="container" style="padding:20px 12px;max-width:1000px">
  <h1>Pilot Product Intelligence</h1>
  <p>First-party measurements of your own three public profiles. Counts represent recorded events, not unique human beings. QR-tagged visits are not independently verified physical scans.</p>
  {#if data.capped}<p role="alert">Only the 4,000 most recent events are shown. Filter or export before using historical percentages.</p>{/if}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px">
    {#each data.metrics as metric}
      <section class="card" style="padding:16px">
        <h2>{labels[metric.domainKey] || metric.domainKey}</h2>
        <p><strong>{metric.visitors}</strong> identifiable participant(s) who opted in</p>
        <table><tbody>
          {#each metric.counts as count}
            <tr><th style="text-align:left;padding:5px 8px 5px 0">{names[count.type] || count.type}</th><td style="text-align:right">{count.count}</td></tr>
          {/each}
        </tbody></table>
        <p>Helpful feedback: {metric.helpfulYes} yes / {metric.helpfulNo} no.</p>
      </section>
    {/each}
  </div>
  <h2>Recent participant journeys</h2>
  <p>Visible only to the authorised pilot owner. The short identifier is for operational distinction, not identity verification.</p>
  {#if data.recentJourneys.length}
    <div style="overflow-x:auto"><table style="width:100%"><thead><tr><th>Date</th><th>Context</th><th>Participant</th><th>Confirmed calls</th><th>Signals</th></tr></thead>
      <tbody>{#each data.recentJourneys as journey}
        <tr><td>{new Date(journey.date).toLocaleDateString()}</td><td>{labels[journey.domainKey]}</td><td>{journey.visitorHint}…</td><td>{journey.conversations}</td><td>{journey.events.join(', ')}</td></tr>
      {/each}</tbody>
    </table></div>
  {:else}<p>No participant journeys recorded yet.</p>{/if}
  <p>Only explicit participant feedback is counted as participant-confirmed value. An AI guess is not a value event.</p>
</div>
