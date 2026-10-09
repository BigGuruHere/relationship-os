// PURPOSE: Compatibility wrappers for the Dating pilot participant directory.
// SECURITY: Core participant helpers recheck owner + ContextSpace + expected application domain.

import { createContextPerson, listContextPeople } from '$lib/server/core/participantDirectory';

export async function listDatingPeople(userId: string, contextSpaceId: string) {
  return listContextPeople({ userId, contextSpaceId }, 'dating');
}

export async function createDatingPerson(params: { userId: string; contextSpaceId: string; name: string }) {
  return createContextPerson({ userId: params.userId, contextSpaceId: params.contextSpaceId }, 'dating', params.name);
}

export function datingPartyLabel(party: any) {
  return party?.contact?.name || party?.company?.name || `Participant ${party?.side || ''}`.trim();
}
