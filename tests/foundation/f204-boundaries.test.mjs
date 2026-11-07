// Keep privileged capability constructors out of routes and prevent accidental second ORM clients.
// These architecture checks complement executable access tests; they are not a security sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';
async function files(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = dir + '/' + entry.name;
		if (entry.isDirectory()) out.push(...(await files(path)));
		else if (/\.(ts|js|svelte)$/.test(path)) out.push(path);
	}
	return out;
}
test('only reviewed modules may establish foundation authority or construct an ORM client', async () => {
	for (const file of await files('src')) {
		const text = await readFile(file, 'utf8');
		if (/new\s+PrismaClient\s*\(/.test(text)) assert.equal(file, 'src/lib/db.ts');
		const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		function walk(node) {
			if (
				ts.isImportDeclaration(node) &&
				node.importClause?.namedBindings &&
				ts.isNamedImports(node.importClause.namedBindings)
			) {
				for (const element of node.importClause.namedBindings.elements) {
					const name = (element.propertyName ?? element.name).text;
					if (name === 'runFoundationBoundary')
						assert.ok(
							[
								'src/lib/server/foundation/policy.ts',
								'src/lib/server/foundation/provisioning.ts',
								'src/lib/server/foundation/privacyOperations.ts',
								// S-402b reviewed transaction, budget and privacy dependency boundaries.
								'src/lib/server/foundation/exchangeAuthority.ts',
								'src/lib/server/foundation/exchangeClaims.ts',
								'src/lib/server/foundation/exchangePrivacy.ts',
                                'src/lib/server/foundation/accountChannels.ts'
							].includes(file),
							file
						);

					// Scope helpers are privileged too; adding a wrapper must not bypass this review gate.
					const exchangeCallers = {
						exchangeScope: [
							'exchangeClaims',
							'exchangeIssue',
							'exchangePrivacy',
							'privacyOperations'
						],
						exchangeTransaction: ['exchangeClaims','accountChannels'],
						exchangeRoots: ['exchangeClaims','accountChannels'],
						lockExchanges: ['privacyOperations'],
						requireClaimSession: ['exchangeClaims','accountChannels'],
                        budget: ['accountChannels'],
                        maintainAccountChannelDelivery: ['privacyOperations'],
						lockActiveFoundationRoot: ['exchangeAuthority'],
						issueCapturedExchange: ['capture'],
						removeExchangeDependencies: ['privacyOperations']
					};
					if (name in exchangeCallers)
						assert.ok(
							exchangeCallers[name].some(
								(module) => file === 'src/lib/server/foundation/' + module + '.ts'
							),
							file
						);
					if (name === 'withFoundationAccess')
						assert.ok(
							['subjects', 'evidence', 'drafts'].some(
								(name) => file === 'src/lib/server/foundation/' + name + '.ts'
							),
							file
						);
					if (node.moduleSpecifier.text.endsWith('privacyOperations'))
						assert.fail('Offline privacy service must have no application caller: ' + file);
					if (name === 'admitDevExchangeSignup')
						assert.ok(
							[
								'src/routes/auth/register/+page.server.ts',
								'src/routes/auth/google/callback/+server.ts'
							].includes(file),
							file
						);
					if (name === 'createDevPilotAccount')
						assert.equal(file, 'src/routes/settings/users/+page.server.ts');
					if (name === 'withPublicCapture')
						assert.equal(file, 'src/lib/server/foundation/capture.ts');
					if (name === 'resolvePreparedFoundationAccess')
						assert.fail('Internal prepared resolver must have no shipped caller: ' + file);
				}
			}
			ts.forEachChild(node, walk);
		}
		walk(tree);
		// No namespace/dynamic import may disguise access to the internal capability module.
		if (
			/import\s*\(.*privacyOperations|(?:import|export)\s+.*from\s+['"][^'"]*privacyOperations/.test(
				text
			)
		)
			assert.fail('Offline privacy service must have no application caller: ' + file);
		if (
			/import\s*\*.*(?:foundation\/internal|['"]\.\/internal)/.test(text) ||
			/import\s*\(.*foundation\/internal/.test(text)
		)
			assert.fail(file);
	}
});
