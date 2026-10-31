<!-- Relish legal overview: publication and version are supplied by the page server. -->
<script lang="ts">
  // The server controls whether legal documents are published and which version applies.
  export let data: {
    legalPublished: boolean;
    legalVersion: string;
  };
</script>

<svelte:head>
  <title>Terms &amp; Privacy | Relish</title>
  <meta
    name="description"
    content="Learn about Dorian Kreed, Relish, our Terms of Use and how your personal information is handled."
  />
  <meta name="robots" content={data.legalPublished ? 'index,follow' : 'noindex,nofollow'} />
</svelte:head>

<main class="legal-overview">
  <a class="brand" href="/">Relish</a>

  <h1>Before you meet Dorian</h1>

  <p class="intro">
    Here's how Dorian and Relish work, what the service means for you,
    and what happens to the information you share.
  </p>

  {#if !data.legalPublished}
    <div class="draft" role="status">
      These are draft policy documents for review, not final published
      terms. Telephone onboarding will remain unavailable until
      publication is explicitly enabled.
    </div>
  {/if}

  <section aria-labelledby="terms-title">
    <h2 id="terms-title">Terms &amp; Conditions</h2>
    <p>
      Dorian Kreed is an AI designed to help people build meaningful
      relationships with other people. He can get to know you, explore
      what matters to you, and help you discover ideas, opportunities
      and potential connections.
    </p>
    <p>
      Dorian uses Relish, a relationship management platform operated
      by Value Group Pty Ltd, to support these services.
    </p>
    <p>
      Dorian may make mistakes, and you remain in control of your
      decisions and relationships. Optional relationship matching
      features may become available in the future.
    </p>
    <a href="/legal/terms">Read the full Terms &amp; Conditions →</a>
  </section>

  <section aria-labelledby="privacy-title">
    <h2 id="privacy-title">Privacy &amp; your information</h2>
    <p>
      Dorian uses Relish to remember your conversations and develop
      an understanding of your interests, circumstances and
      relationships. Conversations are transcribed, but audio
      recordings are not routinely retained.
    </p>
    <p>
      Your information is used to provide and improve the service,
      with appropriate privacy safeguards. The person who introduced
      you does not automatically gain access to your telephone number,
      conversations or private information.
    </p>
    <p>
      You can request access to, correction of or deletion of your
      personal information by contacting
      <a href="mailto:admin@doriankreed.com">admin@doriankreed.com</a>,
      subject to applicable legal requirements.
    </p>
    <a href="/legal/privacy">Read the full Privacy Policy →</a>
  </section>

  <section class="consent" aria-labelledby="consent-title">
    <h2 id="consent-title">When Dorian calls</h2>
    <p>
      Dorian will identify himself as AI, explain how your information
      is handled and ask whether you agree to the Terms before beginning
      a substantive conversation. Viewing this page or requesting a
      call does not itself constitute acceptance of the Terms or
      permission to share your private information.
    </p>
  </section>

  <p class="version">Policy version: {data.legalVersion || 'Not configured'}</p>
</main>

<style>
  /* Main page layout */
  .legal-overview { max-width: 680px; margin: 0 auto; padding: 34px 18px 70px; color: #173d39; line-height: 1.65; }
  /* Relish brand link */
  .brand { font-weight: 800; font-size: 1.1rem; color: #12665c; text-decoration: none; }
  /* Page heading and introduction */
  h1 { font-size: clamp(1.75rem, 5vw, 2.55rem); margin: 1.1rem 0 .45rem; }
  .intro { color: #546862; margin-bottom: 22px; }
  /* Legal information sections */
  section { padding: 20px; border-radius: 14px; border: 1px solid #d7e1dc; margin: 14px 0; background: white; }
  section h2 { font-size: 1.22rem; margin: 0 0 10px; }
  section p { margin: 0 0 12px; }
  section a { font-weight: 700; color: #12665c; }
  /* Consent explanation */
  .consent { background: #f5faf8; }
  .consent p { margin: 0; }
  /* Unpublished document warning */
  .draft { border: 1px solid #b45309; background: #fff7ed; color: #78350f; border-radius: 8px; padding: 12px; }
  /* Current policy version */
  .version { font-size: .82rem; color: #667a74; margin-top: 22px; }
</style>
