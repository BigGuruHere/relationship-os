# Stage 8.12.13.6.1 - Revision experiment URL/source preservation fix

## Problem

The topic-aware revision experiment used normal POST forms for the SvelteKit named actions `?/analyseTopics` and `?/reviseTopics`. A successful submission replaced the browser query string with the named action. This removed the original `sourceInteractionId` from the visible URL.

The action could still complete because the authorised source ID was also posted as a hidden form value, but the subsequent page load no longer had the source ID. The UI therefore displayed both a valid experimental result and the misleading warning asking the operator to open the experiment from an authorised source.

## Fix

Both experimental forms now use SvelteKit `use:enhance`.

- The browser remains on the original experiment URL containing `sourceInteractionId`.
- The server action still receives the hidden source ID and revalidates custody server-side.
- The action result is rendered without replacing the conversation URL with `?/analyseTopics` or `?/reviseTopics`.
- No persistence, permission, custody or model behaviour was changed.

## Migration

No database migration.
