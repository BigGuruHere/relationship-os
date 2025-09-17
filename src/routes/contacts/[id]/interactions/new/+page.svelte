<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: New note UI with voice record, summarize, and save.
  // - Lower quality constraints and 1s timeslice for reliable long recordings.
  // - Filename extension matches actual blob type so Whisper accepts it.
  // - Robust lifecycle: UI tracks actual MediaRecorder state.
  // - On-screen notifications at each stage, plus a rolling event log panel.

  export let form;

  // Form state
  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Recorder state
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = "";

  // Busy flags
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // Debug UI
  let showLog = true;                 // toggle event log panel
  let logLines: string[] = [];        // most recent events
  let lastBlobType = "";
  let lastBlobSize = 0;

  // Toast notifications
  type Toast = { id: number; text: string };
  let toasts: Toast[] = [];
  let toastSeq = 1;

  // Add a toast chip that auto disappears
  function notify(text: string, ttlMs = 5000) {
    const t = { id: toastSeq++, text };
    toasts = [t, ...toasts].slice(0, 8); // cap to 8 visible
    const id = t.id;
    setTimeout(() => {
      toasts = toasts.filter((x) => x.id !== id);
    }, ttlMs);
  }

  // Add a line to the event log with a timestamp
  function log(msg: string, data?: Record<string, unknown>) {
    const time = new Date().toLocaleTimeString();
    const line = `[${time}] ${msg}` + (data ? ` ${JSON.stringify(data)}` : "");
    logLines = [line, ...logLines].slice(0, 40); // keep last 40 lines
  }

  // Choose recorder mime by browser capability
  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus"; // Chrome
    const fallback = "audio/mp4";               // Safari iOS often uses mp4
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) {
      return preferred;
    }
    return fallback;
  }

  // Map mime to file extension for server upload
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

  // Start recording - fully instrumented with notifications and logs
  async function startRecording() {
    try {
      notify("Requesting microphone...");
      log("getUserMedia requested");

      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,       // mono
          sampleRate: 16000,     // 16 kHz
          sampleSize: 16,        // 16 bit
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      };

      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      notify("Microphone granted");
      log("getUserMedia ok", { tracks: currentStream.getTracks().length });

      const mimeType = pickRecorderMime();
      mediaRecorder = new MediaRecorder(currentStream, { mimeType });
      log("MediaRecorder created", { mimeType });
      notify(`Recorder ready: ${mimeType}`);

      const chunks: BlobPart[] = [];

      // Gather chunks over time - with timeslice this fires roughly every second
      mediaRecorder.ondataavailable = (e) => {
        const size = e?.data?.size || 0;
        const type = e?.data?.type || "";
        if (size > 0) chunks.push(e.data);
        log("ondataavailable", { size, type, chunkCount: chunks.length });
      };

      // Only mark recording true when onstart fires
      mediaRecorder.onstart = () => {
        recording = true;
        notify("Recording started");
        log("onstart");
      };

      mediaRecorder.onpause = () => {
        notify("Recording paused");
        log("onpause");
      };

      mediaRecorder.onresume = () => {
        notify("Recording resumed");
        log("onresume");
      };

      mediaRecorder.onerror = (err: any) => {
        notify("Recorder error");
        log("onerror", { name: err?.name, message: err?.message });
        recording = false;
        transcribing = false;
        // Clean up stream on error
        currentStream?.getTracks().forEach((t) => t.stop());
        currentStream = null;
      };

      // When recording stops, build the blob and upload
      mediaRecorder.onstop = async () => {
        recording = false;
        notify("Recording stopped");
        log("onstop", { chunkCount: chunks.length });

        try {
          transcribing = true;
          notify("Building audio for upload...");
          if (!chunks.length) {
            notify("No audio captured");
            log("no chunks present");
            return;
          }

          const firstType = (chunks[0] as any)?.type || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: firstType });
          lastBlobType = blob.type || firstType;
          lastBlobSize = blob.size || 0;
          log("built blob", { type: lastBlobType, size: lastBlobSize });
          if (!blob.size) {
            notify("Audio blob was empty");
            return;
          }

          const ext = extFromMime(blob.type || "");
          const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || firstType });

          // Prepare upload
          const fd = new FormData();
          fd.append("file", fileForUpload);

          notify("Uploading for transcription...");
          log("upload start");

          const resp = await fetch("/api/transcribe", { method: "POST", body: fd });

          // Try to parse JSON no matter what to see error bodies
          const data = await resp.json().catch(() => ({} as any));
          log("upload done", { ok: resp.ok, status: resp.status, keys: Object.keys(data || {}) });

          const extracted = (data.transcript || data.text || "").trim();
          if (extracted) {
            transcript = extracted;
            text = text ? `${text} ${extracted}` : extracted;
            notify("Transcription received");
          } else if (!resp.ok) {
            notify(`Transcription failed - status ${resp.status}`);
          } else {
            notify("No transcript returned");
          }
        } finally {
          transcribing = false;
          // Always stop mic tracks
          currentStream?.getTracks().forEach((t) => t.stop());
          currentStream = null;
        }
      };

      // Start recorder with 1s timeslice - improves reliability on mobile
      mediaRecorder.start(1000);
      notify("Recorder start requested");
      log("mediaRecorder.start(1000)");
    } catch (err: any) {
      notify("Mic access failed");
      log("startRecording error", { message: err?.message || String(err) });
      // Clean up on failure
      currentStream?.getTracks().forEach((t) => t.stop());
      currentStream = null;
      mediaRecorder = null;
      recording = false;
    }
  }

  // Stop recording - safe and idempotent
  function stopRecording() {
    const state = mediaRecorder?.state;
    if (state !== "recording") {
      notify("Stop ignored - not recording");
      return;
    }
    transcribing = true; // immediate feedback while onstop work runs
    try {
      mediaRecorder?.stop();
      notify("Stopping...");
      log("stop called");
    } catch {
      transcribing = false;
      notify("Stop threw an error");
    }
  }

  // Call summarize endpoint with simple error surface
  async function summarize() {
    try {
      summarizing = true;
      notify("Summarizing...");
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        notify(`Summary failed - status ${resp.status}`);
        log("summarize non 2xx", { status: resp.status, error: data?.error });
        return;
      }
      summary = (data.summary || "").trim();
      tags = Array.isArray(data.tags) ? data.tags.join(", ") : (tags || "");
      notify("Summary ready");
    } catch (err: any) {
      notify("Summary error");
      log("summarize error", { message: err?.message || String(err) });
    } finally {
      summarizing = false;
    }
  }

  // Submit handler toggles saving until nav
  function handleSubmit() {
    saving = true;
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

        <!-- Voice controls -->
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

          <!-- Inline feedback while server work runs -->
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

    <!-- Event log panel -->
    {#if showLog}
      <div class="card" style="padding:12px; margin-top:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <strong>Recorder log</strong>
          <label style="font-size:0.9rem;">
            <input type="checkbox" bind:checked={showLog} />
            Show
          </label>
        </div>
        <div style="margin:8px 0; color:var(--muted); font-size:0.9rem;">
          Last blob: {lastBlobType || "n/a"} - {lastBlobSize ? (lastBlobSize/1024).toFixed(1) + " KB" : "0 KB"}
        </div>
        <pre style="white-space:pre-wrap; max-height:200px; overflow:auto; font-size:0.85rem; background:var(--surface-muted); padding:8px; border-radius:8px;">
{logLines.join("\n")}
        </pre>
      </div>
    {/if}
  </div>
</div>

<!-- Toast chips - fixed position top right -->
<div class="toasts">
  {#each toasts as t (t.id)}
    <div class="toast">{t.text}</div>
  {/each}
</div>

<style>
  /* Small, theme-friendly spinner */
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

  /* Toast chips container */
  .toasts {
    position: fixed;
    top: 10px;
    right: 10px;
    display: grid;
    gap: 8px;
    z-index: 9999;
    pointer-events: none; /* clicks pass through */
  }
  .toast {
    pointer-events: auto;
    background: var(--surface, #fff);
    color: var(--text, #111);
    border: 1px solid var(--border, #ddd);
    border-radius: 9999px;
    padding: 6px 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    font-size: 0.9rem;
  }
</style>
