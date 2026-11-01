<script lang="ts">
  import ContactNoteForm from '$lib/recording/ContactNoteForm.svelte';
  export let data;
  export let form;
</script>
<svelte:head><title>Add note - My People</title></svelte:head>
<ContactNoteForm {data} {form} privateMode={true} contactBase="/people" audioBase="/people/api"/>
