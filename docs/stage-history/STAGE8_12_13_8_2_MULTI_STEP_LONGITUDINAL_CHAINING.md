# Stage 8.12.13.8.2 - Multi-step longitudinal chaining

This development-only stage extends the read-only Living Understanding experiment from one pairwise comparison into a temporary multi-source chain.

## What changed

- A longitudinal result now produces a new temporary topic baseline (`nextLongitudinalSeed`) representing the proposed understanding as of the latest source.
- The temporary baseline preserves concise source provenance across the chain while using the latest source as the chronology anchor for the next comparison.
- Operational knowledge is carried forward too. Refined/reinforced units can update their proposed wording; potential conflicts and potential retirements remain visible provisional states rather than being silently deleted.
- Newly proposed durable operational units receive stable chain IDs before the next comparison.
- The page shows a read-only v1, v2, v3... evolution history and a **Continue with another later source** form.
- The next comparison starts from the latest proposed Living Understanding, not from the raw text of the immediately previous conversation.
- Temporary interaction state is still displayed but is not carried into enduring person knowledge.

## Safety and custody

- No authoritative Living Understanding, topic, statement, permission, sharing rule or temporary interaction state is persisted.
- Each newly selected source is re-authorised for the same user, Dating ContextSpace and person before decryption/use.
- The browser-carried chain contains concise proposed understandings and source identifiers/dates, not raw transcript text.
- A later source must still be chronologically later than the current temporary baseline source.
- Refreshing or leaving the result discards the temporary chain because this is intentionally still a read-only experiment.

## Database

No migration and no database schema change.
