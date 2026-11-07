<script lang="ts">
	// One verification task follows the existing exchange/signup experience.
	export let data;
	export let form;
</script>

<svelte:head
	><title>Finish your exchange - Relish</title><meta name="robots" content="noindex" /></svelte:head
>
<main>
	<h1>Keep your new contact in My People</h1>
	{#if !data.available}<p>
			This exchange has expired or is unavailable. You can share your details again.
		</p>
		<a href="/profiles">My Profiles</a>
	{:else if !data.signedIn}<p>
			Sign in or create your profile, then verify the phone number you shared.
		</p>
		<a href="/auth/register?next=%2Fexchange%2Fclaim">Create my profile</a>
		<p><a href="/auth/login?next=%2Fexchange%2Fclaim">Sign in</a></p>
	{:else if !data.ready}<p>
			Your details have been saved. Account linking is currently available to the controlled DEV
			test group. You can continue with your profile.
		</p>
		<a href="/settings/profile?onboarding=1">Continue to my profile</a>
	{:else}
		<p>
			We’ll send a code to the mobile number you shared. Verification saves the exchanged details
			privately in each person’s My People.
		</p>
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
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

		{#if data.codeRequested || form?.sent}<form method="POST">
				<input type="hidden" name="intent" value="verify" /><label for="code"
					>Verification code</label
				><input
					id="code"
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern="[0-9]{6}"
					maxlength="6"
					required
				/><button>Verify and save contact</button>
			</form>{/if}
	{/if}
	<form method="POST">
		<input type="hidden" name="intent" value="later" /><button class="later">Continue later</button>
	</form>
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
