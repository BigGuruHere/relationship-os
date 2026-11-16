<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;
	const labels = {
		QUEUED: 'Processing', READY: 'Ready for review', NO_CHANGE: 'No changes',
		HELD: 'Held by analysis', FAILED: 'Processing failed', INCOMPLETE: 'Incomplete', REVIEWED: 'Reviewed'
	};
</script>

<svelte:head><title>Dorian reviews - Relish</title></svelte:head>
<section class="container">
	<a href="/operator">← Operator tools</a>
	<h1>Dorian conversation reviews</h1>
	<ul>
		{#each data.calls as call (call.id)}
			<li>
				{#if call.canReview}<a href={'/operator/dorian-foundation/' + call.id}>Open conversation</a>{/if}
				<time datetime={call.at}>{call.at.slice(0, 16).replace('T', ' ')} UTC</time>
				· {labels[call.state]}
			</li>
		{:else}<li>No conversations yet.</li>{/each}
	</ul>
</section>
