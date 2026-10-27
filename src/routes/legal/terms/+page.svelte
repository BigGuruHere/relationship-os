<script lang="ts">
  import LegalDocument from '$lib/legal/LegalDocument.svelte';
  import terms from '$lib/legal/documents/terms.md?raw';
  export let data: { legalPublished: boolean; legalVersion: string };
</script>
<LegalDocument markdown={terms} published={data.legalPublished} version={data.legalVersion} />
