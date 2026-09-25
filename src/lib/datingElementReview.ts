// PURPOSE: Record an explicit human decision for each distinct element of a private Dating reflection.
// SECURITY: These decisions describe the respondent's account, not facts confirmed by the other participant.
// No review decision grants disclosure permission or promotes a KnowledgeClaim automatically.
import type { DatingOutcomeProposal } from './datingOutcome';

function cleanDatingText(value: string): string {
  return value.replace(/\u0000/g, '').trim().slice(0, 4000);
}

export const DATING_REVIEW_ELEMENTS = [
  'personalExperience', 'selfLearning', 'otherPersonExperience',
  'relationshipDynamic', 'desireToContinue', 'wholeOutcome'
] as const;
export type DatingReviewElement = (typeof DATING_REVIEW_ELEMENTS)[number];
export type DatingElementDecision = 'CONFIRMED' | 'CORRECTED' | 'REJECTED' | 'DEFERRED';
export type DatingElementReview = {
  element: DatingReviewElement;
  decision: DatingElementDecision;
  // Text is null unless the respondent has accepted or corrected this particular element.
  reviewedText: string | null;
  // Opaque provenance IDs, not free-form source text or information about the other participant.
  sourceInteractionId: string;
  respondentParticipantId: string;
  reviewedAt: string;
  attribution: 'RESPONDENT_ACCOUNT';
};
export const DATING_ELEMENT_DECISIONS: { value: DatingElementDecision; label: string }[] = [
  { value: 'CONFIRMED', label: 'Confirm' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'DEFERRED', label: 'Not sure yet' }
];

function elementText(proposal: DatingOutcomeProposal, element: DatingReviewElement): string {
  if (element === 'wholeOutcome') return proposal.wholeOutcome.result;
  return proposal[element].summary;
}

export function reviewDatingElements(
  original: DatingOutcomeProposal,
  edited: DatingOutcomeProposal,
  form: FormData,
  reviewedAt = new Date().toISOString()
): { proposal: DatingOutcomeProposal; elements: DatingElementReview[]; createOutcome: boolean } {
  const approved = structuredClone(edited);
  const elements = DATING_REVIEW_ELEMENTS.map((element): DatingElementReview => {
    const decision = String(form.get(`reviewDecision_${element}`) ?? '');
    // Keep accepting the former CORRECTED form value for compatible older clients.
    // The simplified interface submits CONFIRMED, and the server detects an edit.
    if (!DATING_ELEMENT_DECISIONS.some((option) => option.value === decision) && decision !== 'CORRECTED') {
      throw new Error(`Choose a review decision for ${element}.`);
    }
    const editedText = elementText(edited, element);
    // Compare the whole editable element, not just its summary. Otherwise a changed
    // status/continuation flag could slip through a simple text confirmation.
    const changed = element === 'wholeOutcome'
      ? JSON.stringify(original.wholeOutcome) !== JSON.stringify(edited.wholeOutcome)
      : element === 'desireToContinue'
        ? original.desireToContinue.summary !== edited.desireToContinue.summary || original.desireToContinue.value !== edited.desireToContinue.value
        : original[element].summary !== edited[element].summary;
    // A single Confirm action derives whether the person corrected the AI's proposal.
    // Preserve the distinction in the encrypted review record without asking the
    // respondent to classify their own edit. Legacy CORRECTED submissions still
    // require a real edit so stored provenance cannot be mislabeled.
    if (decision === 'CORRECTED' && !changed) {
      throw new Error(`Correct ${element} before marking it corrected.`);
    }
    const storedDecision = decision === 'CONFIRMED' && changed ? 'CORRECTED' : decision;
    if ((decision === 'CORRECTED' || decision === 'CONFIRMED') && !editedText && element !== 'wholeOutcome') {
      throw new Error(`Provide text for the confirmed ${element} element.`);
    }
    // Reject/defer means the proposed text is not approved. Keep the original only in the
    // separately encrypted source proposal, not in the approved reflection's active fields.
    if (decision === 'REJECTED' || decision === 'DEFERRED') {
      if (element === 'wholeOutcome') {
        approved.wholeOutcome = { status: 'UNKNOWN', useful: null, continued: null, result: '', notes: '' };
      } else if (element === 'desireToContinue') {
        approved.desireToContinue = { summary: '', evidence: [], value: 'NOT_STATED' };
      } else {
        approved[element] = { summary: '', evidence: [] };
      }
    }
    return {
      element,
      decision: storedDecision as DatingElementDecision,
      reviewedText: decision === 'CONFIRMED' || decision === 'CORRECTED' ? cleanDatingText(editedText) : null,
      sourceInteractionId: original.sourceInteractionId,
      respondentParticipantId: original.respondentParticipantId,
      reviewedAt,
      attribution: 'RESPONDENT_ACCOUNT'
    };
  });
  return {
    proposal: approved,
    elements,
    // Both unchanged and edited confirmation of the whole Outcome permit creation.
    createOutcome: ['CONFIRMED', 'CORRECTED'].includes(
      elements.find((item) => item.element === 'wholeOutcome')?.decision ?? ''
    )
  };
}
