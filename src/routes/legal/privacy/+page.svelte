<script lang="ts">
  import LegalDocument from '$lib/legal/LegalDocument.svelte';
  import privacy from '$lib/legal/documents/privacy.md?raw';
  export let data: { legalPublished: boolean; legalVersion: string };
</script>
<LegalDocument markdown={privacy} published={data.legalPublished} version={data.legalVersion} />
