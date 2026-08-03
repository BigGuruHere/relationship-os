<!-- src/routes/agents/outreach/new/+page.svelte -->
<script lang="ts">
  export let data: any;
  export let form: any;
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 3</div>
      <h1>Start Outreach Agent</h1>
      <p class="muted">This safe version can optionally run controlled web research, stage company/contact candidates, score them, log sources, draft outreach, and create review tasks. It does not send email.</p>
    </div>
    <div class="actions">
      <a class="btn" href="/agents">Agents</a>
      <a class="btn" href="/agents/runs">Runs</a>
    </div>
  </div>

  {#if form?.error}<div class="card error">{form.error}</div>{/if}

  <form class="card panel" method="post" action="?/start">
    <div class="grid two">
      <label>
        <span>Sector</span>
        <input name="sector" placeholder="Mortgage brokers, allied health, aged care" required />
      </label>
      <label>
        <span>Geography</span>
        <input name="geography" placeholder="Victoria, Australia-wide, Melbourne" />
      </label>
    </div>

    <label>
      <span>Target description</span>
      <textarea name="targetDescription" rows="3" placeholder="Owner-led mortgage broking or finance broking books that may be open to sale."></textarea>
    </label>

    <label>
      <span>Outreach goal</span>
      <textarea name="outreachGoal" rows="3" placeholder="Find owners who may consider a conversation about selling, valuation, or buyer interest."></textarea>
    </label>

    <div class="grid three">
      <label>
        <span>Max candidates</span>
        <input name="maxCandidates" type="number" min="1" max="25" value="5" />
      </label>
      <label>
        <span>Link project</span>
        <select name="projectId">
          <option value="">No project</option>
          {#each data.projects as p}<option value={p.id}>{p.title} - {p.statusLabel}</option>{/each}
        </select>
      </label>
      <label>
        <span>Link deal</span>
        <select name="dealId">
          <option value="">No deal</option>
          {#each data.deals as d}<option value={d.id}>{d.title}</option>{/each}
        </select>
      </label>
    </div>



    <div class="card mini-panel">
      <h2>Research options</h2>
      <div class="grid three">
        <label class="check-row">
          <input type="checkbox" name="enableWebResearch" />
          <span>Run live web research</span>
        </label>
        <label class="check-row">
          <input type="checkbox" name="findContacts" checked />
          <span>Find likely owner/contact names</span>
        </label>
        <label>
          <span>Research provider</span>
          <select name="researchProvider">
            <option value="">Auto</option>
            <option value="tavily">Tavily</option>
            <option value="brave">Brave Search</option>
            <option value="openai">OpenAI web search</option>
          </select>
        </label>
      </div>
      <p class="muted small">Live research requires a provider key such as TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or RESEARCH_PROVIDER=openai with OPENAI_API_KEY. Without a key, the agent still works from pasted research.</p>
    </div>

    <label>
      <span>Pasted research / candidate list</span>
      <textarea name="sourceText" rows="10" placeholder="Paste Google results, directory listings, notes, company names, websites, owner names, or rough research here. The agent will stage candidates for review before anything is imported."></textarea>
    </label>

    <div class="note">
      <strong>Safety:</strong> The agent will not send email or create real CRM companies/contacts without your review. It creates staged candidates and approval requests first.
    </div>

    <button class="btn primary" type="submit">Run Outreach Agent</button>
  </form>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1 { margin: 0; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .panel { padding: 16px; display: grid; gap: 12px; }
  .mini-panel { padding: 12px; display: grid; gap: 8px; }
  .mini-panel h2 { margin: 0; font-size: 1rem; }
  .check-row { display: flex; gap: 8px; align-items: center; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .check-row input { width: auto; }
  .small { font-size: 0.9rem; margin: 0; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  label { display: grid; gap: 6px; font-weight: 700; }
  input, textarea, select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; box-sizing: border-box; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .note { border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: var(--surface-2); color: var(--muted); }
  .error { color: var(--danger); padding: 12px; margin-bottom: 12px; }
  @media (max-width: 760px) { .header, .grid.two, .grid.three { display: grid; grid-template-columns: 1fr; } }
</style>
