# Application boundaries

Relish remains a modular monolith. Application modules may use public Relish Core services, but must not bypass ContextSpace custody or read another application's records directly.

- `business` owns Business and broking terminology, workflows, scoring, and presentation.
- `dating` owns Dating terminology, feedback workflows, scoring, and presentation.
- shared identity, custody, evidence, knowledge, consent, projection, agent-policy, and audit capabilities remain in Core.

Stage 8.9 establishes this boundary without moving the existing Business route tree. New domain-specific code should enter the appropriate application directory when practical, while reusable relationship infrastructure remains under `src/lib/server/core`.
