<script lang="ts">
	export let data;
	export let form: any;
</script>

<svelte:head
	><title>Phone and email - Relish</title><meta name="robots" content="noindex" /></svelte:head
>
<main class="channels">
	<a href="/profiles">Back to My Profiles</a>
	<h1>Phone and email</h1>
	<p>
		Verify each personal phone number and email separately. Adding one does not verify it or change
		your sign-in details.
	</p>
	{#if !data.available}<p>
			Channel settings are currently available to the admitted DEV test accounts only.
		</p>
	{:else}
		{#if form?.message}<p role="status">{form.message}</p>{/if}
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		{#if form?.reference}<p>Support reference: {form.reference}</p>{/if}
		<form method="POST">
			<input type="hidden" name="intent" value="add" />
			<label
				>Channel <select name="type"
					><option value="PHONE">Australian mobile</option><option value="EMAIL">Email</option
					></select
				></label
			>
			<label>Number or email <input name="value" maxlength="254" required /></label><button
				>Add channel</button
			>
		</form>
		{#each data.channels as channel}
			<section>
				<h2>{channel.type === 'PHONE' ? 'Phone' : 'Email'}: {channel.masked}</h2>
				<p>
					{channel.status === 'VERIFIED'
						? 'Verified'
						: channel.status === 'REVOKED'
							? 'Revoked'
							: 'Verification pending'}
				</p>
				{#if channel.verifiedAt}<p>
						Verified {new Date(channel.verifiedAt).toLocaleString()} by {channel.method ===
						'SMS_CODE'
							? 'SMS code'
							: channel.method}.
					</p>{/if}
				{#if channel.status !== 'VERIFIED' && (channel.type === 'PHONE' || data.emailEnabled)}
					<form method="POST">
						<input type="hidden" name="intent" value="send" /><input
							type="hidden"
							name="channelId"
							value={channel.id}
						/><button
							>{channel.status === 'REVOKED' ? 'Verify again' : 'Send verification code'}</button
						>
					</form>
				{/if}
				{#if channel.type === 'EMAIL' && !data.emailEnabled && channel.status !== 'VERIFIED'}<p>
						Email verification awaits sender setup.
					</p>{/if}
				{#if form?.channelId === channel.id && form?.challengeId}
					<form method="POST">
						<input type="hidden" name="intent" value="verify" /><input
							type="hidden"
							name="challengeId"
							value={form.challengeId}
						/><input type="hidden" name="channelId" value={channel.id} />
						<label
							>Verification code <input
								name="code"
								inputmode="numeric"
								autocomplete="one-time-code"
								pattern={'[0-9]{6}'}
								minlength="6"
								maxlength="6"
								required
							/></label
						><button>Verify channel</button>
					</form>
					<form method="POST">
						<input type="hidden" name="intent" value="retry" /><input
							type="hidden"
							name="challengeId"
							value={form.challengeId}
						/><input type="hidden" name="channelId" value={channel.id} /><button
							>Retry delivery</button
						>
					</form>
				{/if}
				<form method="POST">
					<input type="hidden" name="channelId" value={channel.id} /><input
						type="hidden"
						name="intent"
						value={channel.status === 'REVOKED' ? 'erase' : 'revoke'}
					/><button
						>{channel.status === 'REVOKED'
							? 'Remove channel and history'
							: 'Revoke verification'}</button
					>
				</form>
			</section>
		{/each}
	{/if}
	<a href="/profiles">Continue later</a>
</main>

<style>
	.channels {
		max-width: 560px;
		margin: auto;
		padding: 24px;
	}
	form {
		display: grid;
		gap: 12px;
		margin: 16px 0;
	}
	label {
		display: grid;
		gap: 6px;
	}
	input,
	select,
	button {
		font: inherit;
		padding: 12px;
		min-height: 44px;
		border: 1px solid #bbc9c4;
		border-radius: 8px;
		max-width: 100%;
		box-sizing: border-box;
	}
	button {
		background: #183e39;
		color: white;
		cursor: pointer;
	}
	section {
		border-top: 1px solid #ccd8d2;
		padding: 16px 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	p {
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
</style>
