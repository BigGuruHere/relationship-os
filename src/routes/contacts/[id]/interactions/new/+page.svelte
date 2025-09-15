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

  // Pick a recorder mime that works cross browser.
  // Chrome supports audio/webm;codecs=opus. Safari iOS often records audio/mp4.
  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus";
    const fallback = "audio/mp4";
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) {
      return preferred;
    }
    return fallback;
  }

  // Map a mime type to a sensible file extension so Whisper sees a correct filename.
  function extFromMime(mime: string): string {
    if (!mime) return "webm";
    const m = mime.toLowerCase();
    if (m.includes("webm")) return "webm";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("m4a")) return "m4a";
    if (m.includes("wav")) return "wav";
    if (m.includes("ogg")) return "ogg";
    if (m.includes("mpeg")) return "mp3";
    return "webm";
  }

  // Start microphone capture and record into memory.
  async function startRecording() {
    // Request mic access with quality-reducing constraints to shrink file size.
    // Note: some browsers treat these as hints. Even when partially ignored, mono often sticks.
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 1,        // mono - halves data vs stereo
        sampleRate: 16000,      // 16 kHz - ideal for speech and Whisper
        sampleSize: 16,         // 16-bit samples
        echoCancellation: true, // optional clarity improvements
        noiseSuppression: true, // optional clarity improvements
        autoGainControl: true   // optional clarity improvements
      },
      video: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Choose a compatible mime for the recorder.
    const mimeType = pickRecorderMime();
    mediaRecorder = new MediaRecorder(currentStream, { mimeType });

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // When recording stops we will send audio to the server for transcription.
    mediaRecorder.onstop = async () => {
      try {
        transcribing = true; // show spinner while we wait

        // Build a blob with the same type the recorder produced.
        const blobType = (chunks[0] as any)?.type || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });

        // Wrap in a File so name and type travel together.
        const ext = extFromMime(blob.type || "");
        const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || blobType });

        // Build the request body expected by the API route.
        const fd = new FormData();
        fd.append("file", fileForUpload); // name must be "file"

        // Call your server endpoint which calls Whisper.
        const resp = await fetch("/api/transcribe", { method: "POST", body: fd });

        // Try to parse JSON even on non 2xx to surface errors during testing.
        const data = await resp.json().catch(() => ({} as any));

        // Support either { transcript } or { text } shapes.
        transcript = (data.transcript || data.text || "").trim();

        // Append the transcript to any typed text instead of overwriting.
        if (transcript) {
          text = text ? `${text} ${transcript}` : transcript;
        }
      } catch (err) {
        // Surface in console so mobile debugging is possible.
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

      // If the server returns an error JSON, we still parse it so UI does not hang silently.
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        console.error("Summarize failed", data?.error || "Unknown error");
        return;
      }

      summary = (data.summary || "").trim();
      // Endpoint may return tags as an array - support that shape.
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
