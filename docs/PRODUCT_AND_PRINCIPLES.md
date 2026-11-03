# Relish: Product Vision and Principles

Status: living product charter. Updated 2026-11-03. Describes agreed direction, not a claim that every future capability is implemented.

## Why Relish exists

**Give humanity access to high-value relationships.**

Relish helps people develop, deepen and benefit from relationships with other people. The central problem is the distance between what people understand about themselves, what other people understand about them, and the support, opportunities and value that may exist across those gaps.

A person should be able to express what matters to them, what they are seeking or exploring, what they can contribute, and what they are actually willing to offer. Relish should make useful human connections easier without reducing people to a set of transactional assets.

Dorian is the warm, distinctive, clearly disclosed AI conversational partner that helps people clarify their understanding, notice possibilities and, with appropriate permission, bring other people into the conversation. Dorian supports human relationships rather than replacing them. The intended style is natural, calm, curious, spontaneous and not interrogative.

## Product shape

- **Relish Core** is the shared relationship system: identity references, owner-private contacts, interactions, source evidence, provenance, permitted understanding, connection processes, introductions and outcomes.
- **My People** is the simple personal entry point: remember someone, capture contact details, record a note, find them again, and choose what happens next.
- **Public profiles and QR sharing** let someone share contact information privately without creating a Relish account, mutual connection or automatic Dorian conversation.
- **Dorian** is a conversational interface into permitted Core information, capable eventually of exploring potential value between people and supporting introductions.
- **Brokerage** is retained as a legacy business workflow on its existing model. New Relish architecture is free to replace incompatible domain structures without forcing Brokerage migration or eventual consolidation.
- Business, Friendship, Dating and future experiences may add relevant language, flows and information boundaries without making the person belong exclusively to any one category.

## Distinctions that must survive implementation

1. **People do not belong exclusively to contexts. Information and interactions have contexts.** A person may participate in many kinds of relationships.
2. A real-world **Person** reference, someone's private **Contact** record, a Relish **User** account, and a mutually acknowledged **Connection** are not interchangeable. A QR submission alone does not establish the others.
3. A Contact can be created before classification. The initial neutral private storage area is a **custody choice**, not a claim that the relationship is personal rather than professional.
4. **Provenance is not permission.** Capturing details from a business profile or an event describes the source, not a permanent relationship label or consent to share information.
5. Each participant owns their private observations of themselves, others and their relationships. Joining Relish, being linked to a Contact, appearing in the same event or connecting with another User must **not** merge or disclose private perspectives automatically.
6. Dorian may receive **permissioned** information from relevant perspectives for a legitimate purpose; that does not grant Dorian permission to reveal one person's private understanding to another person.
7. Distinguish source evidence, uncertain inference, participant-declared information, current operational state and summarised Living Understanding. An AI summary is not a substitute for provenance or exact permission state.
8. People authorise disclosure and introductions. Being a possible match is not itself evidence of a mutual relationship, commitment or permission to contact.
9. The simplest useful experience should come first. **Reuse before building** is a product principle as well as an engineering rule.

## Relationships as subjects of understanding

Mark, Betty and their relationship are distinct subjects. A relationship may have patterns, commitments, tensions, direction and conditions for flourishing that cannot be reduced to either individual's wants. Relish must support understanding the relationship itself and, with permission, influences across relationships.

Keep subject separate from perspective: Mark's private view, Betty's private view, explicitly acknowledged joint statements and Dorian's hypotheses remain distinguishable. Relationship identity or participation never creates shared access. Contextual meaning, custody and permission are independent; the original ContextSpace boundary idea does not require people or entire relationships to belong to one context.

Relationship support can involve changing its form, creating distance or ending it. Dorian must not treat preserving a relationship as an objective overriding its participants. The [foundation design](foundation/ARCHITECTURE.md) supports these future capabilities while implementation begins with private people and notes.

## Typical near-term experience

Meet someone -> share an existing QR/profile -> visitor elects to share contact details -> an owner-private Contact appears in My People -> the owner records a voice note -> the owner can retrieve the record. No involuntary signup, mutual connection, Brokerage Lead or Dorian invitation is implied.

The immediate goal is to make that experience frictionless and dependable with a small pilot group. The broader goal is to understand and facilitate value through durable, consent-governed relationships.

## Longer-term opportunities (not current implementation commitments)

- One coherent owner-private People experience in new Relish. Legacy Brokerage consolidation is optional future work, not a foundation requirement.
- Dorian operating across relevant contexts, with controlled access, memory, identity assurance and disclosure.
- Permissioned opportunities, introductions, reciprocity and human-confirmed outcomes.
- External AI access through explicit governed interfaces (MCP is a possible transport, not a replacement for Relish's domain trust model).
- Additional experiences for career, business, personal, dating, community or group value creation, each built from the same trusted Core.

## Language and posture

Product language should be human, welcoming and not overly technical. Public legal and marketing copy should generally say **data** or **personal information** rather than exposing the internal term **Living Understanding**. Dorian must be clearly identified as AI.

Privacy and custody are product features, not afterthoughts. Expand the service only as consent, access control, deletion/access processes and the operational pilot are verified.
