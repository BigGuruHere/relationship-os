<script lang="ts">
	// PURPOSE: Render encrypted proposal evidence only after the server authorizes the Dating review route.
	export let items: string[] = [];
</script>

{#if items?.length}
	<details class="evidence">
		<summary>Source evidence</summary>
		<ul>
			{#each items as item}<li>{item}</li>{/each}
		</ul>
	</details>
{/if}

<style>
	.evidence {
		color: var(--muted);
		font-size: 0.9rem;
		margin-top: 6px;
	}
</style>
