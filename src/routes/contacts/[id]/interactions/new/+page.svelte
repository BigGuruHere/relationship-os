<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: Simple new note UI with voice record, summarize, and save.
  // ENHANCEMENTS: Uses lower-quality constraints and timeslice to keep files small and reliable.

  export let form;

  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = "";

  let transcribing = false;
  let summarizing = false;
  let saving = false;

  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus";
    const fallback = "audio/mp4";
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) {
      return preferred;
    }
    return fallback;
  }

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

  async function startRecording() {
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 1,        // mono
        sampleRate: 16000,      // 16 kHz
        sampleSize: 16,         // 16-bit
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);

    const mimeType = pickRecorderMime();
    mediaRecorder = new MediaRecorder(currentStream, { mimeType });

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        transcribing = true;

        if (!chunks.length) return;
        const firstType = (chunks[0] as any)?.type || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: firstType });

        if (!blob.size) return;

        const ext = extFromMime(blob.type || "");
        const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || firstType });

        const fd = new FormData();
        fd.append("file", fileForUpload);

        const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await resp.json().catch(() => ({} as any));

        transcript = (data.transcript || data.text || "").trim();
        if (transcript) {
          text = text ? `${text} ${transcript}` : transcript;
        }
      } finally {
        transcribing = false;
        currentStream?.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }
    };

    // timeslice = 1000ms ensures chunks arrive every second (fixes long recordings)
    mediaRecorder.start(1000);
    recording = true;
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    transcribing = true;
    mediaRecorder?.stop();
  }

  async function summarize() {
    try {
      summarizing = true;
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) return;

      summary = (data.summary || "").trim();
      tags = Array.isArray(data.tags) ? data.tags.join(", ") : (tags || "");
    } finally {
      summarizing = false;
    }
  }

  function handleSubmit() {
    saving = true;
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1>Add note</h1>

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

  .inline-wait {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .muted { color: var(--muted); }
</style>
