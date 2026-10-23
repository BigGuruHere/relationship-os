<script lang="ts">
  // Stage 8.17 - One Relish shell and five consistent context-specific destinations.
  // SECURITY: Links are presentation only. Each workspace route verifies participant custody.
  import '../app.css';
  import { onMount } from 'svelte';
  export let data: any;

  const nav = [
    { slug: '', label: 'Home', icon: '⌂' },
    { slug: '/people', label: 'People', icon: '♧' },
    { slug: '/profile', label: 'Profile', icon: '◉' },
    { slug: '/share', label: 'Share', icon: '▦' },
    { slug: '/settings', label: 'Settings', icon: '⚙' }
  ];

  $: path = data.routePathname || '/';
  $: isPublic = path.startsWith('/u/') || path.startsWith('/pilot/dorian/') || path.startsWith('/network/join/');
  $: isBroker = ['/broker', '/leads', '/deals', '/companies', '/agents', '/workstreams', '/contacts', '/wants', '/offers', '/introductions', '/projects', '/tasks', '/actions', '/search'].some(prefix => path === prefix || path.startsWith(prefix + '/'));
  $: isOperator = path === '/operator' || path.startsWith('/operator/') || path === '/general' || path.startsWith('/general/');
  $: hint = (path === '/settings/profile' && data.profileKindHint === 'personal') ? 'friendship' : path === '/settings/profile' && ['business', 'dating'].includes(data.profileKindHint) ? data.profileKindHint : null;
  $: requested = path.startsWith('/space/friendship') || path.startsWith('/network') ? 'friendship' : path.startsWith('/space/dating') || path.startsWith('/dating') ? 'dating' : path.startsWith('/space/business') ? 'business' : hint;
  $: spaces = data.visibleSpaces || [];
  $: activeName = spaces.some((s: any) => s.name === requested) ? requested : spaces[0]?.name || 'business';
  $: activeSpace = spaces.find((s: any) => s.name === activeName) || { name: 'business', label: 'Business', color: '#3276b8' };
  $: activeBase = '/space/' + activeName;
  $: specialist = isBroker && data.capabilities?.includes('BROKER') ? 'broker' : isOperator && data.capabilities?.includes('OPERATOR') ? 'operator' : '';
  $: selectedName = activeName;

  function changeSpace(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    // IT: Client-side navigation is only for options the server exposed to this account.
    if (spaces.some((space: any) => space.name === value)) window.location.assign('/space/' + value);
  }

  onMount(() => {
    // IT: Register the existing PWA only in the browser; no network work during SSR.
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
</script>

<svelte:head><meta name="theme-color" content={activeSpace.color}/></svelte:head>
<div class:relish-visitor={isPublic} class="relish-shell" style={'--workspace-accent:' + activeSpace.color}>
  {#if !isPublic}
    <header class="relish-header">
      <a class="relish-brand" href={data.user ? activeBase : '/auth/login'} aria-label="Relish home">
        <img src="/relish-logo.png" alt="" width="36" height="36" />
        <strong>Relish</strong>
      </a>
      {#if data.user}
        <div class="relish-context-picker">
          {#if spaces.length > 1}
            <label for="context-select">Context</label>
            <select id="context-select" value={activeName} on:change={changeSpace}>
              {#each spaces as space}
                <option value={space.name}>{space.label}</option>
              {/each}
            </select>
          {:else}
            <span class="relish-context-only">{activeSpace.label}</span>
          {/if}
        </div>
        <a class="relish-header-tools" href={activeBase + '/share'}>Share</a>
        <details class="relish-more">
          <summary aria-label="More account options">•••</summary>
          <div class="relish-more-menu">
            <a href={activeBase}>Relish home</a>
            {#if data.capabilities?.includes('BROKER')}<a href="/broker">Business broker</a>{/if}
            {#if data.capabilities?.includes('OPERATOR')}<a href="/operator">Operator tools</a>{/if}
            {#if data.accountRole === 'owner'}<a href="/settings/users">Manage users</a>{/if}
            <form method="POST" action="/auth/logout"><button type="submit">Sign out</button></form>
          </div>
        </details>
      {:else}
        <a class="relish-header-tools" href="/auth/login">Sign in</a>
      {/if}
    </header>

    {#if data.user}
      <aside class="relish-sidebar" aria-label="Application navigation">
        <div class="relish-sidebar-title">{specialist === 'broker' ? 'Business broker' : specialist === 'operator' ? 'Operator tools' : activeSpace.label}</div>
        {#if specialist}
          <a class="relish-nav-item" href={activeBase}>← Back to Relish</a>
          {#if specialist === 'broker'}<a class:current={path === '/broker'} class="relish-nav-item" href="/broker">Broker workspace</a>{/if}
          {#if specialist === 'operator'}<a class:current={path === '/operator'} class="relish-nav-item" href="/operator">Operator tools</a>{/if}
        {:else}
          {#each nav as item}
            <a class:current={path === activeBase + item.slug} class="relish-nav-item" href={activeBase + item.slug}>
              <span class="relish-nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </a>
          {/each}
        {/if}
        <div class="relish-sidebar-bottom">
          {#if data.capabilities?.includes('BROKER')}
            <a class="relish-special-link" href="/broker">Business broker <span>↗</span></a>
          {/if}
          {#if data.capabilities?.includes('OPERATOR')}
            <a class="relish-special-link" href="/operator">Operator tools <span>↗</span></a>
          {/if}
          {#if data.accountRole === 'owner'}
            <a class="relish-special-link" href="/settings/users">Manage users <span>↗</span></a>
          {/if}
          <form method="POST" action="/auth/logout"><button class="relish-sign-out" type="submit">Sign out</button></form>
          {#if data.user.emailRedacted}<small>{data.user.emailRedacted}</small>{/if}
        </div>
      </aside>
    {/if}
  {/if}

  <main class="relish-content"><slot /></main>

  {#if !isPublic && data.user && !specialist}
    <nav class="relish-bottom-nav" aria-label={activeSpace.label + ' navigation'}>
      {#each nav as item}
        <a class:current={path === activeBase + item.slug} href={activeBase + item.slug}>
          <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
        </a>
      {/each}
    </nav>
  {/if}
</div>
