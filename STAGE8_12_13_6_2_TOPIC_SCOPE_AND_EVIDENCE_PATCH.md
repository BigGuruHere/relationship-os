# Stage 8.12.13.6.2 - Topic scope and exact evidence display

This is a targeted, read-only experiment patch.

## Changes

- Exact transcript turn text is rendered visibly beneath every validated turn reference.
- Topic discovery is explicitly instructed to identify all materially affected existing topics and prefer the narrowest semantically appropriate topic.
- Each affected topic carries validated target-speaker turn IDs into the revision step.
- Topic revision receives the topic-relevant target-speaker turns rather than treating every part of the conversation as equally relevant.
- One proposed understanding remains separate for each selected existing topic.
- Previous statements remain conservative: unmentioned knowledge is unchanged unless direct evidence supports a refinement, conflict or potential supersession.
- The experiment remains read-only. No topic, claim, permission, confirmation or summary is persisted.
- Suggested new topics remain advisory only and are not created automatically.

## Database

No migration.
