<script lang="ts">
  // PURPOSE: Owner-facing form for account role and capability grants.
  import { enhance } from '$app/forms';
  export let data: { availableGrants: string[]; pilotEnabled: boolean; pilotEmails: (string | null)[]; pilotEmail: string | null; users: { id: string; email: string; role: string; grants: string[]; createdAt: string }[] };
  export let form: { error?: string; success?: string; pilotEmail?: string } | null;
</script>

<svelte:head><title>Account permissions - Relish</title></svelte:head>
<main style="max-width:850px; margin:0 auto; padding:24px;">
  <h1>Account permissions</h1>
  <p>Only system owners can change user roles and capability grants. ContextSpace custody is separate.</p>
  {#if form?.error}<p role="alert" style="color:#b3261e">{form.error}</p>{/if}
  {#if form?.success}<p role="status">{form.success}</p>{/if}
  {#if data.pilotEnabled}
    <section class="card" style="margin:16px 0;padding:16px;">
      <h2>Foundation test account</h2>
      {#if form?.pilotEmail || data.pilotEmail}
        <p>Sign in from a private window with <strong>{form?.pilotEmail || data.pilotEmail}</strong> and the password you chose.</p>
        <p>Open My Profiles and publish the test profile when you’re ready to scan its QR code.</p>
      {/if}
      {#each data.pilotEmails as email}<p>DEV test login: <strong>{email}</strong></p>{/each}
      {#if data.pilotEmails.length < 2}
        <p>Create up to two fresh test logins for this DEV database.</p>
        <form method="POST" action="?/createFoundationTest" use:enhance>
          <input type="hidden" name="pilotSlot" value={data.pilotEmails.length ? '2' : '1'} />
          <label>Test password
            <input type="password" name="pilotPassword" minlength="16" maxlength="128" autocomplete="new-password" required />
          </label>
          <button class="btn" type="submit">Create test account</button>
        </form>
      {/if}
    </section>
  {/if}
  {#each data.users as user (user.id)}
    <section class="card" style="margin:16px 0;padding:16px;">
      <h2 style="font-size:1rem;overflow-wrap:anywhere;">{user.email}</h2>
      <p style="font-size:.8rem;opacity:.75">ID: {user.id}</p>
      <form method="POST" action="?/save" use:enhance>
        <input type="hidden" name="userId" value={user.id} />
        <label>Account role
          <select name="role" value={user.role}>
            <option value="guest">Guest</option>
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <fieldset style="margin:12px 0;padding:12px;">
          <legend>Independent capabilities (for members)</legend>
          {#each data.availableGrants as capability}
            <label style="display:inline-flex;gap:6px;margin:8px 16px 8px 0;align-items:center;">
              <input type="checkbox" name="capability" value={capability} checked={user.grants.includes(capability)} /> {capability}
            </label>
          {/each}
          <p style="font-size:.8rem">Owner gets all available capabilities automatically. Guest gets none.</p>
        </fieldset>
        <button class="btn" type="submit">Save permissions</button>
      </form>
    </section>
  {/each}
</main>
