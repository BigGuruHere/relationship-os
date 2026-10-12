# Stage 8.14.3 - Living Understanding Call Loop

A completed ElevenLabs call now hands its participant-specific source into the existing, human-approved Living Understanding workflow without automatically running AI or authorising knowledge.

After the post-call transcript is authenticated, normalized, stored and attached to a resolved participant, Relish describes one of three states:

- `INITIAL_REVIEW_READY` - no authoritative Living Understanding exists yet.
- `IMPACT_REVIEW_READY` - an authoritative baseline exists and this new source is ready for longitudinal impact review.
- `ALREADY_APPLIED` - the source is already represented in authoritative revision history.

The General participant page shows the appropriate action for each conversation source. The post-call webhook response and concise diagnostic log also include the review handoff state and URL.

No post-call webhook automatically invokes a model, changes Living Understanding, grants sharing permission or bypasses the existing explicit review/approval workflow.

Stage 8.14.3 also makes ElevenLabs diagnostic logging concise by default. Full payloads remain available only when `ELEVENLABS_DEBUG_LOG_PAYLOADS=YES`.
