<script lang="ts">
	import type { ActionData, PageData } from './$types';
	export let data: PageData;
	export let form: ActionData;

	$: continuation = data.next ? '&next=' + encodeURIComponent(data.next) : '';
	$: codeRequested = data.codeRequested || Boolean(form && 'codeRequested' in form && form.codeRequested);
</script>

<svelte:head><title>Activate app access - Relish</title></svelte:head>

<div class="container activation">
	<div class="card activation-card">
		<h1>Activate app access</h1>
		<p>Use the Australian mobile number you called Dorian from to keep your conversations and Living Understanding.</p>
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		{#if codeRequested}
			<p role="status">If that number has a phone-first account, we’ve requested a verification text.</p>
			<form method="POST" action={'?/activate' + continuation}>
				<div class="field">
					<label for="code">Verification code</label>
					<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{6}" maxlength="6" />
				</div>
				<div class="field">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" autocomplete="email" required maxlength="254" />
				</div>
				<div class="field">
					<label for="password">Password</label>
					<input id="password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" />
				</div>
				<button class="btn primary" type="submit">Verify and create sign-in</button>
			</form>
			<details><summary>Request another code</summary>
				<form method="POST" action={'?/send' + continuation}>
					<div class="field">
						<label for="retry-mobile">Mobile number</label>
						<input id="retry-mobile" name="mobile" type="tel" autocomplete="tel" required maxlength="40" />
					</div>
					<button class="btn" type="submit">Send code</button>
				</form>
			</details>
		{:else}
			<form method="POST" action={'?/send' + continuation}>
				<div class="field">
					<label for="mobile">Mobile number</label>
					<input id="mobile" name="mobile" type="tel" autocomplete="tel" required maxlength="40" />
				</div>
				<button class="btn primary" type="submit">Send verification code</button>
			</form>
		{/if}
		<p><a href={data.next ? '/auth/register?next=' + encodeURIComponent(data.next) : '/auth/register'}>Back to signup</a></p>
	</div>
</div>

<style>
	.activation { max-width: 480px; }
	.activation-card { padding: 22px; }
	.activation-card h1 { margin-top: 0; }
	form button { width: 100%; }
	details { margin-top: 1rem; }
	summary { cursor: pointer; }
</style>
