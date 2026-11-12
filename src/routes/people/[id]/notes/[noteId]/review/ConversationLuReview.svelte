<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { AssessmentReviewFinding, AssessmentStagePanel } from '$lib/server/livingUnderstanding/semanticAssessment';
  import type { loadConversationLuReview } from '$lib/server/foundation/luReview';

  export let data: Awaited<ReturnType<typeof loadConversationLuReview>>;
  export let form: {
    message?: string;
    draft?: { topic: string; prose: string };
    checked?: string[];
    retryKey?: string;
    reviewFindings?: AssessmentReviewFinding[];
    stageReview?: AssessmentStagePanel[];
  } | null | undefined;
  let busy = false;
  let copyStatus = '';
  const stageLabels = { decompose: 'Extraction', compose: 'Composition', audit: 'Audit' };
  $: stageReview = form?.stageReview ?? data.candidate?.stageReview ?? data.failedReview?.stageReview ?? [];
  $: reviewFindings = form?.reviewFindings ?? data.failedReview?.reviewFindings ?? [];
  $: reviewMessage = form?.message ?? data.failedReview?.message;

  async function copyItem(attempt: number, stage: AssessmentStagePanel['stage'], title: string, text: string) {
    try {
      await navigator.clipboard.writeText(stageLabels[stage] + ' · Attempt ' + attempt + '\n' + title + '\n' + text);
      copyStatus = 'Item copied.';
    } catch {
      copyStatus = 'Clipboard unavailable. Select and copy the item text.';
    }
  }
  $: labels = { self: 'Me', person: 'My view of ' + data.person.name, relationship: 'My view of our relationship' };
  $: base = '?conversation=1' + (data.candidate ? '&candidate=' + data.candidate.id : '');
  $: back = '/people/' + data.person.id + '?conversation=' + data.conversation.id;
  $: draft = form?.draft;
  $: checked = form?.checked ?? [];
  $: reviewAction = '?/decide&' + base.slice(1);

  const submit: SubmitFunction = ({ cancel }) => {
    if (busy) {
      cancel();
      return;
    }
    busy = true;
    return async ({ update }) => {
      try { await update({ reset: false }); } finally { busy = false; }
    };
  };

  function historyLink(group: string, revision?: number, topic?: string, evidence?: string) {
    const query = new URLSearchParams(base.slice(1));
    query.set('group', group);
    if (revision) query.set('revision', String(revision));
    if (topic) query.set('topic', topic);
    if (evidence) query.set('evidence', evidence);
    return '?' + query + '#history';
  }

  function label(value: string) {
    return value.toLowerCase().replaceAll('_', ' ');
  }

  function speaker(value?: string) {
    return value === 'OWNER' ? 'You' : value === 'AGENT' ? 'Dorian' : 'Unknown speaker';
  }
</script>

<section class="container" style="max-width: 48rem">
  <a href={back}>← Back to {data.person.name}</a>
  <h1>Review for Living Understanding</h1>
  <p>Your understanding reflects your perspective and stays private to you.</p>
  <details>
    <summary>Conversation summary</summary>
    <p class="text">{data.conversation.summary}</p>
  </details>
  <details>
    <summary>Full transcript</summary>
    {#each data.conversation.turns as turn (turn.id)}
      <p class="text"><strong>{speaker(turn.role)}</strong> {turn.text}</p>
    {/each}
  </details>
  {#if reviewMessage}<p role="alert">{reviewMessage}</p>{/if}
  {#if reviewFindings.length}
    <details>
      <summary>Why these suggestions were held</summary>
      <p>The audit flagged these draft claims. They were held before review and approval.</p>
      {#each reviewFindings as finding}
        <article>
          <h3>{label(finding.issue)}</h3>
          <p class="text">{finding.claim}</p>
          {#each finding.evidence as item}
            <blockquote>
              <strong>{speaker(item.speaker)} · {label(item.role)} · Turn {item.turnId}</strong>
              <p class="text">{item.quote}{item.shortened ? '…' : ''}</p>
            </blockquote>
          {/each}
        </article>
      {/each}
    </details>
  {/if}
  {#if data.enabled && stageReview.length}
    <details>
      <summary>Analysis steps</summary>
      <p>Private previews from this run. Earlier attempts may contain rejected wording or citations.</p>
      {#each stageReview as panel}
        <details>
          <summary>{stageLabels[panel.stage]} · Attempt {panel.attempt}{panel.reason ? ' · ' + label(panel.reason) : ''}</summary>
          {#each panel.items as item}
            <article>
              <h3>{item.title}</h3>
              <p class="text">{item.text}</p>
              <button type="button" class="btn" on:click={() => copyItem(panel.attempt, panel.stage, item.title, item.text)}>Copy item</button>
            </article>
          {/each}
          {#if panel.omitted}<p>{panel.omitted} more items omitted from this preview.</p>{/if}
          {#if panel.reason}<p>This step reported {label(panel.reason)}.</p>{/if}
          {#if !panel.items.length && !panel.reason}<p>No items in this step.</p>{/if}
        </details>
      {/each}
      <p role="status">{copyStatus}</p>
    </details>
  {/if}
  {#if data.stale}
    <p>These suggestions are no longer available. You can analyse the current conversation again.</p>
    {#if draft}<label>Your wording <textarea readonly value={draft.prose}></textarea></label>{/if}
  {/if}
  {#if data.status === 'APPROVE'}<p role="status">Selected updates saved.</p>
  {:else if data.status === 'DEFER'}<p role="status">Review deferred. The conversation is still saved.</p>
  {:else if data.status === 'REJECT'}<p role="status">Suggestions rejected. The conversation is still saved.</p>{/if}

  {#if data.candidate?.noChange}
    <p role="status">This conversation yielded no new updates to Living Understanding.</p>
  {:else if data.candidate}
    <h2>Suggested updates</h2>
    {#if data.enabled}
      <p>Select the updates to save. Use Edit wording to validate an edit before selecting it.</p>
      <!-- Separate form owners keep every action usable without JavaScript or nested forms. -->
      <form id="lu-decision" method="POST" action={reviewAction} use:enhance={submit}></form>
    {/if}
    {#each data.candidate.groups as group (group.group)}
      <fieldset>
        <legend>{labels[group.group]}</legend>
        {#each group.topics as topic (topic.key)}
          <article>
            <h3>{topic.title}</h3>
            <p class="muted">{topic.area} · {label(topic.timeScope)} · {label(topic.effect)}{topic.ownerEdited ? ' · Your wording' : ''}</p>
            {#if topic.before}
              <details><summary>Previously saved</summary><p class="text">{topic.before}</p></details>
            {/if}
            <p class="text">{topic.prose}</p>
            <details>
              <summary>Supporting evidence</summary>
              {#each topic.meanings as meaning}
                <p>{meaning.text}</p>
                <p class="muted">{label(meaning.kind)} · {label(meaning.basis)} · {label(meaning.asserter)}</p>
                {#if meaning.uncertainty}<p>{meaning.uncertainty}</p>{/if}
                {#each meaning.evidence as evidence}
                  <blockquote><strong>{speaker(evidence.speaker)} · {label(evidence.role)}</strong><p class="text">{evidence.quote}</p></blockquote>
                {/each}
              {/each}
            </details>
            {#if data.enabled}
              <label class="selection">
                <input form="lu-decision" type="checkbox" name="selected" value={topic.key} checked={checked.includes(topic.key)} />
                Approve {topic.title}
              </label>
              <details open={draft?.topic === topic.key}>
                <summary>Edit wording</summary>
                <form method="POST" action={'?/editProposal&' + base.slice(1)} use:enhance={submit}>
                  <input type="hidden" name="topic" value={topic.key} />
                  <label>Paragraph <textarea name="prose" required maxlength="6500" rows="5" value={draft?.topic === topic.key ? draft.prose : topic.prose}></textarea></label>
                  <button type="submit" class="btn" disabled={busy}>Validate edit</button>
                </form>
              </details>
            {/if}
          </article>
        {/each}
      </fieldset>
    {/each}
    {#if data.enabled}
      <div class="buttons">
        <button form="lu-decision" type="submit" class="btn primary" name="decision" value="APPROVE" disabled={busy}>Approve selected</button>
        <button form="lu-decision" type="submit" class="btn" name="decision" value="DEFER" disabled={busy}>Defer review</button>
        <button form="lu-decision" type="submit" class="btn" name="decision" value="REJECT" disabled={busy}>Reject suggestions</button>
      </div>
    {/if}
  {:else if data.enabled && data.conversation.completeness === 'COMPLETE'}
    <p>Analysing sends the full transcript and relevant private Living Understanding to OpenAI. You choose what to save.</p>
    <form method="POST" action="?/assessConversation&conversation=1" use:enhance={submit}>
      <input type="hidden" name="requestKey" value={form?.retryKey ?? data.requestKey} />
      <input type="hidden" name="sourceVersion" value={data.conversation.sourceVersion} />
      <button type="submit" class="btn primary" disabled={busy}>{busy ? 'Analysing…' : 'Analyse conversation'}</button>
    </form>
  {:else if data.enabled}
    <p>A complete transcript is required to suggest updates.</p>
  {/if}
  {#if !data.enabled}<p>Conversation review is read-only.</p>{/if}

  <h2 id="history">Saved Living Understanding</h2>
  {#if data.historySelection.revision || data.historySelection.topic}
    <p><a href={base + '#history'}>Back to current understanding</a></p>
  {/if}
  {#each data.history as group (group.group)}
    <section class="history">
      <h3>{labels[group.group]}</h3>
      <p>Revision {group.revision}{#if group.savedAt} · <time datetime={group.savedAt}>{group.savedAt.slice(0, 10)}</time>{/if}
        {#if group.revision > 1}
          · <a href={historyLink(group.group, group.revision - 1, data.historySelection.group === group.group ? data.historySelection.topic : undefined)}>Previous revision</a>
        {/if}
      </p>
      {#each group.topics as topic (topic.versionId)}
        <article>
          <h4>{topic.title}</h4>
          <p class="muted">{topic.area} · {label(topic.timeScope)} · {label(topic.effect)} · Topic version {topic.version}{topic.ownerEdited ? ' · Your wording' : ''}</p>
          <p class="text">{topic.prose}</p>
          <p>
            <a href={historyLink(group.group, group.revision, data.historySelection.group === group.group ? data.historySelection.topic : undefined, topic.versionId)}>View evidence</a>
            {#if topic.previousTopicRevision}
              · <a href={historyLink(group.group, topic.previousTopicRevision, topic.topicId)}>Earlier wording</a>
            {/if}
          </p>
          {#if topic.evidence}
            {#each topic.evidence as item}
              <blockquote>
                <strong>{speaker(item.speaker)} · {label(item.role)}</strong>
                <p class="text">{item.quote}</p>
                {#if item.origin}
                  <p class="muted">{label(item.origin.contentKind)} · {label(item.origin.epistemicBasis)} · {label(item.origin.asserterKind)} · {label(item.origin.generatorKind)}</p>
                {/if}
                {#if item.link}<a href={item.link} data-sveltekit-preload-data="off">Open source transcript</a>{/if}
              </blockquote>
            {/each}
          {/if}
        </article>
      {:else}<p>This topic is unavailable in revision {group.revision}.</p>{/each}
    </section>
  {:else}<p>No eligible updates saved yet.</p>{/each}
</section>

<style>
  article, details, fieldset, form, .buttons { margin: .75rem 0; }
  article, fieldset { border: 1px solid var(--border); padding: .8rem; min-inline-size: 0; }
  summary { cursor: pointer; }
  textarea { display: block; width: 100%; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .selection { display: flex; align-items: baseline; gap: .5rem; }
  .selection input { width: auto; }
  .buttons { display: flex; flex-wrap: wrap; gap: .5rem; }
  .history { margin-block: 1.25rem; }
  blockquote { margin: .65rem 0; padding-inline-start: .75rem; border-inline-start: 2px solid var(--border); }
</style>
