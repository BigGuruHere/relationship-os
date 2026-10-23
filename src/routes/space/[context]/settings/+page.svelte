<script lang="ts">
  export let data: any;
  export let form: any;
</script>
<svelte:head><title>Settings - {data.workspace.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">{data.workspace.label.toUpperCase()} / SETTINGS</p><h1>Settings</h1>
  <p class="workspace-intro">These preferences apply only to your {data.workspace.label.toLowerCase()} context.</p>
  <section class="workspace-panel">
    <h2>Public profile</h2>
    <p>{data.profile?.isPublished ? 'Published - visitors with the link can open this profile.' : 'Not published - visitors cannot open this profile.'}</p>
    <a class="btn primary" href={'/space/' + data.workspace.name + '/profile'}>Manage my profile</a>
  </section>
  <section class="workspace-panel">
    <h2>Connections and Dorian</h2>
    <form method="post" action="?/save" style="display:grid;gap:16px;max-width:460px">
      <label>When somebody explicitly shares their details to connect
        <select name="connectionMode" value={data.connectionMode}>
          <option value="AUTOMATIC" selected={data.connectionMode === 'AUTOMATIC'}>Accept automatically</option>
          <option value="APPROVAL" selected={data.connectionMode === 'APPROVAL'}>Require my approval</option>
        </select>
      </label>
      <label>How visitors talk with Dorian
        <select name="dorianMode" value={data.dorianMode}>
          <option value="SMS_CALLBACK" selected={data.dorianMode === 'SMS_CALLBACK'}>Send SMS, Dorian calls back (default)</option>
          <option value="BROWSER" selected={data.dorianMode === 'BROWSER'}>Browser voice widget</option>
        </select>
      </label>
      <p style="font-size:13px">Automatic acceptance applies only after someone explicitly offers contact details. It never shares their private conversation or Living Understanding.</p>
      <button class="btn primary" type="submit">Save settings</button>
      {#if form?.saved}<p role="status">Settings saved.</p>{/if}
      {#if form?.error}<p role="alert">{form.error}</p>{/if}
    </form>
  </section>
  <section class="workspace-panel">
    <h2>My default context</h2>
    <p>Dorian can use your default as a starting point when a conversation has no new QR invitation.
      It does not share private understanding with other contexts or people.</p>
    {#if data.isPrimaryContext}
      <p role="status">This is your default context.</p>
    {:else if data.workspace.configured}
      <form method="POST" action="?/setDefault">
        <button class="btn" type="submit">Make {data.workspace.label} my default</button>
      </form>
    {:else}
      <p>Set up this context before selecting it as your default.</p>
    {/if}
    {#if form?.defaultSaved}<p role="status">Default context updated.</p>{/if}
    <p style="font-size:13px">Telephone-only provisional identities use their own private default.
      A verified account-linking flow is required before those identities can be combined.</p>
  </section>
  <section class="workspace-panel"><h2>Account</h2>
    <p>Manage your sign-in separately from the information you share in this context.</p>
    <form method="POST" action="/auth/logout"><button class="btn" type="submit">Sign out</button></form>
  </section>
</div>
