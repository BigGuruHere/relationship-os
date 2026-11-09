// Offline operator service. The shell/database role is the trust boundary. Keep web routes
// out of this module, and never use an authenticated browser as an operator credential.
import { prisma, type AppTransactionClient } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { FoundationDenied, runFoundationBoundary } from './internal';
import { lockFoundationAccount } from './provisioning';
import { lockExchanges, exchangeScope } from './exchangeAuthority';
import { maintainAccountChannelDelivery } from './accountChannels';
import { removeExchangeDependencies } from './exchangePrivacy';

type Root = { ownerUserId: string; vaultId: string };
const MAX_REVIEW_ROWS = 500;
const MAX_REVIEW_BYTES = 12 * 1024 * 1024;

async function withPrivacyRoot<T>(
	ownerUserId: string,
	operation: (
		tx: AppTransactionClient,
		root: Root,
		lifecycle: { enrollment: string; vault: string; epoch: number }
	) => Promise<T>
) {
	return runFoundationBoundary({ ownerUserId, mode: 'PRIVACY_CONTROL' }, () =>
		prisma.$transaction(
			async (tx) => {
				// Match request writers and public capture. An in-flight writer either commits
				// before this lock or sees the new lifecycle before it can proceed.
				await lockExchanges(tx);
				await lockFoundationAccount(tx, ownerUserId);
				const enrollment = await tx.foundationEnrollment.findFirst({
					where: { userId: ownerUserId },
					select: { state: true, epoch: true }
				});
				const vault = await tx.foundationVault.findFirst({
					where: { ownerUserId, kind: 'PRIVATE_HOME' },
					select: { id: true }
				});
				if (!enrollment || !vault) throw new FoundationDenied();
				await tx.$queryRaw`SELECT "id" FROM "FoundationVault" WHERE "id" = ${vault.id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
				const current = await tx.foundationVault.findFirst({
					where: { id: vault.id },
					select: { state: true }
				});
				if (!current) throw new FoundationDenied();
				return operation(
					tx,
					{ ownerUserId, vaultId: vault.id },
					{
						enrollment: enrollment.state,
						vault: current.state,
						epoch: enrollment.epoch
					}
				);
			},
			{ isolationLevel: 'ReadCommitted', timeout: 20000 }
		)
	);
}

export function inspectFoundationPrivacy(ownerUserId: string) {
	return withPrivacyRoot(ownerUserId, (tx, root, lifecycle) =>
		runFoundationBoundary({ ...root, mode: 'PRIVACY_REVIEW' }, async () => ({
			...lifecycle,
			subjects: await tx.foundationSubject.count(),
			sources: await tx.foundationSource.count(),
			statements: await tx.foundationStatement.count()
		}))
	);
}

export function suspendFoundationPrivacy(ownerUserId: string) {
	return withPrivacyRoot(ownerUserId, async (tx, root, lifecycle) => {
		await removeExchangeDependencies(tx, ownerUserId, false);
        await maintainAccountChannelDelivery(tx,ownerUserId,true);
		if (lifecycle.vault === 'DELETING') throw new FoundationDenied();
		const transition = lifecycle.enrollment !== 'SUSPENDED';
		if (transition) {
			await tx.foundationEnrollment.updateMany({
				where: { userId: ownerUserId },
				data: { state: 'SUSPENDED', epoch: { increment: 1 } }
			});
		}
		if (lifecycle.vault !== 'LOCKED') {
			await tx.foundationVault.updateMany({
				where: { id: root.vaultId },
				data: { state: 'LOCKED' }
			});
		}
		return {
			enrollment: 'SUSPENDED',
			vault: 'LOCKED',
			epoch: lifecycle.epoch + Number(transition)
		};
	});
}

// Fixed reviewed fields only. Exclude database credentials, idempotency hashes and raw
// internal provenance. The result may contain others' information and is for case review.
export function reviewFoundationPrivacy(ownerUserId: string) {
	return withPrivacyRoot(ownerUserId, (tx, root, lifecycle) =>
		runFoundationBoundary({ ...root, mode: 'PRIVACY_REVIEW' }, async () => {
			let remainingBytes = MAX_REVIEW_BYTES;
			const read = (table: string, field: string, row: { id: string }, value: string | null) => {
				if (value === null) return null;
				remainingBytes -= Buffer.byteLength(value);
				if (remainingBytes < 0) throw new Error('Privacy review exceeds pilot limit.');
				return decrypt(
					value,
					`foundation:v1:${table}:${field}:${root.ownerUserId}:${root.vaultId}:${row.id}`
				);
			};
			const page = { take: MAX_REVIEW_ROWS + 1, orderBy: { id: 'asc' as const } };
			function bounded<T>(rows: T[]) {
				if (rows.length > MAX_REVIEW_ROWS) throw new Error('Privacy review exceeds pilot limit.');
				return rows;
			}
			const subjects = bounded(
				await tx.foundationSubject.findMany({
					...page,
					select: {
						id: true,
						kind: true,
						state: true,
						displayNameEnc: true,
						detailsEnc: true,
						selfUserId: true
					}
				})
			).map(({ displayNameEnc, detailsEnc, selfUserId, ...row }) => {
				const details = JSON.parse(
					read('FoundationSubject', 'detailsEnc', row, detailsEnc) ?? 'null'
				);
				return {
					...row,
					isSelf: Boolean(selfUserId),
					name: read('FoundationSubject', 'displayNameEnc', row, displayNameEnc),
					email: typeof details?.email === 'string' ? details.email : null,
					phone: typeof details?.phone === 'string' ? details.phone : null,
					submittedAt:
						typeof details?.origin?.submittedAt === 'string' ? details.origin.submittedAt : null
				};
			});
			const sources = bounded(
				await tx.foundationSource.findMany({
					...page,
					select: { id: true, kind: true, state: true, createdAt: true }
				})
			);
			const sourceVersions = bounded(
				await tx.foundationSourceVersion.findMany({
					...page,
					select: {
						id: true,
						sourceId: true,
						version: true,
						previousVersionId: true,
						createdAt: true,
						occurredAt: true,
						recordedByKind: true,
						processingAdmission: true,
						payloadEnc: true,
						provenanceEnc: true
					}
				})
			).map(({ payloadEnc, provenanceEnc, ...row }) => {
				const provenance = JSON.parse(
					read('FoundationSourceVersion', 'provenanceEnc', row, provenanceEnc) ?? 'null'
				);
				return {
					...row,
					text: read('FoundationSourceVersion', 'payloadEnc', row, payloadEnc),
					reviewedSummary:
						typeof provenance?.reviewedSummary === 'string' ? provenance.reviewedSummary : null
				};
			});
			const segments = bounded(
				await tx.foundationEvidenceSegment.findMany({
					...page,
					select: { id: true, sourceVersionId: true, speakerSubjectId: true, excerptEnc: true }
				})
			).map(({ excerptEnc, ...row }) => ({
				...row,
				excerpt: read('FoundationEvidenceSegment', 'excerptEnc', row, excerptEnc)
			}));
			const evidenceSubjects = bounded(
				await tx.foundationEvidenceSubject.findMany({
					...page,
					select: { segmentId: true, subjectId: true }
				})
			);
			const statements = bounded(
				await tx.foundationStatement.findMany({
					...page,
					select: { id: true, perspectiveId: true, state: true }
				})
			);
			const statementVersions = bounded(
				await tx.foundationStatementVersion.findMany({
					...page,
					select: {
						id: true,
						statementId: true,
						version: true,
						previousVersionId: true,
						textEnc: true,
						mode: true,
						confidence: true,
						validFrom: true,
						validUntil: true
					}
				})
			).map(({ textEnc, ...row }) => ({
				...row,
				text: read('FoundationStatementVersion', 'textEnc', row, textEnc)
			}));
			const statementSubjects = bounded(
				await tx.foundationStatementSubject.findMany({
					...page,
					select: { statementVersionId: true, subjectId: true }
				})
			);
			const support = bounded(
				await tx.foundationSupport.findMany({
					...page,
					select: { outputVersionId: true, inputVersionId: true, segmentId: true, relation: true }
				})
			);
			const perspectives = bounded(
				await tx.foundationPerspective.findMany({
					...page,
					select: { id: true, kind: true, holderSubjectId: true, descriptionEnc: true }
				})
			).map(({ descriptionEnc, ...row }) => ({
				...row,
				description: read('FoundationPerspective', 'descriptionEnc', row, descriptionEnc)
			}));
			const memberships = bounded(
				await tx.foundationMembership.findMany({
					...page,
					select: {
						id: true,
						containerSubjectId: true,
						personSubjectId: true,
						joinedAt: true,
						leftAt: true,
						roleEnc: true
					}
				})
			).map(({ roleEnc, ...row }) => ({
				...row,
				role: read('FoundationMembership', 'roleEnc', row, roleEnc)
			}));
			const contexts = bounded(
				await tx.foundationContext.findMany({
					...page,
					select: { id: true, state: true, labelEnc: true, descriptionEnc: true }
				})
			).map(({ labelEnc, descriptionEnc, ...row }) => ({
				...row,
				label: read('FoundationContext', 'labelEnc', row, labelEnc),
				description: read('FoundationContext', 'descriptionEnc', row, descriptionEnc)
			}));
			const contextAssociations = bounded(
				await tx.foundationContextAssociation.findMany({
					...page,
					select: { contextId: true, segmentId: true, statementVersionId: true }
				})
			);
			const exchanges = bounded(
				await tx.foundationExchange.findMany({
					...page,
					select: {
						id: true,
						profileId: true,
						subjectId: true,
						status: true,
						createdAt: true,
						expiresAt: true,
						snapshotEnc: true
					}
				})
			).map(({ snapshotEnc, ...row }) => ({
				...row,
				sharedCard: JSON.parse(
					read('FoundationExchange', 'snapshotEnc', row, snapshotEnc) ?? 'null'
				)
			}));
			const associations = bounded(
				await tx.foundationAccountAssociation.findMany({
					...page,
					select: {
						id: true,
						subjectId: true,
						accountId: true,
						channel: true,
						verifiedAt: true,
						state: true
					}
				})
			);
			const challenges = bounded(
				await tx.foundationExchangeChallenge.findMany({
					...page,
					select: {
						id: true,
						exchangeId: true,
						channel: true,
						status: true,
						createdAt: true,
						expiresAt: true,
						verifiedAt: true
					}
				})
			);
			const deliveries = bounded(
				await tx.foundationExchangeDispatch.findMany({
					...page,
					select: { id: true, challengeId: true, status: true, createdAt: true, expiresAt: true }
				})
			);

			return {
				exchanges,
				associations,
				challenges,
				deliveries,
				version: 1,
				scope: 'FOUNDATION_REVIEW',
				account: ownerUserId,
				lifecycle,
				subjects,
				sources,
				sourceVersions,
				segments,
				evidenceSubjects,
				statements,
				statementVersions,
				statementSubjects,
				support,
				perspectives,
				memberships,
				contexts,
				contextAssociations
			};
		})
	);
}

export function eraseFoundationPrivacy(ownerUserId: string) {
	return withPrivacyRoot(ownerUserId, (tx, root, lifecycle) => {
		// Suspension is a separate committed step. Failure here leaves the owner isolated.
		if (lifecycle.enrollment !== 'SUSPENDED' || lifecycle.vault !== 'LOCKED')
			throw new FoundationDenied();
		return removeExchangeDependencies(tx, ownerUserId, true).then((exchangeRows) =>
			runFoundationBoundary({ ...root, mode: 'PRIVACY_ERASE' }, async () => {
				await tx.foundationStatement.updateMany({ data: { state: 'DELETING' } });
				// Remove links before parents and all versions in each lineage in one SQL
				// statement. Composite custody FKs prevent touching a second account.
				let erasedRows = exchangeRows + (await tx.foundationContextAssociation.deleteMany()).count;
				erasedRows += (await tx.foundationSupport.deleteMany()).count;
				erasedRows += (await tx.foundationStatementSubject.deleteMany()).count;
				erasedRows += (await tx.foundationStatementVersion.deleteMany()).count;
				erasedRows += (await tx.foundationStatement.deleteMany()).count;
				erasedRows += (await tx.foundationEvidenceSubject.deleteMany()).count;
				erasedRows += (await tx.foundationEvidenceSegment.deleteMany()).count;
				erasedRows += (await tx.foundationSourceVersion.deleteMany()).count;
				erasedRows += (await tx.foundationSource.deleteMany()).count;
				erasedRows += (await tx.foundationMembership.deleteMany()).count;
				erasedRows += (await tx.foundationPerspective.deleteMany()).count;
				erasedRows += (await tx.foundationSubject.deleteMany()).count;
				erasedRows += (await tx.foundationContext.deleteMany()).count;
				// Keep the empty roots as a routing tombstone until reviewed account closure.
				return { erasedRows, enrollment: 'SUSPENDED', vault: 'LOCKED' };
			})
		);
	});
}

// Offline maintenance uses the same target and confirmation checks as other privacy commands.
// It clears dormant encrypted outbox payloads even when nobody retries an expired claim.
export function expireFoundationExchanges(ownerUserId: string) {
	return withPrivacyRoot(ownerUserId, (tx, root) =>
		exchangeScope(root, async () => {
			const now = new Date();
            await maintainAccountChannelDelivery(tx,ownerUserId);
			const deliveries = await tx.foundationExchangeDispatch.updateMany({
				where: { expiresAt: { lte: now }, status: { in: ['QUEUED', 'FAILED', 'SENDING'] } },
				data: { status: 'EXPIRED', payloadEnc: null, leaseToken: null, leaseUntil: null }
			});
			const challenges = await tx.foundationExchangeChallenge.updateMany({
				where: { expiresAt: { lte: now }, status: 'PENDING' },
				data: { status: 'EXPIRED' }
			});
			const exchanges = await tx.foundationExchange.updateMany({
				where: { expiresAt: { lte: now }, status: { in: ['PENDING', 'BOUND'] } },
				data: { status: 'EXPIRED' }
			});
			await runFoundationBoundary({ ownerUserId, mode: 'EXCHANGE_BUDGET' }, () =>
				tx.foundationClaimBudget.deleteMany({ where: { expiresAt: { lte: now } } })
			);
			return {
				deliveries: deliveries.count,
				challenges: challenges.count,
				exchanges: exchanges.count
			};
		})
	);
}
