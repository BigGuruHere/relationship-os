// src/lib/server/core/contextSpace.ts
// PURPOSE: Request-scoped custody context for Stage 8.6 ContextSpace isolation.
// SECURITY: userId is ownership; contextSpaceId is the knowledge/workspace custody boundary.

import { AsyncLocalStorage } from 'node:async_hooks';

export type WorkspaceCustodyContext = {
  userId: string;
  contextSpaceId: string;
};

const globalForCustody = globalThis as unknown as {
  __relishCustodyStorage?: AsyncLocalStorage<WorkspaceCustodyContext>;
};

const storage = globalForCustody.__relishCustodyStorage ?? new AsyncLocalStorage<WorkspaceCustodyContext>();
if (!globalForCustody.__relishCustodyStorage) globalForCustody.__relishCustodyStorage = storage;

export const DEFAULT_CONTEXT_SENTINEL = '00000000-0000-0000-0000-000000000000';

export function defaultContextSpaceIdForUser(userId: string) {
  const clean = String(userId ?? '').trim();
  if (!clean) throw new Error('Missing user id for default ContextSpace.');
  // IT: Stage 8.6 deliberately seeds the default ContextSpace with User.id.
  return clean;
}

export async function runWithWorkspaceCustody<T>(
  context: WorkspaceCustodyContext,
  fn: () => T | PromiseLike<T>
): Promise<Awaited<T>> {
  if (!context.userId || !context.contextSpaceId) throw new Error('Workspace custody context requires userId and contextSpaceId.');

  // SECURITY: PrismaPromise is lazy. If a callback returns one directly, merely returning it from
  // AsyncLocalStorage.run() can let the custody scope end before Prisma actually executes the query.
  // Await the callback result inside the ALS boundary so lazy thenables execute with custody intact.
  return storage.run(context, async () => await fn()) as Promise<Awaited<T>>;
}

export function currentWorkspaceCustody() {
  return storage.getStore() ?? null;
}

// IT: Resolve the custody space for an owner when code must use raw SQL or a shared-model relation filter.
// Current authenticated owner inherits the active space. Cross-owner callers temporarily resolve to the
// other owner's deterministic default space while Stage 8.6 still has one real Workspace per user.
// TODO 8.7: replace this cross-owner compatibility assumption with an invitation/grant model once scoped.
export function contextSpaceIdForOwner(userId: string, request = currentWorkspaceCustody()) {
  const ownerUserId = String(userId ?? '').trim();
  if (!ownerUserId) throw new Error('Missing user id for ContextSpace resolution.');
  return request?.userId === ownerUserId ? request.contextSpaceId : defaultContextSpaceIdForUser(ownerUserId);
}

export const CONTEXT_SCOPED_MODELS = new Set([
  'Tag', 'CompanyTag', 'LeadSource',
  'Contact', 'Interaction', 'Reminder', 'ContactRelationship',
  'Deal', 'DealNote', 'DealContact', 'DealContactNote',
  'Company', 'CompanyNote', 'CompanyContact', 'CompanyContactNote', 'DealCompany', 'CompanyRelationship',
  'Objective', 'KnowledgeClaim', 'KnowledgeEvidence',
  'Want', 'WantNote', 'Offer', 'OfferNote',
  'Introduction', 'IntroductionParticipant', 'Outcome',
  'MarketLead', 'MarketLeadNote',
  'Project', 'ProjectWorkstream', 'ProjectDeal', 'ProjectNote', 'Task',
  'ResearchCandidate', 'ResearchSource', 'ContactEnrichment', 'OpportunityScore', 'OpportunityScoreFactor',
  'AgentRun', 'AgentToolCall', 'ModelInvocation', 'AgentArtifact', 'ApprovalRequest'
]);

// IT: These tables inherit custody from a context-scoped parent rather than carrying owner/context columns themselves.
// SECURITY: Reads are narrowed through the parent relation so same-owner/different-context ids cannot be used as a side door.
export const INHERITED_CONTEXT_SCOPED_MODELS = new Set(['AgentStep', 'AgentRunEntity', 'ContactTag', 'TagAlias', 'InteractionEmbedding']);


function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ownerAndContext(record: Record<string, any>, request: WorkspaceCustodyContext | null) {
  const explicitUserId = typeof record.userId === 'string' && record.userId.trim() ? record.userId.trim() : null;
  const ownerUserId = explicitUserId ?? request?.userId ?? null;
  const explicitContext = typeof record.contextSpaceId === 'string' && record.contextSpaceId.trim()
    ? record.contextSpaceId.trim()
    : null;

  // IT: If the explicit owner is the active request owner, inherit the active ContextSpace.
  // An explicit different owner means that other owner's default ContextSpace, preserving reciprocal/public flows safely.
  const implicitContext = explicitUserId
    ? (request?.userId === explicitUserId ? request.contextSpaceId : defaultContextSpaceIdForUser(explicitUserId))
    : request?.contextSpaceId ?? null;

  // SECURITY: A request may only operate in the ContextSpace it explicitly entered.
  // Future context switching changes the request custody context first rather than smuggling another space into a query.
  if (request && explicitContext && explicitContext !== implicitContext) {
    throw new Error('Explicit ContextSpace does not match the active custody context.');
  }

  const contextSpaceId = explicitContext ?? implicitContext;
  return { ownerUserId, contextSpaceId };
}

function scopeWhere(where: unknown, request: WorkspaceCustodyContext | null) {
  const next = isObject(where) ? { ...where } : {};
  const { ownerUserId, contextSpaceId } = ownerAndContext(next, request);
  if (!ownerUserId || !contextSpaceId) return where;
  if (!('userId' in next)) next.userId = ownerUserId;
  if (!('contextSpaceId' in next)) next.contextSpaceId = contextSpaceId;
  return next;
}

function scopeInheritedWhere(model: string, where: unknown, request: WorkspaceCustodyContext | null) {
  if (!request) return where;
  const next = isObject(where) ? { ...where } : {};
  const custody = { userId: request.userId, contextSpaceId: request.contextSpaceId };

  if (model === 'AgentStep' || model === 'AgentRunEntity') {
    const existingRun = isObject(next.run) ? next.run : {};
    next.run = { ...existingRun, ...custody };
    return next;
  }

  if (model === 'ContactTag') {
    const existingContact = isObject(next.contact) ? next.contact : {};
    const existingTag = isObject(next.tag) ? next.tag : {};
    next.contact = { ...existingContact, ...custody };
    next.tag = { ...existingTag, ...custody };
    return next;
  }

  if (model === 'TagAlias') {
    const existingTag = isObject(next.tag) ? next.tag : {};
    next.tag = { ...existingTag, ...custody };
    return next;
  }

  if (model === 'InteractionEmbedding') {
    const existingInteraction = isObject(next.interaction) ? next.interaction : {};
    next.interaction = { ...existingInteraction, ...custody };
    return next;
  }

  return next;
}

function scopeData(data: unknown, request: WorkspaceCustodyContext | null): unknown {
  if (Array.isArray(data)) return data.map((row) => scopeData(row, request));
  if (!isObject(data)) return data;
  const next = { ...data };
  const { ownerUserId, contextSpaceId } = ownerAndContext(next, request);
  if (!ownerUserId || !contextSpaceId) return data;
  if (!('userId' in next)) next.userId = ownerUserId;
  if (!('contextSpaceId' in next)) next.contextSpaceId = contextSpaceId;
  return next;
}

const WHERE_SCOPED_OPERATIONS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'
]);

function hasExplicitOwnerInWhere(where: unknown) {
  return isObject(where) && typeof where.userId === 'string' && where.userId.trim().length > 0;
}

function explicitCustodyPair(record: unknown) {
  if (!isObject(record)) return null;
  const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
  const contextSpaceId = typeof record.contextSpaceId === 'string' ? record.contextSpaceId.trim() : '';
  return userId && contextSpaceId ? { userId, contextSpaceId } : null;
}

function everyCreateRowHasExplicitCustody(data: unknown) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.length > 0 && rows.every((row) =>
    isObject(row)
    && typeof row.userId === 'string' && row.userId.trim().length > 0
    && typeof row.contextSpaceId === 'string' && row.contextSpaceId.trim().length > 0
  );
}

function assertFailClosedScope(model: string, operation: string, args: any, directlyScoped: boolean, request: WorkspaceCustodyContext | null) {
  if (request) return;

  // SECURITY: Inherited-custody tables have no independent owner column. Outside a request
  // they must be entered through an explicit runWithWorkspaceCustody() boundary.
  if (!directlyScoped) {
    throw new Error(`Context-scoped Prisma ${model}.${operation} requires an active workspace custody context.`);
  }

  // SECURITY: Outside active custody, inserts must name both owner and ContextSpace.
  // Do not silently infer the owner's default space, because that would hide a missing custody field.
  if (operation === 'create' || operation === 'createMany') {
    if (everyCreateRowHasExplicitCustody(args.data)) return;
    throw new Error(`Context-scoped Prisma ${model}.${operation} requires active workspace custody or explicit userId and contextSpaceId on every created row.`);
  }

  // SECURITY: Upsert can create a row, so outside custody both the lookup and create branch
  // must name the exact custody context rather than falling back to the owner's default space.
  if (operation === 'upsert') {
    const whereCustody = explicitCustodyPair(args.where);
    const createCustody = explicitCustodyPair(args.create);
    if (whereCustody && createCustody
      && whereCustody.userId === createCustody.userId
      && whereCustody.contextSpaceId === createCustody.contextSpaceId) return;
    throw new Error(`Context-scoped Prisma ${model}.upsert requires matching explicit userId and contextSpaceId in both where and create.`);
  }

  // SECURITY: Reads, updates and deletes outside a request must name the owner in the top-level
  // where clause. An entity id by itself is never a custody boundary.
  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    if (hasExplicitOwnerInWhere(args.where)) return;
    throw new Error(`Context-scoped Prisma ${model}.${operation} requires active workspace custody or an explicit userId in the where clause.`);
  }

  // SECURITY: Unknown operations on a context-scoped model fail closed rather than bypassing custody.
  throw new Error(`Context-scoped Prisma ${model}.${operation} requires an active workspace custody context.`);
}

// IT: Pure helper so Stage 8.6 tests can prove same-owner/different-context scoping without source-text assertions.
export function scopeContextPrismaArgs(model: string | undefined, operation: string, args: any, request = currentWorkspaceCustody()) {
  if (!model || !isObject(args)) return args;
  const directlyScoped = CONTEXT_SCOPED_MODELS.has(model);
  const inheritedScoped = INHERITED_CONTEXT_SCOPED_MODELS.has(model);
  if (!directlyScoped && !inheritedScoped) return args;

  assertFailClosedScope(model, operation, args, directlyScoped, request);

  const next = { ...args };

  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    next.where = directlyScoped
      ? scopeWhere(next.where, request)
      : scopeInheritedWhere(model, next.where, request);
  }

  if (directlyScoped) {
    if (operation === 'create' || operation === 'createMany') {
      next.data = scopeData(next.data, request);
    } else if (operation === 'upsert') {
      next.create = scopeData(next.create, request);
    }
  }

  return next;
}
