<script lang="ts">
  export let form;

  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Voice recording state
  let mediaRecorder: MediaRecorder | null = null;
  let recording = false;
  let currentStream: MediaStream | null = null; 
  let usedAI = false; // comment: controls tagsSource - user unless summarize ran
  let transcript = "";

// replace your startRecording with this version
async function startRecording() {
  // comment: request mic and create a recorder that buffers chunks
  currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(currentStream, { mimeType: 'audio/webm' });
  const chunks: BlobPart[] = [];

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.onstop = async () => {
    // comment: build a blob and send it to your existing transcribe endpoint
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('file', blob, 'note.webm');

    try {
      const resp = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const data = await resp.json().catch(() => ({}));
      // comment: support either { transcript } or { text } shapes
      transcript = (data.transcript || data.text || '').trim();
      // comment: append transcript so you do not lose any typed text
      if (transcript) {
        text = text ? `${text} ${transcript}` : transcript;
      }
    } catch (err) {
      console.error('Transcribe failed', err);
    } finally {
      // comment: always stop mic tracks so the browser mic indicator turns off
      currentStream?.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }
  };

  mediaRecorder.start();
  recording = true;
}


// replace your stopRecording with this version
function stopRecording() {
  // comment: stop triggers the onstop handler above
  mediaRecorder?.stop();
  recording = false;
}


// replace your summarize() with this version
async function summarize() {
  try {
    const resp = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await resp.json().catch(() => ({}));
    // comment: keep both fields optional - endpoint may or may not return tags
    summary = (data.summary || '').trim();
    tags = Array.isArray(data.tags) ? data.tags.join(', ') : (tags || '');
    usedAI = !!summary || !!tags; // comment: flip to AI only if something was produced
  } catch (err) {
    console.error('Summarize failed', err);
  }
}

</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1>Add note</h1>

    <form method="post">
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="tagsSource" value="ai" />

      <div class="field">
        <label for="channel">Channel</label>
        <select id="channel" name="channel" bind:value={channel}>
          <option value="note">Note</option>
          <option value="Note">Note</option>
          <option value="Call">Call</option>
          <option value="Meeting">Meeting</option>
          <option value="Message">Message</option>
          
        </select>
      </div>

      <div class="field">
        <label for="occurredAt">When (optional)</label>
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} />
      </div>

      <div class="field">
        <label for="text">Your note</label>
        <textarea id="text" name="text" rows="8" bind:value={text}></textarea>
      </div>

      {#if transcript}
        <p style="color:var(--muted);">Transcript captured from voice.</p>
      {/if}

      {#if summary}
        <div class="card" style="padding:12px; margin-top:12px;">
          <h3>AI Summary</h3>
          <pre style="white-space:pre-wrap;">{summary}</pre>
          <p style="margin-top:6px;">Tags: {tags}</p>
        </div>
      {/if}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        {#if !recording}
          <button type="button" class="btn" on:click={startRecording}>🎤 Start Recording</button>
        {:else}
          <button type="button" class="btn" on:click={stopRecording}>⏹ Stop</button>
        {/if}

        <button type="button" class="btn" on:click={summarize}>✨ Summarize</button>

        <button class="btn primary" formaction="?/save" formmethod="post">Save note</button>
        <a class="btn" href="..">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>
