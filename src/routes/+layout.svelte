<script lang="ts">
  // Shared navigation uses account-wide destinations. Context belongs inside the relevant workflow.
  // SECURITY: Links are presentation only. Each workspace route verifies participant custody.
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import InstallRelish from '$lib/components/InstallRelish.svelte';
  export let data: any;

  const nav = [
    { href: '/', label: 'Home', icon: '⌂' },
    { href: '/people', label: 'People', icon: '♧' },
    { href: '/profiles', label: 'Profile', icon: '◉' },
    { href: '/share', label: 'Share', icon: '▦' }
  ];

  $: path = data.routePathname || '/';
  $: isPeople = path === '/people' || path.startsWith('/people/');
  $: isPublic = path.startsWith('/u/') || path.startsWith('/pilot/dorian/') || path.startsWith('/network/join/') || path === '/legal' || path.startsWith('/legal/');
  $: exchangeFollowup = Boolean(data.user) && /^\/people\/[^/]+\/?$/.test(path) &&
    ['1', 'received'].includes($page.url.searchParams.get('afterExchange') || '');
  $: isBroker = ['/broker', '/leads', '/deals', '/companies', '/agents', '/workstreams', '/contacts', '/wants', '/offers', '/introductions', '/projects', '/tasks', '/actions', '/search'].some(prefix => path === prefix || path.startsWith(prefix + '/'));
  $: isOperator = path === '/operator' || path.startsWith('/operator/') || path === '/general' || path.startsWith('/general/');
  $: specialist = isBroker && data.capabilities?.includes('BROKER') ? 'broker' : isOperator && data.capabilities?.includes('OPERATOR') ? 'operator' : '';
  // IT: Keep the mobile account dropdown controlled, so it closes immediately
  // after choosing a destination and after client-side navigation.
  let moreMenuOpen = false;
  function closeMoreMenu() { moreMenuOpen = false; }
  afterNavigate(closeMoreMenu);


  onMount(() => {
    // IT: Register the existing PWA only in the browser; no network work during SSR.
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
</script>

<svelte:head><meta name="theme-color" content="#16877c"/></svelte:head>
<div class:relish-visitor={isPublic || exchangeFollowup} class="relish-shell">
  {#if !isPublic && !exchangeFollowup}
    <header class="relish-header">
      <a class="relish-brand" href={data.user ? '/' : '/auth/login'} aria-label="Relish home">
        <img src="/relish-logo.png" alt="" width="36" height="36" />
        <strong>Relish</strong>
      </a>
      {#if data.user}
        {#if isPeople}<a class="relish-header-tools" href="/people/new">Add Person</a>{:else}<a class="relish-header-tools" href="/share">Share</a>{/if}
        <details class="relish-more" bind:open={moreMenuOpen}>
          <summary aria-label="More account options">•••</summary>
          <div class="relish-more-menu">
            <a href="/people" on:click={closeMoreMenu}>My People</a>
            <a href="/" on:click={closeMoreMenu}>Relish home</a>
            <a href="/legal/privacy" on:click={closeMoreMenu}>Privacy and support</a>
            {#if data.capabilities?.includes('BROKER')}<a href="/broker" on:click={closeMoreMenu}>Business broker</a>{/if}
            {#if data.capabilities?.includes('OPERATOR')}<a href="/operator" on:click={closeMoreMenu}>Operator tools</a>{/if}
            {#if data.accountRole === 'owner'}<a href="/event-signups" on:click={closeMoreMenu}>Event testers</a>{/if}
            {#if data.accountRole === 'owner'}<a href="/settings/users" on:click={closeMoreMenu}>Manage users</a>{/if}
            <form method="POST" action="/auth/logout" on:submit={closeMoreMenu}><button type="submit">Sign out</button></form>
          </div>
        </details>
      {:else}
        <a class="relish-header-tools" href="/auth/login">Sign in</a>
      {/if}
    </header>

    {#if data.user}
      <aside class="relish-sidebar" aria-label="Application navigation">
        {#if specialist}<a class="relish-nav-item" href="/people">My People</a>{/if}
        <div class="relish-sidebar-title">{isPeople ? 'My People' : specialist === 'broker' ? 'Business broker' : specialist === 'operator' ? 'Operator tools' : 'Relish'}</div>
        {#if specialist}
          <a class="relish-nav-item" href="/">← Back to Relish</a>
          {#if specialist === 'broker'}<a class:current={path === '/broker'} class="relish-nav-item" href="/broker">Broker workspace</a>{/if}
          {#if specialist === 'operator'}<a class:current={path === '/operator'} class="relish-nav-item" href="/operator">Operator tools</a>{/if}
        {:else}
          {#each nav as item}
            <a class:current={path === item.href} class="relish-nav-item" href={item.href}>
              <span class="relish-nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </a>
          {/each}
          {#if isPeople}<a class="relish-nav-item" href="/people/new">Add Person</a>{/if}
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

  <main class="relish-content">
    <InstallRelish enabled={Boolean(data.user) && /^\/people\/[^/]+\/notes\/new\/?$/.test(path) && $page.url.searchParams.get('afterExchange') === '1'} />
    <slot />
  </main>

  {#if !isPublic && !exchangeFollowup && data.user && !specialist}
    <nav class="relish-bottom-nav" aria-label="Relish navigation">
      {#each nav as item}
        <a class:current={path === item.href} href={item.href}>
          <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
        </a>
      {/each}
    </nav>
  {/if}
</div>
