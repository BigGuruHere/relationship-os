// Stage 8.15.4.6b: Prepare Dorian's bounded, participant-owned conversation context.
// Adapted from the working legacy prepareCallData lifecycle, not its old user database.
// SECURITY: This is a prompt projection, never authorization for backend tool writes.
import { prisma } from '$lib/db';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { getCurrentLivingUnderstanding } from '$lib/server/datingPersistedLivingUnderstanding';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';

const bound = (value: string | null | undefined, limit: number) => String(value || '').slice(0, limit);

export async function prepareNetworkDorianContext(input: {
  userId: string; contextSpaceId: string; contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, userId: input.userId,
      contextSpaceId: input.contextSpaceId, linkedUserId: input.userId },
    select: { id: true, personId: true, fullNameEnc: true }
  });
  if (!contact) throw new Error('Participant self-contact is not authorised.');
  const scope = { userId: input.userId, contextSpaceId: input.contextSpaceId, contactId: contact.id };
  const [displayName, living, previousCalls, latestCall] = await Promise.all([
    contactDisplayName(contact),
    getCurrentLivingUnderstanding(scope),
    prisma.interaction.count({ where: { ...scope, channel: PERSON_CONVERSATION_SOURCE_CHANNEL } }),
    prisma.interaction.findFirst({
      where: { ...scope, channel: PERSON_CONVERSATION_SOURCE_CHANNEL },
      orderBy: { occurredAt: 'desc' }, select: { summaryEnc: true }
    })
  ]);
  // Only authorised/current LU. No inviter perspective, no draft revisions or contact notes.
  const livingContext = (living?.topics ?? []).slice(0, 16)
    .map(topic => `${topic.realm} / ${topic.topicName}: ${topic.understanding}`).join('\n');
  const name = bound(displayName, 160);
  return {
    user_name: name,
    participant_name: name,
    previous_calls: String(previousCalls),
    last_call_summary: bound(decryptInteractionSummary(latestCall?.summaryEnc), 1600),
    memory_and_identity_context: bound(livingContext, 8000),
    relish_living_understanding: bound(livingContext, 8000),
    relish_living_understanding_revision: living ? String(living.revisionNumber) : '',
    relish_identity_status: 'RESOLVED',
    // A session-specific starting prompt, not a new memory authority.
    call_instruction: previousCalls > 0
      ? 'Continue naturally with this participant. Use previous context selectively, not as a script. Do not imply their private understanding is shared.'
      : 'Welcome this participant to Dorian. Explore what matters to them without making assumptions. Do not imply their private understanding is shared.'
  };
}
