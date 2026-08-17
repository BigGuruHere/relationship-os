<script lang="ts">
  // PURPOSE: Render the create contact form.
  // SECURITY: No decryption is done here - all data is plain inputs from the user.
  import { enhance } from '$app/forms'; // IT: use enhance so redirects are handled smoothly
  export let form; // IT: SvelteKit enhances this with action results

  $: duplicateWarning = form?.duplicateWarning;
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:760px; margin: 0 auto;">
    <h1 style="margin-top:0;">Add contact</h1>

    {#if duplicateWarning}
      <section class="duplicate-warning" aria-live="polite">
        <h2>{duplicateWarning.title}</h2>
        <p>{duplicateWarning.message}</p>
        <div class="duplicate-list">
          {#each duplicateWarning.matches as match}
            <article class="duplicate-card">
              <div>
                <strong>{match.label}</strong>
                {#if match.position}<div class="muted small">{match.position}</div>{/if}
                {#if match.company}<div class="muted small">{match.company}</div>{/if}
                {#if match.email}<div class="muted small">{match.email}</div>{/if}
                {#if match.phone}<div class="muted small">{match.phone}</div>{/if}
                {#if match.matchReasons?.length}
                  <div class="reason-row">
                    {#each match.matchReasons as reason}<span class="reason-chip">{reason}</span>{/each}
                  </div>
                {/if}
              </div>
              <a class="btn" href={match.href} target="_blank" rel="noreferrer">Open</a>
            </article>
          {/each}
        </div>
        <p class="muted small">Opening an existing contact uses a new tab so you do not lose this form.</p>
      </section>
    {/if}

    <!-- IT: simple create form. Server validates and encrypts. -->
    <form method="post" action="?/create" use:enhance>
      {#if duplicateWarning}
        <input type="hidden" name="forceCreate" value="1" />
      {/if}

      <div class="field">
        <label for="fullName">Full name</label>
        <input id="fullName" name="fullName" required value={form?.values?.fullName || ''} />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={form?.values?.email || ''} />
      </div>

      <div class="field">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" value={form?.values?.phone || ''} />
      </div>

      <!-- IT: new company field - optional -->
      <div class="field">
        <label for="company">Company</label>
        <input id="company" name="company" placeholder="e.g. ACME Pty Ltd" value={form?.values?.company || ''} />
      </div>

      <div class="field">
        <label for="position">Position</label>
        <input id="position" name="position" placeholder="Head of Partnerships" value={form?.values?.position || ''} />
      </div>
      
      <div class="field">
        <label for="linkedin">LinkedIn</label>
        <input id="linkedin" name="linkedin" type="url" inputmode="url" placeholder="https://www.linkedin.com/in/username" value={form?.values?.linkedin || ''} />
      </div>

      <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
        <button class="btn primary">{duplicateWarning ? 'Create anyway' : 'Save'}</button>
        <a class="btn" href="/">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

<style>
  /* Light styling helpers, shared classes assumed to exist in your app.css */
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field label { font-size:0.95rem; color:#444; }
  .field input { padding:8px 10px; border:1px solid #ddd; border-radius:8px; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .duplicate-warning { border: 1px solid #f0c36a; background: #fff8e5; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
  .duplicate-warning h2 { margin: 0 0 6px; font-size: 1.05rem; }
  .duplicate-list { display: grid; gap: 8px; margin-top: 10px; }
  .duplicate-card { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; border: 1px solid rgba(0,0,0,0.08); background: white; border-radius: 10px; padding: 10px; }
  .reason-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .reason-chip { border: 1px solid rgba(0,0,0,0.12); border-radius: 999px; padding: 2px 7px; font-size: 0.8rem; background: #fafafa; }
</style>
