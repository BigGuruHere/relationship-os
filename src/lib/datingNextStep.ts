// PURPOSE: Record an individual's private choice after reviewing a Dating reflection.
// SECURITY: This is an intention, not an instruction to contact or disclose anything.
export const DATING_NEXT_STEP_OPTIONS = [
  { value: 'EXPLORE', label: 'Keep exploring how I feel' },
  { value: 'MEET_AGAIN', label: 'I may want another meeting' },
  { value: 'PAUSE', label: 'Pause and revisit later' },
  { value: 'END', label: 'I do not want to continue' },
  { value: 'NONE', label: 'No next step for now' }
] as const;

export type DatingNextStepChoice = (typeof DATING_NEXT_STEP_OPTIONS)[number]['value'];
export type DatingPrivateNextStep = { choice: DatingNextStepChoice; note: string };

export function normaliseDatingPrivateNextStep(value: unknown, note: unknown): DatingPrivateNextStep {
  // Fail closed on unknown choices rather than inferring consent from unexpected form values.
  const choice = DATING_NEXT_STEP_OPTIONS.find((option) => option.value === value)?.value;
  if (!choice) throw new Error('Choose a valid private next step.');
  return {
    choice,
    note: String(note ?? '').replace(/\u0000/g, '').trim().slice(0, 1000)
  };
}

export function datingNextStepLabel(choice: string): string {
  return DATING_NEXT_STEP_OPTIONS.find((option) => option.value === choice)?.label || 'No next step recorded';
}
