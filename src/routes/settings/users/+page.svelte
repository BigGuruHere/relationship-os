<script lang="ts">
  // PURPOSE: Owner-facing form for account role and capability grants.
  import { enhance } from '$app/forms';
  export let data: { users: { id: string; email: string; role: string; grants: string[]; createdAt: string }[] };
  export let form: { error?: string; success?: string } | null;
</script>

<svelte:head><title>Account permissions - Relish</title></svelte:head>
<main style="max-width:850px; margin:0 auto; padding:24px;">
  <h1>Account permissions</h1>
  <p>Only system owners can change user roles and capability grants. ContextSpace custody is separate.</p>
  {#if form?.error}<p role="alert" style="color:#b3261e">{form.error}</p>{/if}
  {#if form?.success}<p role="status">{form.success}</p>{/if}
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
          {#each ['OPERATOR','ADMIN','BROKER'] as capability}
            <label style="display:inline-flex;gap:6px;margin:8px 16px 8px 0;align-items:center;">
              <input type="checkbox" name="capability" value={capability} checked={user.grants.includes(capability)} /> {capability}
            </label>
          {/each}
          <p style="font-size:.8rem">Owner gets all capabilities automatically. Guest gets none.</p>
        </fieldset>
        <button class="btn" type="submit">Save permissions</button>
      </form>
    </section>
  {/each}
</main>
