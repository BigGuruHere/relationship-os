// Preserve the exact old labels alongside review hints. This is not a data migration.
import { z } from 'zod';
import { contentKinds } from './contracts';

export const legacyTaxonomySchema = z.strictObject({
	kind: z.enum(contentKinds),
	authority: z.enum([
		'LEGACY_UNSPECIFIED',
		'SELF_DECLARED',
		'THIRD_PARTY_REPORTED',
		'WORKSPACE_RECORDED',
		'PUBLIC_SOURCE',
		'INFERRED',
		'SYSTEM_DERIVED'
	]),
	sourceType: z.enum([
		'MANUAL',
		'INTERACTION',
		'PUBLIC_RESEARCH',
		'AGENT',
		'IMPORT',
		'SYSTEM',
		'OTHER'
	]),
	perspective: z.enum([
		'UNSPECIFIED_LEGACY',
		'CONTACT_REPORTED',
		'OWNER_OBSERVATION',
		'RELATIONSHIP_PERSPECTIVE'
	]),
	status: z.enum(['ACTIVE', 'SUPERSEDED', 'REJECTED']),
	confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
	certainty: z.enum(['DIRECT', 'REPORTED', 'INFERRED', 'UNCERTAIN']).nullable(),
	actor: z.enum(['OPERATOR', 'DORIAN', 'PARTICIPANT']).nullable(),
	decision: z.enum(['CONFIRMED', 'DEFERRED', 'REJECTED']).nullable()
});
export type LegacyTaxonomy = z.infer<typeof legacyTaxonomySchema>;

export function describeLegacyTaxonomy(raw: unknown) {
	const legacy = legacyTaxonomySchema.parse(raw);
	// DIRECT can describe a directly stated opinion. SELF_DECLARED lacks a stable speaker ID.
	// Neither an AGENT capture source nor DORIAN actor proves the proposition was AI-inferred.
	const basisHint =
		legacy.certainty === 'INFERRED' || legacy.authority === 'INFERRED'
			? 'INFERENCE_REQUIRES_ATTRIBUTION'
			: legacy.certainty === 'REPORTED' || legacy.authority === 'THIRD_PARTY_REPORTED'
				? 'REPORTED_ASSERTION'
				: legacy.certainty === 'DIRECT' || legacy.authority === 'SELF_DECLARED'
					? 'DIRECT_ACCOUNT_OR_EXPRESSED_OPINION'
					: 'UNRESOLVED';
	return { legacy, contentKind: legacy.kind, basisHint, requiresAttributionReview: true as const };
}
