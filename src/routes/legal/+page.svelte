<script lang="ts">
  export let data: { legalPublished: boolean; legalVersion: string };
</script>
<svelte:head>
  <title>Terms &amp; Privacy | Relish</title>
  <meta name="description" content="A clear overview of Relish's Terms of Use and Privacy Notice, with links to the full documents." />
  <meta name="robots" content={data.legalPublished ? 'index,follow' : 'noindex,nofollow'} />
</svelte:head>
<main class="legal-overview">
  <a class="brand" href="/">Relish</a>
  <h1>Before you meet Dorian</h1>
  <p class="intro">Here's how Relish works, what the service means for you, and what happens to the information you share.</p>
  {#if !data.legalPublished}
    <div class="draft" role="status">These are draft policy documents for review, not final published terms. Telephone onboarding will remain unavailable until publication is explicitly enabled.</div>
  {/if}
  <section aria-labelledby="terms-title">
    <h2 id="terms-title">Terms &amp; Conditions</h2>
    <p>Dorian is an AI networking partner. He can get to know you, explore what matters to you, and help you think about ideas, opportunities and human relationships. Relish is evolving, and Dorian may make mistakes. You remain in control of decisions and whether you participate.</p>
    <a href="/legal/terms">Read the full Terms &amp; Conditions →</a>
  </section>
  <section aria-labelledby="privacy-title">
    <h2 id="privacy-title">Privacy &amp; your information</h2>
    <p>Relish uses your number to arrange the call. Subject to agreement and applicable provider processing, conversations may be recorded, transcribed and used to create your private Living Understanding. The person who introduced you does not automatically gain access to your telephone number, conversations or private understanding.</p>
    <a href="/legal/privacy">Read the full Privacy Notice →</a>
  </section>
  <section class="consent" aria-labelledby="consent-title">
    <h2 id="consent-title">When Dorian calls</h2>
    <p>Dorian will identify himself as AI, explain the applicable processing and ask whether you agree before beginning a substantive conversation. Viewing this page or sending an SMS is not itself acceptance.</p>
  </section>
  <p class="version">Policy version: {data.legalVersion || 'Not configured'}</p>
</main>
<style>
  .legal-overview { max-width: 680px; margin: 0 auto; padding: 34px 18px 70px; color: #173d39; line-height: 1.65; }
  .brand { font-weight: 800; font-size: 1.1rem; color: #12665c; text-decoration: none; }
  h1 { font-size: clamp(1.75rem,5vw,2.55rem); margin: 1.1rem 0 .45rem; }
  .intro { color: #546862; margin-bottom: 22px; }
  section { padding: 20px; border-radius: 14px; border: 1px solid #d7e1dc; margin: 14px 0; background: white; }
  section h2 { font-size: 1.22rem; margin: 0 0 10px; }
  section p { margin: 0 0 12px; }
  section a { font-weight: 700; color: #12665c; }
  .consent { background: #f5faf8; }
  .consent p { margin: 0; }
  .draft { border: 1px solid #b45309; background: #fff7ed; color: #78350f; border-radius: 8px; padding: 12px; }
  .version { font-size: .82rem; color: #667a74; margin-top: 22px; }
</style>
