<script lang="ts">
	// One verification task follows the existing exchange/signup experience.
	export let data;
	export let form: any;
	import { onMount } from 'svelte';
	// The original Send authorised reciprocal completion; this POST reuses current proof, never GET mutation.
	onMount(() => {
		if (
			data.version === 2 &&
			data.accountClaim?.canComplete &&
			!data.accountClaim?.settled &&
			!form?.error
		)
			(document.getElementById('complete-exchange') as HTMLFormElement | null)?.requestSubmit();
	});
</script>

<svelte:head
	><title>Verify your account - Relish</title><meta name="robots" content="noindex" /></svelte:head
>
<main>
	<h1>Verify your account</h1>
	{#if !data.available}<p>
			This exchange has expired or is unavailable. You can share your details again.
		</p>
		<a href="/profiles">My Profiles</a>
	{:else if !data.signedIn}<p>
			Create an account or sign in to verify the contact details you shared.
		</p>
		<a href="/auth/register?next=%2Fexchange%2Fclaim">Create my Relish account</a>
		<p><a href="/auth/login?next=%2Fexchange%2Fclaim">Sign in</a></p>
	{:else if !data.ready}<p>
			Account verification is unavailable for this account. You can continue to your profile.
		</p>
		<a href="/settings/profile?onboarding=1">Continue to my profile</a>
	{:else if data.version === 2}
		{#if form?.completed || data.accountClaim?.settled}
			<p role="status">Your account details are verified.</p>
			<a href="/people">Open My People</a>
		{:else if data.accountClaim?.canComplete}
			<form id="complete-exchange" method="POST">
				<input type="hidden" name="intent" value="complete" />
				<button>Continue</button>
			</form>
		{:else if data.accountClaim}
			{@const channel = data.accountClaim.channel}
			<p>Confirm the {channel.type === 'PHONE' ? 'mobile number' : 'email address'} you shared to verify your account.</p>
			<p>{channel.masked}</p>

			{#if channel.available}
				<form method="POST">
					<input type="hidden" name="intent" value={data.codeRequested ? 'resend' : 'send'} />
					<input type="hidden" name="channelType" value={channel.type} />
					<button class:later={data.codeRequested}>
						{data.codeRequested ? 'Request a new code' : 'Send verification code'}
					</button>
				</form>
			{:else}
				<p>Email verification is currently unavailable. Please try again later.</p>
			{/if}
		{:else if !data.codeRequested}
			<p>Account verification is unavailable for this submission. You can share your details again.</p>
		{/if}
		{#if data.codeRequested && !data.accountClaim?.canComplete && !data.accountClaim?.settled && !form?.completed}
			<form method="POST">
				<input type="hidden" name="intent" value="verify" />
				<label>Verification code
					<input name="code" inputmode="numeric" autocomplete="one-time-code"
						pattern={'[0-9]{6}'} maxlength="6" required />
				</label>
				<button>Verify my account</button>
			</form>
		{/if}
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		{#if form?.reference}<p>Support reference: {form.reference}</p>{/if}
		{#if form?.sent}<p role="status">Code sent. Check your messages.</p>{/if}
	{:else}
		<p>
			We’ll send a code to the mobile number you shared to verify your account.
		</p>
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		{#if form?.reference}<p class="support-reference">Support reference: {form.reference}</p>{/if}
		{#if form?.sent}<p role="status">Code sent. Check your messages.</p>{/if}
		{#if data.codeRequested || form?.sent}
			<form method="POST">
				<input type="hidden" name="intent" value="resend" /><button class="later"
					>Request a new code</button
				>
			</form>
		{:else}
			<form method="POST">
				<input type="hidden" name="intent" value="send" /><button>Send verification code</button>
			</form>
		{/if}

		<!-- Keep the regex in a literal expression so Svelte preserves its quantifier braces. -->
		{#if data.codeRequested || form?.sent}<form method="POST">
				<input type="hidden" name="intent" value="verify" /><label for="code"
					>Verification code</label
				><input
					id="code"
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern={'[0-9]{6}'}
					maxlength="6"
					required
				/><button>Verify my account</button>
			</form>{/if}
	{/if}
	{#if data.version !== 2}
		<form method="POST">
			<input type="hidden" name="intent" value="later" /><button class="later">Continue later</button>
		</form>
	{/if}
</main>

<style>
	main {
		max-width: 500px;
		margin: auto;
		padding: 32px 20px;
	}
	p {
		line-height: 1.6;
	}
	form {
		display: grid;
		gap: 12px;
		margin: 24px 0;
	}
	input,
	button {
		font: inherit;
		padding: 14px;
		border-radius: 12px;
	}
	button {
		background: #183e39;
		color: white;
		border: 0;
		min-height: 48px;
	}
	.later {
		background: transparent;
		color: inherit;
		text-decoration: underline;
	}
</style>
