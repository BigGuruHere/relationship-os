# Stage 6.4/6.5 v2 notes

This v2 package keeps the Stage 6.4/6.5 migrations unchanged, but adjusts the Prisma enum order in `schema.prisma` so it matches PostgreSQL after the enum values are appended.

Use this if `npx prisma migrate dev` applied `20260818112000_stage6_4_5_lead_enum_values` and `20260818113000_stage6_4_5_project_lead_usability`, then asked for another migration name.

Press Ctrl+C at the migration-name prompt, apply this v2 package, then run `npx prisma migrate dev` again.
