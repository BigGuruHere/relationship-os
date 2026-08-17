<!-- src/routes/agents/enrichment/new/+page.svelte -->
<script lang="ts">
  export let data: any;
  export let form: any;

  const defaults = data?.defaults ?? {};
  const defaultGoal = defaults.enrichmentGoal || 'Find public evidence-backed contact details such as name, role/title, company, website, LinkedIn, email, and phone. Do not invent or guess details. Stage proposals for human review before applying to CRM.';
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 5</div>
      <h1>Contact Enrichment</h1>
      <p class="muted">Stage public contact details with source evidence. Nothing is applied to CRM until reviewed.</p>
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
      <div class="grid three">
        <label>Mode
          <select name="mode">
            <option value="contact" selected={defaults.mode === 'contact'}>Enrich contact</option>
            <option value="company" selected={defaults.mode === 'company'}>Enrich company</option>
            <option value="find_contacts" selected={defaults.mode === 'find_contacts'}>Find company contacts</option>
          </select>
        </label>
        <label>Entity type
          <select name="entityType">
            <option value="" selected={!defaults.entityType}>Pasted/manual target</option>
            <option value="contact" selected={defaults.entityType === 'contact'}>Contact</option>
            <option value="company" selected={defaults.entityType === 'company'}>Company</option>
            <option value="research_candidate" selected={defaults.entityType === 'research_candidate'}>Research candidate</option>
          </select>
        </label>
        <label>Entity ID
          <input name="entityId" value={defaults.entityId || ''} placeholder="Paste Relish record id when enriching an existing record" />
        </label>
      </div>
      <div class="grid two">
        <label>Target person
          <input name="targetName" value={defaults.targetName || ''} placeholder="e.g. Daniel Morgan / Michael" />
        </label>
        <label>Company
          <input name="companyName" value={defaults.companyName || ''} placeholder="e.g. Harbour Lane Finance / Mocha Finance" />
        </label>
      </div>
      <label>Source text / notes
        <textarea name="sourceText" rows="7" placeholder="Paste website text, LinkedIn details, directory snippets, notes, or search results. The agent will only stage evidence-backed details.">{defaults.sourceText || ''}</textarea>
      </label>
    </section>

    <section>
      <h2>Research</h2>
      <label class="check"><input type="checkbox" name="enableWebResearch" checked={defaults.enableWebResearch !== false} /> Run live web research</label>
      <label>Research provider
        <select name="researchProvider">
          <option value="auto" selected={(defaults.researchProvider || 'auto') === 'auto'}>Auto</option>
          <option value="tavily" selected={defaults.researchProvider === 'tavily'}>Tavily</option>
          <option value="brave" selected={defaults.researchProvider === 'brave'}>Brave Search</option>
          <option value="openai" selected={defaults.researchProvider === 'openai'}>OpenAI web search</option>
        </select>
      </label>
      <label>Enrichment goal
        <textarea name="enrichmentGoal" rows="4">{defaultGoal}</textarea>
      </label>
    </section>

    <div class="actions">
      <button class="btn primary" type="submit">Run enrichment agent</button>
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
  .check { display: flex; align-items: center; gap: 8px; }
  input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: var(--surface); color: inherit; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .error { color: var(--danger); padding: 12px; }
  @media (max-width: 760px) { .header, .grid.two, .grid.three { display: grid; grid-template-columns: 1fr; } }
</style>
