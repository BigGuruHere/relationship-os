<script lang="ts">
  // Read-only trace from conversation evidence to authoritative revision.
  export let data: any;
</script>
<svelte:head><title>Dorian conversation - Relish</title></svelte:head>
<div class="detail"><a href="/general/admin/dorian-conversations">← All conversations</a>
  <h1>{data.call.participantName}</h1><p class="muted">{new Date(data.call.occurredAt).toLocaleString()}</p>
  <section><h2>Learning outcome</h2>
    {#if data.call.revisionNumber}
      <p>Incorporated into authoritative Living Understanding revision {data.call.revisionNumber}.</p>
      <p class="muted">This revision is linked to the original source in Relish's revision provenance. This operator view does not grant access to the participant's private editing screen.</p>
    {:else if data.call.status === 'NO_CHANGE'}
      <p>Processing completed successfully. Validated analysis found no new or changed understanding to incorporate. No authoritative revision was created.</p>
    {:else if data.call.status === 'FAILED'}
      <p>Automatic processing failed. The caller remains gated until successful manual recovery. See the worker's redacted diagnostic log.</p>
    {:else}<p>No authoritative revision linked to this call yet. Processing state: {data.call.contextState || data.call.status}.</p>{/if}
  </section>
  {#if data.call.inspection}
    <section>
      <h2>Living Understanding revision inspector</h2>
      <p>Saved revision {data.call.inspection.revisionNumber}, following {data.call.inspection.previousRevisionNumber ? `revision ${data.call.inspection.previousRevisionNumber}` : 'the initial understanding'}.</p>
      <p class="muted">{data.call.inspection.historicalReviewAvailability}</p>
      <p>{data.call.inspection.changes.filter((item: any) => item.changed).length} changed topics, {data.call.inspection.changes.filter((item: any) => !item.changed).length} carried forward unchanged.</p>
      {#each data.call.inspection.changes as topic}
        <article class="topic">
          <h3>{topic.realm} / {topic.topic}</h3>
          <p class="muted">{topic.changed ? 'Updated in this revision' : 'Unchanged from previous revision'} · {topic.operation}</p>
          {#if topic.changed}
            <h4>Before</h4><p>{topic.before ?? 'No previous understanding for this topic.'}</p>
          {/if}
          <h4>{topic.changed ? 'After' : 'Current understanding'}</h4><p>{topic.after}</p>
          <p class="muted">Evidence linked to this topic: {topic.sourceInteractionIds.length} source(s){topic.sourceInteractionIds.includes(data.call.id) ? ', including this conversation' : ''}.</p>
        </article>
      {/each}
      <p class="muted">Revision source links: {data.call.inspection.sourceInteractionIds.length}. These links establish provenance, not necessarily an individual topic change.</p>
    </section>
  {/if}
  {#if data.call.automaticReview}
    <section>
      <h2>Original automatic impact review</h2>
      <p class="muted">Stored encrypted pipeline trace from the completed automatic review. These are the original saved stages, not a reconstruction.</p>
      <p class="muted">Completed: {new Date(data.call.automaticReview.completedAt).toLocaleString()} · Previous revision: {data.call.automaticReview.baselineRevisionNumber ?? 'none'}</p>
      {#each data.call.automaticReview.pipelineStages as stage}
        <details class="topic">
          <summary>{stage.title} ({stage.status})</summary>
          <pre>{JSON.stringify(stage.data, null, 2)}</pre>
        </details>
      {/each}
    </section>
  {:else if data.call.revisionNumber}
    <section>
      <h2>Intermediate review history</h2>
      <p class="muted">No retained completed impact trace is available for this call. Initial revisions use a different pipeline; older completed drafts may already have expired. The authoritative before-and-after revision and source evidence above remain available.</p>
    </section>
  {/if}
  <section><h2>Conversation summary</h2><p>{data.call.summary || 'No separate summary available.'}</p></section>
  <section><h2>Original conversation evidence</h2><pre>{data.call.transcript}</pre></section>
</div>
<style>.detail{max-width:900px;margin:auto;padding:24px}.muted{color:var(--muted)}.topic{padding:12px 0;border-top:1px solid var(--border)}.topic h3{font-size:1rem}section{padding:18px 0;border-bottom:1px solid var(--border)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.6}</style>
