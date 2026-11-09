<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	export let data;
	export let form;

	let token = '';
	$: if (form && 'invalid' in form) token = '';
	onMount(() => {
		// The browser sends the fragment credential only in the password reset POST.
		token = window.location.hash.slice(1);
	});
</script>

<svelte:head>
	<title>Reset your password - Relish</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="container" style="max-width:480px;">
	<div class="card" style="padding:22px;">
		<h1>Reset your password</h1>
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		{#if form?.completed}
			<p role="status">Your password has been updated.</p>
			<a href="/auth/login">Sign in with your new password</a>
		{:else if token && !(form && 'invalid' in form)}
			<form method="POST" action="?/complete" use:enhance>
				<input type="hidden" name="token" value={token} />
				<div class="field">
					<label for="password">New password</label>
					<input id="password" name="password" type="password" autocomplete="new-password"
						minlength="8" maxlength="128" required />
				</div>
				<div class="field">
					<label for="confirmation">Confirm new password</label>
					<input id="confirmation" name="confirmation" type="password" autocomplete="new-password"
						minlength="8" maxlength="128" required />
				</div>
				<button class="btn primary">Set new password</button>
			</form>
		{:else if form?.requested}
			<p role="status">If an account uses a password for this email, you’ll receive a reset link. If you use Google, sign in with Google.</p>
		{:else if data.available}
			<form method="POST" action="?/request" use:enhance>
				<div class="field">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" autocomplete="email" maxlength="254" required />
				</div>
				<button class="btn primary">Send reset link</button>
			</form>
		{:else}
			<p>Password recovery is temporarily unavailable.</p>
		{/if}
		{#if !form?.completed}<p><a href="/auth/login">Back to sign in</a></p>{/if}
	</div>
</main>
