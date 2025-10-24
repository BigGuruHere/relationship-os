<!-- src/routes/inbox/+page.svelte -->
<!-- PURPOSE: Show a single Inbox with two sections: Reconnect and Reminders -->
<!-- SECURITY: Renders only non sensitive fields already authorized by the server -->

<script lang="ts">
    export let data: {
      reconnectDue: number;
      remindersOpenCount: number;
      dueReconnects: Array<{
        id: string;
        displayName: string | null;
        company: string | null;
        position: string | null;
        lastInteractionAt: string | null;
        cadenceDays: number | null;
        slug?: string | null;
      }>;
      reminders: Array<{
        id: string;
        title: string;
        dueAt: string | null;
        contactId: string | null;
      }>;
    };
  </script>
  
  <section class="inbox">
    <h1>Inbox</h1>
  
    <div class="section">
      <div class="section-header">
        <h2>Reconnect</h2>
        {#if data.reconnectDue > 0}<span class="pill">{data.reconnectDue}</span>{/if}
      </div>
  
      {#if data.dueReconnects.length === 0}
        <p class="muted">No reconnects due. Nice work.</p>
      {:else}
        <ul class="list">
          {#each data.dueReconnects as c}
            <li class="card">
              <div class="row">
                <div class="main">
                  <div class="name">{c.displayName || 'Unknown'}</div>
                  <div class="meta">
                    {#if c.position}{c.position}{/if}
                    {#if c.company}
                      {#if c.position} · {/if}{c.company}
                    {/if}
                  </div>
                </div>
                <div class="actions">
                  <a class="btn small" href={"/contacts/" + c.id}>Open</a>
                  <a class="btn ghost small" href={"/interactions/new?contactId=" + c.id}>Log</a>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  
    <div class="section" id="reminders">
      <div class="section-header">
        <h2>Reminders</h2>
        {#if data.remindersOpenCount > 0}<span class="pill">{data.remindersOpenCount}</span>{/if}
      </div>
  
      {#if data.reminders.length === 0}
        <p class="muted">No open reminders.</p>
      {:else}
        <ul class="list">
          {#each data.reminders as r}
            <li class="card">
              <div class="row">
                <div class="main">
                  <div class="name">{r.note}</div>
                  <div class="meta">
                    {#if r.dueAt}Due {new Date(r.dueAt).toLocaleDateString()}{/if}
                  </div>
                </div>
                <div class="actions">
                  {#if r.contactId}<a class="btn small" href={"/contacts/" + r.contactId}>Contact</a>{/if}
                  <a class="btn ghost small" href={"/reminders/" + r.id}>Open</a>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
  
  <style>
    /* PURPOSE: quick mobile-first layout styles for Inbox */
    .inbox { padding: 1rem; }
    .section { margin-top: 1rem; }
    .section-header { display: flex; align-items: center; gap: .5rem; }
    .pill { display:inline-block; min-width:1.25rem; padding:0 .4rem; border-radius:999px; font-size:.75rem; line-height:1.25rem; text-align:center; background:var(--accent, #444); color:white; }
    .list { list-style: none; padding: 0; margin: .5rem 0 0; display: grid; gap: .5rem; }
    .card { border: 1px solid var(--border, #e5e7eb); border-radius: .75rem; padding: .75rem; background: white; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .name { font-weight: 600; }
    .meta { font-size: .85rem; color: #6b7280; }
    .actions { display: flex; gap: .5rem; }
    .btn.small { font-size: .85rem; padding: .35rem .6rem; }
    .btn.ghost { background: transparent; border: 1px solid var(--border, #e5e7eb); }
    .muted { color: #6b7280; }
  </style>
  