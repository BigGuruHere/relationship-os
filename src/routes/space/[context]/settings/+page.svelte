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
  <section class="workspace-panel"><h2>Account</h2>
    <p>Manage your sign-in separately from the information you share in this context.</p>
    <form method="POST" action="/auth/logout"><button class="btn" type="submit">Sign out</button></form>
  </section>
</div>
