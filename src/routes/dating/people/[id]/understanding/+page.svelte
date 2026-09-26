<script lang="ts">
  // Stage 8.12.0.1: one initial decision, then explicit Edit and History per statement.
  // All actions are operator actions, never participant confirmation or disclosure permission.
  export let data: any;
  export let form: any;
  let editingId: string | null = null;
  let suggestionPage = 0;
  let selectedClaimId: string = data.focusClaimId ?? "";
  let topicPanelOpen = false;
  $: selectedClaim = data.currentKnowledge.find((claim: any) => claim.id === selectedClaimId) ?? null;
  $: selectedClaimAssignments = data.topicTree.flatMap((realm: any) => realm.topics.flatMap((topic: any) => topic.claims.some((claim: any) => claim.id === selectedClaimId) ? [{ realm: realm.name, topic: topic.name, topicId: topic.id }] : []));
  const SUGGESTIONS_PER_PAGE = 12;
</script>
<svelte:head><title>Living Understanding - Relish</title></svelte:head>
<div class="container understanding-page">
  <nav class="workflow-nav"><a href={`/dating/people/${data.personId}#personal-reflections`}>← Personal reflections</a>{#if data.selectedSource}<a href={`/dating/people/${data.personId}/understanding`}>View full Living Understanding →</a>{/if}</nav>
  {#if data.selectedSource}
    <header class="focus-heading"><p class="eyebrow">Reflection → Knowledge</p><h1>Review this reflection</h1><p class="muted">Choose which individual pieces of this reflection should become proposed or operator-reviewed knowledge. Organise confirmed statements into topics afterwards.</p></header>
    <section class="card source-preview" aria-label="Original reflection"><h2>Original reflection</h2><p class="muted small">Recorded {new Date(data.selectedSource.at).toLocaleString()} · Private to this Dating space</p><blockquote>{data.selectedSource.text}</blockquote></section>
  {:else}
    <header class="focus-heading"><p class="eyebrow">Living Understanding</p><h1>{data.name}</h1><p class="muted">Organise this person's current knowledge by realm and topic. Proposed statements and source history remain below.</p></header>
    {#if data.reviewSaved}<p class="saved-message" role="status">Knowledge review saved. Confirmed statements appear under Realms and topics when you assign them. Select a statement below to organise it.</p>{/if}
    {#if data.currentKnowledge.length}<p><a class="btn" href="#assign-knowledge">Assign an existing statement to a topic ↓</a></p>{/if}
  {/if}
  {#if !data.selectedSource}
    <section class="card panel" id="realms">
      <div class="section-heading"><div><h2>Realms and topics</h2><p class="muted">Each topic groups related, individually recorded knowledge. Assigning a statement does not change its evidence or disclose it.</p></div><button type="button" class="btn" on:click={() => topicPanelOpen = !topicPanelOpen} aria-expanded={topicPanelOpen}>{topicPanelOpen ? 'Close topic form' : '+ Create topic'}</button></div>
      {#if form?.topicError}<p class="error" role="alert">{form.topicError}</p>{/if}
      {#if topicPanelOpen}
        <form method="POST" action="?/createTopic#realms" class="topic-create-form">
          <label for="realm-select">Area of life</label><select id="realm-select" name="realmKey" required>{#each data.realms as realm}<option value={realm.key}>{realm.name}</option>{/each}</select>
          <label for="topic-name">New topic name</label><input id="topic-name" name="topicName" minlength="2" maxlength="100" required placeholder="e.g. Relationship readiness" />
          <button class="btn primary" type="submit">Create topic</button>
        </form>
      {/if}
      {#if !data.topicTree.length}<p class="muted">No topics yet. Create one above; your existing knowledge will not change.</p>{/if}
      {#each data.topicTree as realm (realm.id)}
        <div class="realm-entry"><h3>{realm.name}</h3>
          {#each realm.topics as topic (topic.id)}
            <div class="topic-entry"><h4>{topic.name} <span class="muted small">({topic.claims.length})</span></h4>
              {#if !topic.claims.length}<p class="muted small">No current knowledge assigned.</p>{/if}
              {#each topic.claims as claim (claim.id)}
                <div class="topic-claim"><p class="current-statement">{claim.statement}</p><p class="muted small">{claim.kind.replaceAll('_', ' ')} · {claim.authority === 'THIRD_PARTY_REPORTED' ? 'Operator reviewed (not participant confirmed)' : claim.authority.replaceAll('_', ' ')}</p>
                  <form method="POST" action="?/removeTopic#realms"><input type="hidden" name="topicId" value={topic.id} /><input type="hidden" name="claimId" value={claim.id} /><button type="submit" class="btn">Remove assignment</button></form>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </section>
    <section class="card panel" id="assign-knowledge">
      <h2>Assign a statement to a topic</h2>
      <p class="muted">First select the exact statement, then choose the topic it belongs to. You can assign one statement to multiple topics.</p>
      {#if !data.currentKnowledge.length}<p>No active knowledge to organise yet. Add knowledge from a reflection first.</p>{:else}
        <label for="claim-to-organise">1. Statement to organise</label>
        <select id="claim-to-organise" bind:value={selectedClaimId}>
          <option value="">Select a current statement…</option>
          {#each data.currentKnowledge as claim (claim.id)}<option value={claim.id}>{claim.statement}</option>{/each}
        </select>
        {#if selectedClaim}
          <div class="selected-statement" aria-live="polite">
            <p class="eyebrow">You are assigning this statement</p>
            <p class="selected-text">{selectedClaim.statement}</p>
            <p class="muted small">{selectedClaim.kind.replaceAll('_', ' ')} · {selectedClaim.authority === 'THIRD_PARTY_REPORTED' ? 'Operator reviewed, not participant confirmed' : selectedClaim.authority.replaceAll('_', ' ')}</p>
            {#if selectedClaimAssignments.length}<p class="small"><strong>Already assigned to:</strong> {selectedClaimAssignments.map((assignment) => `${assignment.realm} → ${assignment.topic}`).join('; ')}</p>{:else}<p class="muted small">This statement has no topic assignments yet.</p>{/if}
          </div>
          {#if data.topicTree.some((realm) => realm.topics.length)}
            <form method="POST" action="?/assignTopic#assign-knowledge" class="assignment-form">
              <input type="hidden" name="claimId" value={selectedClaimId} />
              <input type="hidden" name="focusClaimId" value={selectedClaimId} />
              <label for="target-topic">2. Topic to add it to</label>
              <select id="target-topic" name="topicId" required><option value="" disabled selected>Choose a topic…</option>
                {#each data.topicTree as realm}<optgroup label={realm.name}>{#each realm.topics as topic}<option value={topic.id} disabled={selectedClaimAssignments.some((assignment) => assignment.topicId === topic.id)}>{topic.name}{selectedClaimAssignments.some((assignment) => assignment.topicId === topic.id) ? ' (already assigned)' : ''}</option>{/each}</optgroup>{/each}
              </select>
              <button type="submit" class="btn primary">Assign this statement</button>
            </form>
          {:else}<p class="muted">Create a topic in Realms and topics above before assigning this statement.</p>{/if}
        {/if}
      {/if}
    </section>
    <details class="card panel" id="current-knowledge"><summary><strong>All current knowledge ({data.currentKnowledge.length})</strong></summary>
      <p class="muted small">Each item is individually recorded. Assignment to a topic does not confirm or share it.</p>
      {#each data.currentKnowledge as claim (claim.id)}
        <article class="entry"><p class="current-statement">{claim.statement}</p><p class="muted small">{claim.kind.replaceAll('_', ' ')} · {claim.authority === 'THIRD_PARTY_REPORTED' ? 'Operator reviewed' : claim.authority.replaceAll('_', ' ')} · {claim.evidenceCount} linked source(s)</p><a href="#assign-knowledge" on:click={() => selectedClaimId = claim.id}>Organise this statement →</a></article>
      {/each}
    </details>
  {/if}
  {#if data.selectedSource}
    <section class="card panel" id="knowledge-suggestions">
      <h2>1. Extract individual knowledge</h2>
      <p class="muted small">With your permission, Dorian checks the full reflection for distinct, evidence-backed knowledge and, for longer reflections, makes a second pass for missed topics. The first page prioritises distinct, current understanding. Additional supported suggestions remain available on subsequent review pages. Review each independently; no suggestion is confirmed or shared automatically.</p>
      <form method="POST" action={`?/suggest&sourceInteractionId=${encodeURIComponent(data.selectedSource.id)}#knowledge-suggestions`}>
        <input type="hidden" name="sourceInteractionId" value={data.selectedSource.id} />
        <label><input type="checkbox" name="allowModelProcessing" value="YES" required /> Allow AI processing of this private reflection for knowledge suggestions.</label>
        <button type="submit" class="btn">Suggest knowledge from reflection</button>
      </form>
      {#if form?.suggestionError}<p class="error" role="alert">{form.suggestionError}</p>{/if}
      {#if form?.diagnostics && form?.suggestionSourceId === data.selectedSource.id}
        <details class="card diagnostic-panel">
          <summary>Development diagnostics - candidate counts only</summary>
          <p class="muted small">Available only when DATING_KNOWLEDGE_DIAGNOSTICS=YES outside production. Counts do not include the reflection or proposed statement text. These checks cannot determine whether Dorian missed information that it never proposed.</p>
          <table>
            <thead><tr><th>Measure</th><th>First pass</th><th>Coverage pass</th><th>Combined</th></tr></thead>
            <tbody>
              <tr><th>Received</th><td>{form.diagnostics.firstPass.inputCount}</td><td>{form.diagnostics.secondPass?.inputCount ?? 'Not run'}</td><td>{form.diagnostics.combined.inputCount}</td></tr>
              <tr><th>Invalid or unsupported</th><td>{form.diagnostics.firstPass.invalidOrUnsupportedCount}</td><td>{form.diagnostics.secondPass?.invalidOrUnsupportedCount ?? '-'}</td><td>{form.diagnostics.combined.invalidOrUnsupportedCount}</td></tr>
              <tr><th>Exact duplicates</th><td>{form.diagnostics.firstPass.exactDuplicateCount}</td><td>{form.diagnostics.secondPass?.exactDuplicateCount ?? '-'}</td><td>{form.diagnostics.combined.exactDuplicateCount}</td></tr>
              <tr><th>Near duplicates</th><td>{form.diagnostics.firstPass.nearDuplicateCount}</td><td>{form.diagnostics.secondPass?.nearDuplicateCount ?? '-'}</td><td>{form.diagnostics.combined.nearDuplicateCount}</td></tr>
              <tr><th>Distinct eligible</th><td>{form.diagnostics.firstPass.eligibleCount}</td><td>{form.diagnostics.secondPass?.eligibleCount ?? '-'}</td><td>{form.diagnostics.combined.eligibleCount}</td></tr>
              <tr><th>Selected</th><td>{form.diagnostics.firstPass.displayedCount}</td><td>{form.diagnostics.secondPass?.displayedCount ?? '-'}</td><td>{form.diagnostics.combined.displayedCount}</td></tr>
              <tr><th>Past review limit</th><td>{form.diagnostics.firstPass.beyondLimitCount}</td><td>{form.diagnostics.secondPass?.beyondLimitCount ?? '-'}</td><td>{form.diagnostics.combined.beyondLimitCount}</td></tr>
            </tbody>
          </table>
          <p class="muted small">Second pass: {form.diagnostics.secondPassAttempted ? (form.diagnostics.secondPassSucceeded ? 'completed' : 'unavailable') : 'not needed'}. Review pages: {form.diagnostics.reviewPageCount}. Repeated evidence passage among selected proposals: {form.diagnostics.combined.quoteReusedAcrossSelected}.</p>
          <p class="muted small">Heuristic uncertainty check: mentioned in source - {form.diagnostics.combined.sourceMentionsUncertainty ? 'yes' : 'no'}; present in selected supporting material - {form.diagnostics.combined.selectedMentionsUncertainty ? 'yes' : 'no'}. This only detects wording, not preservation of meaning.</p>
        </details>
      {/if}
      {#if form?.suggestions && form?.suggestionSourceId === data.selectedSource.id}
        {#if form.suggestions.length === 0}<p>No supported suggestions found. You can add knowledge manually below.</p>{:else}<p class="muted small">{form.suggestions.length} suggestions available across {Math.ceil(form.suggestions.length / SUGGESTIONS_PER_PAGE)} review page(s). The source may contain further details; add those manually below.</p>{/if}
        <form method="POST" action="?/saveSuggestions">
          <input type="hidden" name="sourceInteractionId" value={data.selectedSource.id} />
          <input type="hidden" name="count" value={form.suggestions.length} />
          {#if form.suggestions.length > SUGGESTIONS_PER_PAGE}
            <div class="actions">
              <button type="button" class="btn" disabled={suggestionPage === 0} on:click={() => suggestionPage -= 1}>Previous suggestions</button>
              <span>Page {suggestionPage + 1} of {Math.ceil(form.suggestions.length / SUGGESTIONS_PER_PAGE)}</span>
              <button type="button" class="btn" disabled={(suggestionPage + 1) * SUGGESTIONS_PER_PAGE >= form.suggestions.length} on:click={() => suggestionPage += 1}>Next suggestions</button>
            </div>
          {/if}
          {#each form.suggestions as suggestion, i}
            <article class="card entry" style:display={Math.floor(i / SUGGESTIONS_PER_PAGE) === suggestionPage ? 'block' : 'none'}>
              <p class="eyebrow">Suggestion {i + 1}: proposed knowledge</p>
              <label for={`suggestion-statement-${i}`}>What Dorian thinks this says about the person</label>
              <textarea id={`suggestion-statement-${i}`} name={`statement_${i}`} rows="3" maxlength="600" required>{suggestion.statement}</textarea>
              <p class="muted small"><strong>Evidence in the original reflection:</strong></p>
              <blockquote>{suggestion.evidenceQuote}</blockquote>
              <input type="hidden" name={`evidence_${i}`} value={suggestion.evidenceQuote} />
              <label for={`suggestion-kind-${i}`}>Knowledge type</label>
              <select id={`suggestion-kind-${i}`} name={`kind_${i}`} value={suggestion.kind}>
                <option value="FACT">Fact or background</option><option value="WANT">Want or need</option>
                <option value="OFFER">What they offer</option><option value="PREFERENCE">Preference or interest</option>
                <option value="CONSTRAINT">Constraint or boundary</option><option value="OBJECTIVE">Objective</option>
                <option value="OTHER">Other</option>
              </select>
              <label for={`suggestion-decision-${i}`}>Review decision</label>
              <select id={`suggestion-decision-${i}`} name={`decision_${i}`}>
                <option value="PENDING">Save as proposal</option>
                <option value="CONFIRMED">Confirm as operator</option>
                <option value="DEFERRED">Not sure yet</option>
                <option value="REJECTED">Reject</option>
                <option value="SKIP">Do not save this suggestion</option>
              </select>
            </article>
          {/each}
          {#if form.suggestions.length > SUGGESTIONS_PER_PAGE}
            <div class="actions">
              <button type="button" class="btn" disabled={suggestionPage === 0} on:click={() => suggestionPage -= 1}>Previous suggestions</button>
              <button type="button" class="btn" disabled={(suggestionPage + 1) * SUGGESTIONS_PER_PAGE >= form.suggestions.length} on:click={() => suggestionPage += 1}>Next suggestions</button>
            </div>
          {/if}
          <button type="submit" class="btn primary">Save reviewed knowledge (all pages)</button>
          <p class="muted small">You can edit and decide on every element before saving them together. Your decisions do not authorise disclosure.</p>
        </form>
      {/if}
    </section>
  {/if}
  <section class="card panel">
    <h2>{data.selectedSource ? "2. Add something Dorian missed" : "Add knowledge manually"}</h2>
    <p>Begin with one line about their life, interests or what might make a difference for them.</p>
    <form method="POST" action={`?/propose${data.selectedSource ? `&sourceInteractionId=${encodeURIComponent(data.selectedSource.id)}` : ""}`}>
      {#if data.selectedSource}<input type="hidden" name="sourceInteractionId" value={data.selectedSource.id} />{/if}
            <label for="kind">Knowledge type</label>
      <select id="kind" name="kind">
        <option value="PREFERENCE">Preference or interest</option><option value="WANT">Want or need</option>
        <option value="FACT">Fact or background</option><option value="OBJECTIVE">Objective</option>
        <option value="OFFER">What they offer</option><option value="CONSTRAINT">Constraint or boundary</option>
        <option value="OTHER">Other or emerging understanding</option>
      </select>
      <label for="statement">Exact statement to record</label>
      <textarea id="statement" name="statement" rows="3" maxlength="600" required placeholder="They enjoy walking and would welcome someone to share that with."></textarea>
      <label for="note">Source or context (optional)</label>
      <textarea id="note" name="note" rows="2" maxlength="1000" placeholder="Their introductory conversation with Dorian"></textarea>
      <div class="actions">
        <button type="submit" name="decision" value="CONFIRMED" class="btn primary">Confirm</button>
        <button type="submit" name="decision" value="DEFERRED" class="btn">Not sure yet</button>
        <button type="submit" name="decision" value="REJECTED" class="btn">Reject</button>
        <button type="submit" name="decision" value="PENDING" class="btn">Save proposal</button>
      </div>
      <p class="muted small">One save creates one statement and its initial decision. Confirm means operator-reviewed, not confirmed by the person.</p>
    </form>
  </section>
  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  {#if !data.selectedSource}
  <details class="panel card existing-panel" id="existing-statements"><summary><strong>Existing proposals and review history ({data.entries.length})</strong></summary>
    {#if data.entries.length === 0}<p class="muted">No understanding recorded yet.</p>{/if}
    {#each data.entries as item (item.id)}
      <article class="card entry">
        <p class="muted small">{item.kind.replaceAll('_',' ')} · {item.proposedBy === 'DORIAN' ? 'Suggested by Dorian' : 'Operator proposal'} · Added {new Date(item.proposedAt).toLocaleString()}</p>
        {#if item.sourceInteractionId}<p class="muted small">Linked to an original private reflection</p>{/if}
        <p class="current-statement">{item.reviewedStatement ?? item.statement}</p>
        <p><strong>Status:</strong> {item.decision === 'CONFIRMED' ? 'Operator reviewed' : item.decision === 'REJECTED' ? 'Rejected' : item.decision === 'DEFERRED' ? 'Not sure yet' : 'Pending review'}</p>
        <div class="actions">
          <button type="button" class="btn" aria-expanded={editingId === item.id} on:click={() => editingId = editingId === item.id ? null : item.id}>{editingId === item.id ? 'Close edit' : 'Edit'}</button>
        </div>
        {#if editingId === item.id}
          <form method="POST" action="?/review" class="review-form">
            <input type="hidden" name="proposalId" value={item.id} />
            <label for={`review-${item.id}`}>Revise this understanding</label>
            <textarea id={`review-${item.id}`} name="statement" rows="3" maxlength="600" required>{item.reviewedStatement ?? item.statement}</textarea>
            <label for={`note-${item.id}`}>Why has this changed? (optional)</label>
            <input id={`note-${item.id}`} name="note" maxlength="1000" placeholder="A correction or new interpretation of the original experience" />
            <div class="actions">
              <button type="submit" name="decision" value="CONFIRMED" class="btn primary">Confirm</button>
              <button type="submit" name="decision" value="DEFERRED" class="btn">Not sure yet</button>
              <button type="submit" name="decision" value="REJECTED" class="btn">Reject</button>
              <button type="button" class="btn" on:click={() => editingId = null}>Cancel</button>
            </div>
            <p class="muted small">An unchanged decision and statement will not create duplicate history. Genuine revisions are retained.</p>
          </form>
        {/if}
        <details class="history-panel"><summary>History ({item.history.length} review{item.history.length === 1 ? '' : 's'})</summary>
          <div class="history"><strong>Original proposal</strong> · {new Date(item.proposedAt).toLocaleString()}<p>{item.statement}</p>{#if item.proposalNote}<p class="muted">Source: {item.proposalNote}</p>{/if}</div>
          {#each item.history as change}
            <div class="history"><strong>{change.decision}</strong> · {new Date(change.at).toLocaleString()} · {change.actor === 'OPERATOR' ? 'Operator' : change.actor}
              <p>{change.statement}</p>{#if change.note}<p class="muted">{change.note}</p>{/if}
            </div>
          {/each}
        </details>
      </article>
    {/each}
  </details>
  {/if}
  <p class="muted"><strong>Privacy:</strong> Operator confirmation is not independently verified by the participant and does not grant permission to use this information in other spaces or disclose it to anyone.</p>
</div>
<style>
  .understanding-page { max-width: 920px; padding: 14px; }
  .workflow-nav { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; margin: 8px 0 22px; }
  .focus-heading { margin: 18px 0 24px; } .eyebrow { text-transform: uppercase; letter-spacing: .07em; font-size: .78rem; font-weight: 700; color: var(--muted); }
  .saved-message { padding: 14px; border: 1px solid #518c75; border-radius: 10px; }
  .source-preview { padding: 18px; border-left: 4px solid var(--primary, #518c75); }
  .source-preview blockquote { white-space: pre-wrap; max-height: 260px; overflow-y: auto; }
  .section-heading { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 16px; }
  .topic-create-form { padding:16px; margin:16px 0; border:1px solid var(--border); border-radius:10px; }
  .selected-statement { border-left: 4px solid var(--primary, #518c75); background: var(--surface); padding: 16px; margin: 14px 0; border-radius: 6px; }
  .selected-text { font-size: 1.16rem; font-weight: 600; white-space: pre-wrap; }
  details.panel > summary { cursor: pointer; padding: 7px 0; }
  .panel { padding: 18px; margin: 15px 0; }
  .entry { padding: 18px; margin: 14px 0; }
  .panel form, .review-form { display: grid; gap: 10px; }
  .review-form { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
  .current-statement { font-size: 1.05rem; white-space: pre-wrap; }
  textarea, input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .muted { color: var(--muted); }
  .small { font-size: .9rem; }
  .error { color: var(--danger); }
  input[type="checkbox"] { width: auto; margin-right: 8px; }
  select { padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); }
  .realm-entry { border-top: 1px solid var(--border); padding: 12px 0; }
  .topic-entry { margin: 12px 0; padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
  .topic-claim { border-top: 1px solid var(--border); padding: 10px 0; }
  .assignment-form { border-top: 1px solid var(--border); padding: 12px 0; }
  .history { margin-top: 10px; padding: 12px; border-top: 1px solid var(--border); }
  .history-panel { margin-top: 12px; }
  .diagnostic-panel { margin-top: 12px; padding: 12px; overflow-x: auto; }
  .diagnostic-panel table { border-collapse: collapse; width: 100%; font-size: .88rem; }
  .diagnostic-panel th, .diagnostic-panel td { padding: 7px; border-bottom: 1px solid var(--border); text-align: left; }
</style>
