<svelte:head><title>Broker workspace - Relish</title></svelte:head>
<div class="workspace-page"><p class="workspace-kicker">SPECIALIST WORKSPACE</p><h1>Business broker</h1>
  <p class="workspace-intro">The existing broking functions remain available here without occupying the main Relish navigation. Their data architecture has not yet been extracted into a separate product.</p>
  <div class="workspace-tiles">
    {#each [{name:'Broker contacts',href:'/broker/contacts',desc:'Existing broker contact list'},{name:'Leads',href:'/leads',desc:'Pipeline and lead imports'},{name:'Deals',href:'/deals',desc:'Deal management'},{name:'Companies',href:'/companies',desc:'Company research and records'},{name:'Agents',href:'/agents',desc:'Broker and research agents'},{name:'Workstreams',href:'/workstreams',desc:'Broker execution workflows'},{name:'Wants and offers',href:'/wants',desc:'Demand and supply matching foundations'},{name:'Introductions',href:'/introductions',desc:'Legacy introduction workflows'}] as tool}
      <a class="workspace-panel workspace-tile" href={tool.href}><h2>{tool.name}</h2><p>{tool.desc}</p><span class="workspace-tile-action">Open →</span></a>
    {/each}
  </div>
</div>
