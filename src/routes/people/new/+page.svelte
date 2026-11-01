<script lang="ts">export let form: any;</script>
<svelte:head><title>Add Person - Relish</title></svelte:head>
<div class="container people-form"><a href="/people">← My People</a><h1>Add Person</h1><p>Only you can access this contact here. No account or connection is created.</p>
<form method="POST">
<label for="name">Name</label><input id="name" name="name" required maxlength="200" autocomplete="name" value={form?.values?.name || ''}/>
<label for="email">Email (optional)</label><input id="email" name="email" type="email" maxlength="254" autocomplete="email" value={form?.values?.email || ''}/>
<label for="phone">Phone (optional)</label><input id="phone" name="phone" type="tel" maxlength="40" autocomplete="tel" value={form?.values?.phone || ''}/>
{#if form?.error}<p role="alert">{form.error}</p>{/if}<button class="btn primary">Save person</button></form></div>
<style>.people-form{max-width:640px;padding:20px}form{display:grid;gap:10px}input{padding:12px;width:100%}button{margin-top:16px;min-height:48px}</style>
