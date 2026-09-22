// PURPOSE: Lock down the Stage 8.9 application-domain, agent-deployment, encryption, and sensitive-audit boundaries.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-ignore - The Node strip-types test runner requires the explicit TypeScript extension.
import {
	contextDomainForPathname,
	resolveContextSpaceForDomain
} from '../../src/lib/server/core/contextDomain.ts';
// @ts-ignore - The Node strip-types test runner requires the explicit TypeScript extension.
import {
	agentDeploymentAllows,
	assertAgentDeploymentAllowed
} from '../../src/lib/server/agents/deploymentPolicy.ts';
// @ts-ignore - The Node strip-types test runner requires the explicit TypeScript extension.
import { auditJson, safeAgentAuditError } from '../../src/lib/server/agents/sensitiveAudit.ts';

const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
	new URL(
		'../../prisma/migrations/20260922100000_stage8_9_multi_app_context_boundary/migration.sql',
		import.meta.url
	),
	'utf8'
);
const hooks = readFileSync(new URL('../../src/hooks.server.ts', import.meta.url), 'utf8');
const runtime = readFileSync(
	new URL('../../src/lib/server/agents/runtime.ts', import.meta.url),
	'utf8'
);
const toolRegistry = readFileSync(
	new URL('../../src/lib/server/agents/toolRegistry.ts', import.meta.url),
	'utf8'
);
const modelGateway = readFileSync(
	new URL('../../src/lib/server/agents/modelGateway.ts', import.meta.url),
	'utf8'
);
const agentLogger = readFileSync(
	new URL('../../src/lib/server/agents/agentLogger.ts', import.meta.url),
	'utf8'
);
const approvalTool = readFileSync(
	new URL('../../src/lib/server/agents/tools/createApprovalRequest.ts', import.meta.url),
	'utf8'
);
const artifactTool = readFileSync(
	new URL('../../src/lib/server/agents/tools/createArtifact.ts', import.meta.url),
	'utf8'
);
const interactionEncryption = readFileSync(
	new URL('../../src/lib/server/core/interactionEncryption.ts', import.meta.url),
	'utf8'
);
const interactions = readFileSync(
	new URL('../../src/lib/server/core/interactions.ts', import.meta.url),
	'utf8'
);
const settings = readFileSync(
	new URL('../../src/routes/settings/context-spaces/+page.server.ts', import.meta.url),
	'utf8'
);
const layoutServer = readFileSync(
	new URL('../../src/routes/+layout.server.ts', import.meta.url),
	'utf8'
);
const layout = readFileSync(new URL('../../src/routes/+layout.svelte', import.meta.url), 'utf8');

function modelBlock(name: string) {
	return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] || '';
}

test('ContextSpace has an extensible domain and encrypted display identity', () => {
	const block = modelBlock('ContextSpace');
	assert.match(block, /domainKey\s+String\s+@default\("business"\)/);
	assert.match(block, /displayNameEnc\s+String\?/);
	assert.match(block, /@@index\(\[ownerUserId, domainKey\]\)/);
	assert.match(migration, /UPDATE "ContextSpace" SET "domainKey" = 'business'/);
	assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
});

test('route boundaries select Dating only for Dating paths and Business everywhere else', () => {
	assert.equal(contextDomainForPathname('/dating'), 'dating');
	assert.equal(contextDomainForPathname('/dating/feedback'), 'dating');
	assert.equal(contextDomainForPathname('/leads'), 'business');
	assert.equal(contextDomainForPathname('/'), 'business');
	assert.match(hooks, /resolveContextSpaceForDomain/);
	assert.match(hooks, /preferredContextSpaceId/);
});

test('server context resolution ignores a preferred id from another owner or domain', async () => {
	const rows = [
		{
			id: 'business-a',
			ownerUserId: 'user-a',
			domainKey: 'business',
			displayNameEnc: null,
			isDefault: true
		},
		{
			id: 'dating-a',
			ownerUserId: 'user-a',
			domainKey: 'dating',
			displayNameEnc: null,
			isDefault: false
		},
		{
			id: 'dating-b',
			ownerUserId: 'user-b',
			domainKey: 'dating',
			displayNameEnc: null,
			isDefault: false
		}
	];
	const client = {
		contextSpace: {
			async findFirst(args: any) {
				const matches = rows.filter((row) =>
					Object.entries(args.where).every(([key, value]) => (row as any)[key] === value)
				);
				return matches[0] ?? null;
			}
		}
	};

	const resolved = await resolveContextSpaceForDomain(client, {
		ownerUserId: 'user-a',
		domainKey: 'dating',
		preferredContextSpaceId: 'dating-b'
	});
	assert.equal(resolved?.id, 'dating-a');
});

test('agent deployment allows an approved domain or explicit ContextSpace and otherwise fails closed', () => {
	const definition = modelBlock('AgentDefinition');
	assert.match(definition, /allowedDomainKeys\s+String\[\]\s+@default\(\["business"\]\)/);
	assert.match(definition, /allowedContextSpaceIds\s+String\[\]\s+@default\(\[\]\)/);
	const businessOnly = { allowedDomainKeys: ['business'], allowedContextSpaceIds: [] };
	const dating = { id: 'dating-a', ownerUserId: 'user-a', domainKey: 'dating' };
	assert.equal(agentDeploymentAllows(businessOnly, dating), false);
	assert.throws(
		() => assertAgentDeploymentAllowed(businessOnly, dating, 'user-a'),
		/does not permit the dating/
	);
	assert.equal(
		agentDeploymentAllows({ allowedDomainKeys: [], allowedContextSpaceIds: ['dating-a'] }, dating),
		true
	);
	assert.match(runtime, /assertAgentDeploymentAllowed/);
	assert.match(toolRegistry, /assertAgentDeploymentAllowed/);
});

test('sensitive agent runs retain only structural metadata in ordinary audit JSON', () => {
	assert.match(modelBlock('AgentRun'), /auditDataClass\s+String\s+@default\("standard"\)/);
	const secret = 'private dating transcript';
	const redacted = JSON.stringify(auditJson({ transcript: secret }, 'sensitive'));
	assert.doesNotMatch(redacted, /private dating transcript/);
	assert.match(redacted, /"redacted":true/);
	assert.equal(safeAgentAuditError(new Error(secret), 'sensitive').includes(secret), false);
	for (const source of [runtime, toolRegistry, modelGateway, agentLogger]) {
		assert.match(source, /auditJson|safeAgentAuditError/);
	}
	assert.match(approvalTool, /proposedActionJson: auditJson/);
	assert.match(artifactTool, /structuredJson: auditJson/);
	assert.match(artifactTool, /Sensitive agent artifact/);
});

test('Interaction summaries use their own AAD while retaining legacy read compatibility', () => {
	assert.match(interactionEncryption, /SUMMARY_AAD = 'interaction\.summary'/);
	assert.match(interactionEncryption, /LEGACY_SUMMARY_AAD = 'interaction\.raw_text'/);
	assert.match(interactions, /encryptInteractionSummary\(summary\)/);
	assert.match(interactions, /decryptInteractionSummary\(row\.summaryEnc\)/);
});

test('Dating ContextSpace creation and selection are controlled owner-scoped server actions', () => {
	assert.match(settings, /createDating/);
	assert.match(settings, /ensureOwnedDomainContextSpace/);
	assert.match(settings, /where: \{ id: contextSpaceId, ownerUserId: locals\.user\.id \}/);
	assert.match(settings, /contextSelectionCookieName/);
});

test('shared navigation hides Business modules inside Dating and refreshes across route boundaries', () => {
	assert.match(layoutServer, /async \(\{ locals, url \}\)/);
	assert.match(layoutServer, /routePathname = url\.pathname/);
	assert.match(layoutServer, /activeDomainKey: locals\.contextDomainKey/);
	assert.match(layout, /isDatingApplication = data\.activeDomainKey === 'dating'/);
	assert.match(layout, /Switch to Business/);
	assert.match(layout, /Dating home/);
	assert.match(layout, /\{#if !isDatingApplication\}/);
});
