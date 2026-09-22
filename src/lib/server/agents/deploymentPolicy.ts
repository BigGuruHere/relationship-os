// src/lib/server/agents/deploymentPolicy.ts
// PURPOSE: Enforce the application domains and explicit ContextSpaces where an agent may execute.
// SECURITY: Agent data policy and tool permission do not grant deployment into another app domain.

export type AgentDeploymentPolicy = {
	allowedDomainKeys: string[];
	allowedContextSpaceIds: string[];
};

export type AgentDeploymentTarget = {
	id: string;
	ownerUserId: string;
	domainKey: string;
};

export function agentDeploymentAllows(
	policy: AgentDeploymentPolicy,
	target: AgentDeploymentTarget
) {
	const allowedDomains = new Set(
		(policy.allowedDomainKeys || [])
			.map((value) => String(value).trim().toLowerCase())
			.filter(Boolean)
	);
	const allowedSpaces = new Set(
		(policy.allowedContextSpaceIds || []).map((value) => String(value).trim()).filter(Boolean)
	);
	return (
		allowedSpaces.has(target.id) ||
		allowedDomains.has(String(target.domainKey).trim().toLowerCase())
	);
}

export function assertAgentDeploymentAllowed(
	policy: AgentDeploymentPolicy,
	target: AgentDeploymentTarget,
	expectedOwnerUserId: string
) {
	if (target.ownerUserId !== expectedOwnerUserId) {
		throw new Error('Agent deployment target is not owned by this workspace.');
	}
	if (!agentDeploymentAllows(policy, target)) {
		throw new Error(`Agent deployment does not permit the ${target.domainKey} application domain.`);
	}
}
