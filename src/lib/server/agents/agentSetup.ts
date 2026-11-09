import { requiredEnv } from '$lib/server/config/requiredEnv';
// src/lib/server/agents/agentSetup.ts
// PURPOSE: Create core agent definitions and tool permissions if missing.

import { prisma } from '$lib/db';

export const DATING_OUTCOME_OUTPUT_SCHEMA = {
	type: 'object',
	required: [
		'personalExperience',
		'selfLearning',
		'otherPersonExperience',
		'relationshipDynamic',
		'desireToContinue',
		'wholeOutcome',
		'confidence'
	],
	properties: {
		personalExperience: {
			type: 'object',
			required: ['summary', 'evidence'],
			properties: {
				summary: { type: 'string' },
				evidence: { type: 'array', items: { type: 'string' } }
			}
		},
		selfLearning: {
			type: 'object',
			required: ['summary', 'evidence'],
			properties: {
				summary: { type: 'string' },
				evidence: { type: 'array', items: { type: 'string' } }
			}
		},
		otherPersonExperience: {
			type: 'object',
			required: ['summary', 'evidence'],
			properties: {
				summary: { type: 'string' },
				evidence: { type: 'array', items: { type: 'string' } }
			}
		},
		relationshipDynamic: {
			type: 'object',
			required: ['summary', 'evidence'],
			properties: {
				summary: { type: 'string' },
				evidence: { type: 'array', items: { type: 'string' } }
			}
		},
		desireToContinue: {
			type: 'object',
			required: ['value', 'summary', 'evidence'],
			properties: {
				value: { type: 'string', enum: ['YES', 'NO', 'UNSURE', 'NOT_STATED'] },
				summary: { type: 'string' },
				evidence: { type: 'array', items: { type: 'string' } }
			}
		},
		wholeOutcome: {
			type: 'object',
			required: ['status', 'useful', 'continued', 'result', 'notes'],
			properties: {
				status: {
					type: 'string',
					enum: [
						'UNKNOWN',
						'NO_RESPONSE',
						'DECLINED',
						'CONNECTED',
						'CONTINUING',
						'SUCCESSFUL',
						'ENDED'
					]
				},
				useful: { type: ['boolean', 'null'] },
				continued: { type: ['boolean', 'null'] },
				result: { type: 'string' },
				notes: { type: 'string' }
			}
		},
		confidence: { type: 'number' }
	}
};

const DATING_OUTCOME_SYSTEM_PROMPT = `You are the Dating Outcome Extractor inside Relish.
You extract a faithful structured proposal from one person's private reflection after a date or introduction.
The transcript is evidence, not canonical truth. Distinguish the respondent's own experience, what they learned about themselves, their experience of the other person, the relationship dynamic, and their desire to continue.
Do not diagnose either person. Do not infer protected or intimate traits. Do not turn preferences into facts about the other person. Do not infer consent or permission from silence.
Use short evidence excerpts only when the transcript directly supports a field. Return strict JSON only without markdown fences.`;

const DATING_OUTCOME_INSTRUCTIONS = `Create a provisional extraction for mandatory human review.
Personal experience means how the respondent experienced the date, venue, format, comfort, enjoyment, or similar matters.
Self-learning means preferences, boundaries, or insights the respondent explicitly learned about themselves.
Other-person experience means the respondent's subjective impression of the other person, never an objective claim.
Relationship dynamic means the interaction between the two people as experienced by the respondent.
Desire to continue must be YES, NO, UNSURE, or NOT_STATED and must not be guessed.
The whole Outcome is a cautious summary of what happened. Leave uncertain values null or UNKNOWN.
Do not propose Knowledge Claims, Wants, Offers, matches, messages, or disclosure to the other participant.`;

const AGENTS = [
	{
		key: 'dating_outcome_extractor',
		name: 'Dating Outcome Extractor',
		description:
			'Produces a private, provisional extraction from a single-sided Dating voice reflection.',
		category: 'dating_feedback',
		personaKey: 'dating_reflection_listener',
		purposeKey: 'dating_outcome_extraction',
		deploymentScope: 'workspace_internal',
		authorityLevel: 'propose_only',
		allowedDomainKeys: ['dating'],
		dataPolicy: {
			allowContacts: false,
			allowCompanies: false,
			allowDeals: false,
			allowProjects: false,
			allowPeople: false,
			allowIdentity: false,
			allowContactMethods: false,
			allowInteractions: true,
			allowKnowledgeClaims: false,
			allowObjectives: false,
			allowWants: false,
			allowOffers: false,
			allowRelationships: false,
			allowIntroductions: true,
			allowOutcomes: true,
			allowTasks: false,
			maxRecentInteractions: 1,
			maxKnowledgeClaims: 0,
			maxObjectives: 0,
			maxWants: 0,
			maxOffers: 0
		},
		systemPrompt: DATING_OUTCOME_SYSTEM_PROMPT,
		instructions: DATING_OUTCOME_INSTRUCTIONS,
		outputSchemaJson: DATING_OUTCOME_OUTPUT_SCHEMA,
		requiresApprovalDefault: true,
		promptVersion: 1
	}
];

// Only tools needed by retained Relish agents are seeded. Brokerage lives on its own branch.
const CORE_TOOLS = [
  { key: 'create_agent_artifact', name: 'Create agent artifact',
    description: 'Stores an encrypted durable output produced by an agent.',
    toolType: 'write', requiresApproval: false, agents: ['dating_outcome_extractor'] },
  { key: 'create_approval_request', name: 'Create approval request',
    description: 'Creates a human approval request for a proposed agent action.',
    toolType: 'propose', requiresApproval: false, agents: ['dating_outcome_extractor'] }
];

export async function ensureCoreAgentSetup(userId: string) {
	const createdAgents = new Map<string, { id: string }>();

	for (const cfg of AGENTS) {
		const agent = await prisma.agentDefinition.upsert({
			where: { userId_key: { userId, key: cfg.key } },
			update: {
				name: cfg.name,
				description: cfg.description,
				category: cfg.category,
				status: 'active',
				personaKey: cfg.personaKey,
				purposeKey: cfg.purposeKey,
				deploymentScope: cfg.deploymentScope,
				authorityLevel: cfg.authorityLevel,
				allowedDomainKeys: cfg.allowedDomainKeys,
				allowedContextSpaceIds: [],
				defaultModelProvider: 'openai',
				defaultModelName: requiredEnv('AGENT_DEFAULT_MODEL'),
				systemPrompt: cfg.systemPrompt,
				instructions: cfg.instructions,
				outputSchemaJson: cfg.outputSchemaJson as any,
				requiresApprovalDefault: cfg.requiresApprovalDefault
			},
			create: {
				userId,
				key: cfg.key,
				name: cfg.name,
				description: cfg.description,
				category: cfg.category,
				status: 'active',
				personaKey: cfg.personaKey,
				purposeKey: cfg.purposeKey,
				deploymentScope: cfg.deploymentScope,
				authorityLevel: cfg.authorityLevel,
				allowedDomainKeys: cfg.allowedDomainKeys,
				allowedContextSpaceIds: [],
				defaultModelProvider: 'openai',
				defaultModelName: requiredEnv('AGENT_DEFAULT_MODEL'),
				systemPrompt: cfg.systemPrompt,
				instructions: cfg.instructions,
				outputSchemaJson: cfg.outputSchemaJson as any,
				requiresApprovalDefault: cfg.requiresApprovalDefault
			}
		});
		createdAgents.set(cfg.key, { id: agent.id });

		await prisma.agentDataAccessPolicy.upsert({
			where: { agentDefinitionId: agent.id },
			update: {
				userId,
				scopeKey: 'workspace_visible',
				...cfg.dataPolicy
			},
			create: {
				userId,
				agentDefinitionId: agent.id,
				scopeKey: 'workspace_visible',
				...cfg.dataPolicy
			}
		});

		await prisma.agentPromptVersion.upsert({
			where: {
				agentDefinitionId_version: { agentDefinitionId: agent.id, version: cfg.promptVersion }
			},
			update: {
				userId,
				systemPrompt: cfg.systemPrompt,
				instructions: cfg.instructions,
				outputSchemaJson: cfg.outputSchemaJson as any,
				isActive: true
			},
			create: {
				userId,
				agentDefinitionId: agent.id,
				version: cfg.promptVersion,
				systemPrompt: cfg.systemPrompt,
				instructions: cfg.instructions,
				outputSchemaJson: cfg.outputSchemaJson as any,
				isActive: true,
				createdBy: 'system'
			}
		});
	}

	for (const tool of CORE_TOOLS) {
		const dbTool = await prisma.agentToolDefinition.upsert({
			where: { userId_key: { userId, key: tool.key } },
			update: {
				name: tool.name,
				description: tool.description,
				toolType: tool.toolType,
				requiresApproval: tool.requiresApproval,
				isEnabled: true
			},
			create: {
				userId,
				key: tool.key,
				name: tool.name,
				description: tool.description,
				toolType: tool.toolType,
				requiresApproval: tool.requiresApproval,
				isEnabled: true
			}
		});

		for (const agentKey of tool.agents) {
			const agent = createdAgents.get(agentKey);
			if (!agent) continue;
			await prisma.agentToolPermission.upsert({
				where: {
					agentDefinitionId_toolDefinitionId: {
						agentDefinitionId: agent.id,
						toolDefinitionId: dbTool.id
					}
				},
				update: { permissionLevel: 'execute', requiresApproval: tool.requiresApproval },
				create: {
					agentDefinitionId: agent.id,
					toolDefinitionId: dbTool.id,
					permissionLevel: 'execute',
					requiresApproval: tool.requiresApproval
				}
			});
		}
	}

	return createdAgents.get('dating_outcome_extractor');
}
