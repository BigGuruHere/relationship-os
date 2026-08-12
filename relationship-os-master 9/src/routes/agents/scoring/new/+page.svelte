<!-- src/routes/agents/scoring/new/+page.svelte -->
<script lang="ts">
  export let form: any;
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 4</div>
      <h1>Opportunity Scoring</h1>
      <p class="muted">Create an explainable scorecard for a candidate, company, contact, deal, or pasted target. Scores help prioritise attention only.</p>
    </div>
    <div class="actions">
      <a class="btn" href="/agents">Agents</a>
      <a class="btn" href="/agents/runs">Runs</a>
    </div>
  </div>

  {#if form?.error}<p class="error card">{form.error}</p>{/if}

  <form class="card form" method="post" action="?/run">
    <section>
      <h2>Target</h2>
      <div class="grid two">
        <label>Entity type
          <select name="entityType">
            <option value="">Pasted/manual target</option>
            <option value="research_candidate">Research candidate</option>
            <option value="company">Company</option>
            <option value="contact">Contact</option>
            <option value="deal">Deal</option>
            <option value="project">Project</option>
          </select>
        </label>
        <label>Entity ID
          <input name="entityId" placeholder="Paste Relish record id when scoring an existing record" />
        </label>
      </div>
      <label>Target name
        <input name="targetName" placeholder="e.g. Mocha Finance / Michael" />
      </label>
      <label>Additional target context
        <textarea name="targetContext" rows="7" placeholder="Paste research, notes, source snippets, call notes, or why this might be a fit."></textarea>
      </label>
    </section>

    <section>
      <h2>Scoring brief</h2>
      <label>Sector
        <input name="sector" placeholder="e.g. Mortgage brokers / finance brokers" />
      </label>
      <label>Scoring goal
        <textarea name="scoringGoal" rows="3">Prioritise this target for business-broker outreach. Score whether it is worth reviewing, importing, calling, emailing, or creating a deal.</textarea>
      </label>
      <label>Buyer mandate or opportunity context
        <textarea name="buyerMandate" rows="5" placeholder="e.g. Buyer looking for mortgage broking or finance broking books, trail books, client books, or whole brokerages. Preference for owner-led businesses where a principal may consider stepping back or selling."></textarea>
      </label>
    </section>

    <div class="actions">
      <button class="btn primary" type="submit">Run scoring agent</button>
    </div>
  </form>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1, h2 { margin: 0; }
  h2 { font-size: 1rem; margin-bottom: 10px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .form { padding: 16px; display: grid; gap: 18px; }
  label { display: grid; gap: 6px; font-weight: 700; }
  input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: var(--surface); color: inherit; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .error { color: var(--danger); padding: 12px; }
  @media (max-width: 760px) { .header, .grid.two { display: grid; grid-template-columns: 1fr; } }
</style>
