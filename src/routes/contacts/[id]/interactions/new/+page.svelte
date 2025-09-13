<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: Simple new note UI with voice record, summarize, and save.
  // ENHANCEMENTS: Show movement indicators while transcribing, summarizing, and saving.

  // Svelte action data from server - may include draft on error.
  export let form;

  // Form fields restored from a failed submit or default values.
  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Voice recording state.
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null; // track active mic stream so we can stop tracks
  let recording = false;
  let transcript = "";

  // UI busy flags for movement indicators.
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // Start microphone capture and record into memory.
  async function startRecording() {
    // Request mic access - browser will show a prompt.
    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(currentStream, { mimeType: "audio/webm" });

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // When recording stops we will send audio to the server for transcription.
    mediaRecorder.onstop = async () => {
      try {
        transcribing = true; // show spinner while we wait
        const blob = new Blob(chunks, { type: "audio/webm" });
        const fd = new FormData();
        // Your existing endpoint expects "file" - keep the same field name.
        fd.append("file", blob, "note.webm");

        const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await resp.json().catch(() => ({}));
        // Support either { transcript } or { text } response shapes.
        transcript = (data.transcript || data.text || "").trim();

        // Append the transcript to any typed text instead of overwriting.
        if (transcript) {
          text = text ? `${text} ${transcript}` : transcript;
        }
      } catch (err) {
        console.error("Transcribe failed", err);
      } finally {
        transcribing = false;
        // Always stop mic tracks so the browser mic indicator turns off.
        currentStream?.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }
    };

    mediaRecorder.start();
    recording = true;
  }

  // Stop recording - triggers onstop which starts transcription.
  function stopRecording() {
    if (!recording) return;
    recording = false;
    // Setting transcribing here gives immediate feedback before onstop runs.
    transcribing = true;
    mediaRecorder?.stop();
  }

  // Ask your summarize endpoint to summarize current notes and suggest tags.
  async function summarize() {
    try {
      summarizing = true;
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await resp.json().catch(() => ({}));
      summary = (data.summary || "").trim();
      // Your endpoint may return tags as an array - support that shape.
      tags = Array.isArray(data.tags) ? data.tags.join(", ") : (tags || "");
    } catch (err) {
      console.error("Summarize failed", err);
    } finally {
      summarizing = false;
    }
  }

  // When the form submits to ?/save we flip saving=true for a spinner on the button.
  function handleSubmit() {
    saving = true;
    // No preventDefault - we want the normal navigation to occur.
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1>Add note</h1>

    <!-- Hidden fields carry AI output to the server -->
    <form method="post" on:submit={handleSubmit}>
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="tagsSource" value="ai" />

      <div class="field">
        <label for="channel">Channel</label>
        <select id="channel" name="channel" bind:value={channel}>
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="message">Message</option>
        </select>
      </div>

      <div class="field">
        <label for="occurredAt">When - optional</label>
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} />
      </div>

      <div class="field">
        <label for="text">Your note</label>

        <!-- Voice controls row -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          {#if !recording}
            <button type="button" class="btn" on:click={startRecording} disabled={transcribing || saving}>
              {#if transcribing}
                <span class="spinner" aria-hidden="true"></span>
                <span>Preparing mic...</span>
              {:else}
                <span>🎤 Start Recording</span>
              {/if}
            </button>
          {:else}
            <button type="button" class="btn" on:click={stopRecording} disabled={saving}>
              ⏹ Stop
            </button>
          {/if}

          <!-- Live feedback while audio is being transcribed -->
          {#if transcribing}
            <span class="inline-wait">
              <span class="spinner" aria-hidden="true"></span>
              <span>Transcribing...</span>
            </span>
          {/if}
        </div>

        <textarea id="text" name="text" rows="8" bind:value={text}></textarea>
      </div>

      {#if transcript}
        <p class="muted">Transcript captured from voice.</p>
      {/if}

      {#if summary}
        <div class="card" style="padding:12px; margin-top:12px;">
          <h3>AI Summary</h3>
          <pre style="white-space:pre-wrap;">{summary}</pre>
          <p style="margin-top:6px;">Tags: {tags}</p>
        </div>
      {/if}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn" on:click={summarize} disabled={summarizing || recording || saving}>
          {#if summarizing}
            <span class="spinner" aria-hidden="true"></span>
            <span>Summarizing...</span>
          {:else}
            <span>✨ Summarize</span>
          {/if}
        </button>

        <button
          class="btn primary"
          formaction="?/save"
          formmethod="post"
          disabled={saving || transcribing || recording}
        >
          {#if saving}
            <span class="spinner" aria-hidden="true"></span>
            <span>Saving...</span>
          {:else}
            <span>Save note</span>
          {/if}
        </button>

        <a class="btn" href="..">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

<style>
  /* Small, theme-friendly spinner that uses your CSS vars */
  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Inline wait indicator layout */
  .inline-wait {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .muted { color: var(--muted); }
</style>
