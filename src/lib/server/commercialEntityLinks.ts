// src/lib/server/commercialEntityLinks.ts
// PURPOSE: Canonical ownership and consistency validation for links attached to first-class Wants/Offers.
// SECURITY: Never trust ids submitted by the browser. Every non-null id is resolved inside the current tenant.

import { prisma } from '$lib/db';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';

export type CommercialEntityLinks = {
  contactId?: string | null;
  personId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  workstreamId?: string | null;
  companyContactId?: string | null;
};

export type ValidatedCommercialEntityLinks = {
  contactId: string | null;
  personId: string | null;
  companyId: string | null;
  dealId: string | null;
  projectId: string | null;
  workstreamId: string | null;
  companyContactId: string | null;
};

function cleanId(value: string | null | undefined) {
  const cleaned = String(value || '').trim();
  return cleaned || null;
}

export async function validateCommercialEntityLinks(
  userId: string,
  input: CommercialEntityLinks
): Promise<ValidatedCommercialEntityLinks> {
  let contactId = cleanId(input.contactId);
  let personId = cleanId(input.personId);
  let companyId = cleanId(input.companyId);
  const dealId = cleanId(input.dealId);
  let projectId = cleanId(input.projectId);
  const workstreamId = cleanId(input.workstreamId);
  const companyContactId = cleanId(input.companyContactId);
  const contextSpaceId = contextSpaceIdForOwner(userId);

  // IT: Resolve all supplied ids in parallel, scoped to this user and current custody context. A crafted foreign-tenant id
  // therefore fails before any Want/Offer row can be written with it.
  const [contact, person, company, deal, project, workstream, companyContact] = await Promise.all([
    contactId ? prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true, personId: true } }) : null,
    personId ? prisma.person.findFirst({ where: { id: personId, OR: [{ accounts: { some: { id: userId } } }, { contacts: { some: { userId, contextSpaceId } } }] }, select: { id: true } }) : null,
    companyId ? prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } }) : null,
    dealId ? prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } }) : null,
    projectId ? prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } }) : null,
    workstreamId
      ? prisma.projectWorkstream.findFirst({ where: { id: workstreamId, userId }, select: { id: true, projectId: true } })
      : null,
    companyContactId
      ? prisma.companyContact.findFirst({ where: { id: companyContactId, userId }, select: { id: true, contactId: true, companyId: true, contact: { select: { personId: true } } } })
      : null
  ]);

  if (contactId && !contact) throw new Error('Selected contact was not found.');
  if (personId && !person) throw new Error('Selected Person identity is not accessible from this workspace.');
  if (contact?.personId) {
    if (personId && personId !== contact.personId) throw new Error('Selected Person identity does not match the selected contact.');
    personId = personId || contact.personId;
  }
  if (companyId && !company) throw new Error('Selected company was not found.');
  if (dealId && !deal) throw new Error('Selected deal was not found.');
  if (projectId && !project) throw new Error('Selected project was not found.');
  if (workstreamId && !workstream) throw new Error('Selected workstream was not found.');
  if (companyContactId && !companyContact) throw new Error('Selected company-contact relationship was not found.');

  if (workstream) {
    // IT: A workstream always defines its parent project. Inherit that project when omitted and
    // reject a mismatched project/workstream pair instead of silently moving the record.
    projectId = projectId || workstream.projectId;
    if (projectId !== workstream.projectId) throw new Error('Selected workstream belongs to a different project.');
  }

  if (companyContact) {
    // IT: A relationship can safely supply missing person/company links, but explicit conflicting
    // links are rejected so the Want/Offer cannot describe one relationship while pointing at another.
    if (contactId && contactId !== companyContact.contactId) {
      throw new Error('Selected company-contact relationship belongs to a different contact.');
    }
    if (companyId && companyId !== companyContact.companyId) {
      throw new Error('Selected company-contact relationship belongs to a different company.');
    }
    contactId = contactId || companyContact.contactId;
    companyId = companyId || companyContact.companyId;
    const relationshipPersonId = companyContact.contact?.personId || null;
    if (relationshipPersonId) {
      if (personId && personId !== relationshipPersonId) throw new Error('Selected Person identity does not match the company-contact relationship.');
      personId = personId || relationshipPersonId;
    }
  }

  return { contactId, personId, companyId, dealId, projectId, workstreamId, companyContactId };
}
