// PURPOSE: Strict, deterministic parsing of consented labelled transcripts for the Dating pilot.
// SECURITY: Do not infer who an unlabelled speaker is or rewrite quoted source passages.
export type TranscriptTurn = { id: string; speaker: string; text: string };
export type ParsedTranscript = { speakers: string[]; turns: TranscriptTurn[]; text: string };
const MAX_TRANSCRIPT = 60000;
const SPEAKER_LINE = /^(?:\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]\s*)?([^:\n]{1,65}):\s*(.*)$/;

export function parseDatingTranscript(input: unknown): ParsedTranscript {
  const text = String(input ?? '').replace(/\r\n?/g, '\n').trim();
  if (text.length < 10 || text.length > MAX_TRANSCRIPT) throw new Error('Enter a transcript of 10 to 60,000 characters.');
  const turns: TranscriptTurn[] = [];
  const speakers = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    // IT: An export heading is metadata, never a speaker. Keep it unchanged in the encrypted original.
    if (!turns.length && /^\s*(?:#{1,6}\s*)?conversation transcript\s*:\s*$/i.test(line)) continue;
    const match = line.match(SPEAKER_LINE);
    // New turns must have an explicit speaker label. Unlabelled lines belong to the preceding turn only.
    if (match && match[1].trim() && !/^https?$/i.test(match[1].trim())) {
      const speaker = match[1].trim();
      if (/[<>]/.test(speaker)) throw new Error('Invalid speaker label.');
      if (speakers.size >= 8 && !speakers.has(speaker)) throw new Error('Only eight distinct speaker labels are supported.');
      speakers.add(speaker);
      turns.push({ id: `T${String(turns.length + 1).padStart(3, '0')}`, speaker, text: line });
    } else if (turns.length) {
      // Preserve the original line exactly, including any quotes and speaker references.
      turns[turns.length - 1].text += `\n${line}`;
    } else {
      throw new Error('Start the transcript with an explicit speaker label such as "Alex: ...".');
    }
    if (turns.length > 600) throw new Error('Only 600 speaker turns are supported per import.');
  }
  if (!turns.length || !speakers.size) throw new Error('No labelled speaker turns were found.');
  return { text, turns, speakers: [...speakers] };
}

// Each private excerpt contains only the selected speaker's verbatim turns, never other speakers' words.
// The full original is retained separately and private; excerpts are bounded for the existing AI pathway.
export function speakerExcerptChunks(turns: TranscriptTurn[], speaker: string, limit = 4800): string[] {
  const result: string[] = [];
  let chunk = '';
  for (const turn of turns.filter(t => t.speaker === speaker)) {
    if (turn.text.length > limit) throw new Error('A single speaker turn exceeds 4,800 characters. Divide that turn before importing.');
    if (chunk && `${chunk}\n\n${turn.text}`.length > limit) { result.push(chunk); chunk = ''; }
    chunk = chunk ? `${chunk}\n\n${turn.text}` : turn.text;
  }
  if (chunk) result.push(chunk);
  if (result.length > 16) throw new Error('A speaker has more than 16 excerpts. Divide this conversation into smaller imports.');
  return result;
}

export function validateSpeakerMapping(speakers: string[], mapping: Record<string, string>, validContactIds: Set<string>) {
  const selected = new Set<string>();
  for (const speaker of speakers) {
    const id = mapping[speaker];
    if (id === 'SKIP') continue;
    if (!id || !validContactIds.has(id)) throw new Error(`Choose a person or skip speaker ${speaker}.`);
    if (selected.has(id)) throw new Error('Each speaker must have a different person. Review speaker attribution before saving.');
    selected.add(id);
  }
  if (!selected.size) throw new Error('Map at least one speaker to a person.');
  return selected;
}


// Stage 8.12.13.4: One source per speaker. Conversation windows retain adjacent
// turns for context but do not make another speaker's dialogue first-person evidence.
export function speakerSource(turns: TranscriptTurn[], speaker: string): string {
  return turns.filter(turn => turn.speaker === speaker).map(turn => turn.text).join('\n\n');
}

export function conversationWindows(turns: TranscriptTurn[], speaker: string, maxChars = 11500):
  { context: string; speakerSource: string }[] {
  if (maxChars < 1000) throw new Error('Conversation context window is too small.');
  const windows: { context: string; speakerSource: string }[] = [];
  let batch: TranscriptTurn[] = [];
  let size = 0;
  let preceding: TranscriptTurn | undefined;
  const flush = () => {
    if (!batch.some(turn => turn.speaker === speaker)) return;
    // Include the immediately preceding prompt at a chunk boundary, if available.
    const room = maxChars - size - 2;
    const previousContext = preceding && preceding.speaker !== speaker && room >= 100
      ? { id: preceding.id, speaker: preceding.speaker, text: preceding.text.length <= room ? preceding.text :
        `${preceding.speaker}: ${preceding.text.slice(preceding.speaker.length + 2, Math.max(preceding.speaker.length + 2, room - 3))}...` }
      : null;
    const context = previousContext ? [previousContext, ...batch] : batch;
    windows.push({ context: context.map(turn => turn.text).join('\n\n'),
      speakerSource: speakerSource(batch, speaker) });
  };
  // Split unusually long monologues for model context only. The encrypted source
  // and the single person-level review retain the original turn unchanged.
  const modelTurns: TranscriptTurn[] = turns.flatMap(turn => {
    if (turn.text.length <= maxChars) return [turn];
    const prefix = `${turn.speaker}: `;
    const body = turn.text.slice(prefix.length);
    const step = maxChars - prefix.length - 10;
    const segments: TranscriptTurn[] = [];
    for (let offset = 0; offset < body.length; offset += step) {
      segments.push({ id: turn.id, speaker: turn.speaker, text: prefix + body.slice(offset, offset + step) });
    }
    return segments;
  });
  for (const turn of modelTurns) {
    if (batch.length && size + turn.text.length + 2 > maxChars) {
      flush();
      preceding = batch[batch.length - 1];
      batch = [];
      size = 0;
    }
    batch.push(turn);
    size += turn.text.length + 2;
  }
  flush();
  return windows;
}
