<script lang="ts">
	import ConversationLuReview from '../../../people/[id]/notes/[noteId]/review/ConversationLuReview.svelte';
	import type { PageData, ActionData } from './$types';
	export let data: PageData;
	export let form: ActionData;
</script>

<svelte:head><title>Dorian conversation review - Relish</title></svelte:head>
<ConversationLuReview {data} {form} operator />
{#if data.canRetry}
	<form class="container" style="max-width: 48rem" method="POST" action="?/retry">
		<button class="btn" type="submit">Queue analysis again</button>
	</form>
{/if}
