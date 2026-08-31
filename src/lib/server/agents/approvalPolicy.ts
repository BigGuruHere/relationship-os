// src/lib/server/agents/approvalPolicy.ts
// PURPOSE: Centralise the decision that blocks approval-gated tools before execution.

export type ApprovalPolicyInput = {
  toolRequiresApproval: boolean;
  definitionRequiresApproval: boolean;
  permissionRequiresApproval: boolean;
};

// IT: Approval is fail-closed. Any layer may require approval and no layer may override another layer's requirement.
export function needsToolApproval(input: ApprovalPolicyInput) {
  return input.toolRequiresApproval || input.definitionRequiresApproval || input.permissionRequiresApproval;
}
