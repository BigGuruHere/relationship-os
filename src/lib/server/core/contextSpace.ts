// src/lib/server/core/contextSpace.ts
// PURPOSE: Request-scoped custody context and explicit cross-custody transitions.
// SECURITY: userId is ownership; contextSpaceId is the knowledge/workspace custody boundary.

import { AsyncLocalStorage } from 'node:async_hooks';

export type WorkspaceCustodyContext = {
  userId: string;
  contextSpaceId: string;
};

export type CrossCustodyReason =
  | 'PUBLIC_PROFILE_CONNECTION'
  | 'LEAD_CLAIM'
  | 'PUBLIC_LEAD_CAPTURE';

type CrossCustodyTransition = {
  sourceUserId: string | null;
  targetUserId: string;
  targetContextSpaceId: string;
  reason: CrossCustodyReason;
};

const globalForCustody = globalThis as unknown as {
  __relishCustodyStorage?: AsyncLocalStorage<WorkspaceCustodyContext>;
  __relishCrossCustodyTransitionStorage?: AsyncLocalStorage<CrossCustodyTransition>;
};

const storage = globalForCustody.__relishCustodyStorage ?? new AsyncLocalStorage<WorkspaceCustodyContext>();
if (!globalForCustody.__relishCustodyStorage) globalForCustody.__relishCustodyStorage = storage;

const transitionStorage = globalForCustody.__relishCrossCustodyTransitionStorage ?? new AsyncLocalStorage<CrossCustodyTransition>();
if (!globalForCustody.__relishCrossCustodyTransitionStorage) {
  globalForCustody.__relishCrossCustodyTransitionStorage = transitionStorage;
}

export const DEFAULT_CONTEXT_SENTINEL = '00000000-0000-0000-0000-000000000000';

export function defaultContextSpaceIdForUser(userId: string) {
  const clean = String(userId ?? '').trim();
  if (!clean) throw new Error('Missing user id for default ContextSpace.');
  // IT: Stage 8.6 seeded each existing default Workspace ContextSpace with User.id.
  return clean;
}

function cleanCustodyContext(context: WorkspaceCustodyContext): WorkspaceCustodyContext {
  const userId = String(context?.userId ?? '').trim();
  const contextSpaceId = String(context?.contextSpaceId ?? '').trim();
  if (!userId || !contextSpaceId) throw new Error('Workspace custody context requires userId and contextSpaceId.');
  if (contextSpaceId === DEFAULT_CONTEXT_SENTINEL) throw new Error('Workspace custody context cannot use the ContextSpace sentinel.');
  return { userId, contextSpaceId };
}

function transitionMatches(
  transition: CrossCustodyTransition | undefined,
  source: WorkspaceCustodyContext,
  target: WorkspaceCustodyContext
) {
  return !!transition
    && transition.sourceUserId === source.userId
    && transition.targetUserId === target.userId
    && transition.targetContextSpaceId === target.contextSpaceId;
}

export async function runWithWorkspaceCustody<T>(
  context: WorkspaceCustodyContext,
  fn: () => T | PromiseLike<T>
): Promise<Awaited<T>> {
  const target = cleanCustodyContext(context);
  const current = storage.getStore() ?? null;

  // SECURITY: Once a request/job is inside one owner's custody, code cannot silently impersonate
  // another owner by nesting runWithWorkspaceCustody(). Stage 8.7 requires a named cross-custody
  // transition around the exact legacy flow that needs to cross the boundary.
  if (current && current.userId !== target.userId) {
    const transition = transitionStorage.getStore();
    if (!transitionMatches(transition, current, target)) {
      throw new Error('Cross-owner workspace custody transition requires an explicit Stage 8.7 cross-custody boundary.');
    }
  }

  // SECURITY: PrismaPromise is lazy. Await inside AsyncLocalStorage.run() so custody stays active
  // until the Prisma operation actually executes.
  return storage.run(target, async () => await fn()) as Promise<Awaited<T>>;
}

export function currentWorkspaceCustody() {
  return storage.getStore() ?? null;
}

export function currentCrossCustodyTransition() {
  return transitionStorage.getStore() ?? null;
}

function cleanTransitionTarget(targetUserId: string, targetContextSpaceId: string) {
  const userId = String(targetUserId ?? '').trim();
  const contextSpaceId = String(targetContextSpaceId ?? '').trim();
  if (!userId || !contextSpaceId) throw new Error('Cross-custody transition requires an explicit target user and ContextSpace.');
  if (contextSpaceId === DEFAULT_CONTEXT_SENTINEL) throw new Error('Cross-custody transition cannot target the ContextSpace sentinel.');
  return { userId, contextSpaceId };
}

/**
 * SECURITY: Enter another owner's custody only for a named, existing system-mediated workflow.
 * This is execution authority, not user consent and not disclosure permission.
 */
export async function runWithCrossOwnerWorkspaceCustody<T>(
  params: {
    sourceUserId: string;
    targetUserId: string;
    targetContextSpaceId: string;
    reason: CrossCustodyReason;
  },
  fn: () => T | PromiseLike<T>
): Promise<Awaited<T>> {
  const source = currentWorkspaceCustody();
  const sourceUserId = String(params.sourceUserId ?? '').trim();
  const target = cleanTransitionTarget(params.targetUserId, params.targetContextSpaceId);

  if (!source) throw new Error('Cross-owner custody transition requires an active source workspace custody context.');
  if (!sourceUserId || source.userId !== sourceUserId) {
    throw new Error('Cross-owner custody transition source does not match the active workspace owner.');
  }
  if (source.userId === target.userId) {
    throw new Error('Cross-owner custody transition requires a different target owner.');
  }

  const transition: CrossCustodyTransition = {
    sourceUserId,
    targetUserId: target.userId,
    targetContextSpaceId: target.contextSpaceId,
    reason: params.reason
  };

  return transitionStorage.run(transition, () =>
    runWithWorkspaceCustody({ userId: target.userId, contextSpaceId: target.contextSpaceId }, fn)
  );
}

/**
 * SECURITY: Public/unauthenticated ingress may enter exactly one explicitly resolved destination
 * custody. It cannot be called from inside an authenticated workspace and does not create any
 * standing sharing permission.
 */
export async function runWithExternalWorkspaceCustody<T>(
  params: {
    targetUserId: string;
    targetContextSpaceId: string;
    reason: Extract<CrossCustodyReason, 'PUBLIC_LEAD_CAPTURE'>;
  },
  fn: () => T | PromiseLike<T>
): Promise<Awaited<T>> {
  if (currentWorkspaceCustody()) {
    throw new Error('External custody ingress cannot run inside an active workspace custody context.');
  }
  const target = cleanTransitionTarget(params.targetUserId, params.targetContextSpaceId);
  const transition: CrossCustodyTransition = {
    sourceUserId: null,
    targetUserId: target.userId,
    targetContextSpaceId: target.contextSpaceId,
    reason: params.reason
  };

  return transitionStorage.run(transition, () =>
    runWithWorkspaceCustody({ userId: target.userId, contextSpaceId: target.contextSpaceId }, fn)
  );
}

/**
 * IT: Current external/cross-owner flows are only safe while an owner has exactly one ContextSpace.
 * Fail closed as soon as a second space exists rather than guessing which space should receive data.
 */
export async function requireSingleContextSpaceIdForOwner(
  client: { contextSpace: { findMany(args: any): Promise<Array<{ id: string }>> } },
  userId: string
) {
  const ownerUserId = String(userId ?? '').trim();
  if (!ownerUserId) throw new Error('Missing user id for ContextSpace resolution.');
  const spaces = await client.contextSpace.findMany({
    where: { ownerUserId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 2
  });
  if (spaces.length !== 1) {
    throw new Error(`Owner ${ownerUserId} must have exactly one ContextSpace for this Stage 8.7 compatibility flow; found ${spaces.length}.`);
  }
  return spaces[0].id;
}

// IT: Resolve custody for ordinary same-owner code and non-request compatibility scripts.
// SECURITY: An active workspace may never resolve another owner's ContextSpace implicitly.
export function contextSpaceIdForOwner(userId: string, request = currentWorkspaceCustody()) {
  const ownerUserId = String(userId ?? '').trim();
  if (!ownerUserId) throw new Error('Missing user id for ContextSpace resolution.');
  if (request && request.userId !== ownerUserId) {
    throw new Error('Cross-owner ContextSpace resolution requires an explicit Stage 8.7 custody boundary.');
  }
  return request?.contextSpaceId ?? defaultContextSpaceIdForUser(ownerUserId);
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


// SECURITY: A named cross-custody transition is not broad target-workspace access. Each existing
// compatibility flow gets only the minimum contextual model/operations it requires.
const CROSS_CUSTODY_POLICIES: Record<CrossCustodyReason, { models: Record<string, Set<string>> }> = {
  PUBLIC_PROFILE_CONNECTION: {
    models: { Contact: new Set(['findFirst', 'create', 'update']) }
  },
  LEAD_CLAIM: {
    models: { Contact: new Set(['update']) }
  },
  PUBLIC_LEAD_CAPTURE: {
    models: { Contact: new Set(['findFirst', 'create']) }
  }
};

function hasNestedWriteObject(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasNestedWriteObject);
  if (!value || typeof value !== 'object') return false;

  // SECURITY: Cross-custody compatibility writes are deliberately flat. A plain object nested
  // inside data is how Prisma expresses relation writes such as { tags: { create: ... } }.
  // Date and other non-plain scalar objects are not treated as nested relation writes.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return true;
}

function assertFlatCrossCustodyWrite(model: string, operation: string, args: any) {
  if (model !== 'Contact' || (operation !== 'create' && operation !== 'update')) return;
  const data = isObject(args?.data) ? args.data : {};
  for (const [field, value] of Object.entries(data)) {
    if (hasNestedWriteObject(value)) {
      throw new Error(`Stage 8.7 cross-custody Contact.${operation} does not permit nested write data at ${field}.`);
    }
  }
}

function assertCrossCustodyOperationAllowed(model: string, operation: string, args: any, request: WorkspaceCustodyContext | null) {
  const transition = currentCrossCustodyTransition();
  if (!transition || !request) return;
  if (request.userId !== transition.targetUserId || request.contextSpaceId !== transition.targetContextSpaceId) return;

  const allowed = CROSS_CUSTODY_POLICIES[transition.reason]?.models?.[model];
  if (!allowed?.has(operation)) {
    throw new Error(`Stage 8.7 ${transition.reason} boundary does not permit ${model}.${operation}.`);
  }

  // SECURITY: Prisma's $allOperations extension runs only for the top-level operation. Do not let
  // a permitted Contact.create/update smuggle additional nested relation writes past the allowlist.
  assertFlatCrossCustodyWrite(model, operation, args);
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ownerAndContext(record: Record<string, any>, request: WorkspaceCustodyContext | null) {
  const explicitUserId = typeof record.userId === 'string' && record.userId.trim() ? record.userId.trim() : null;
  const ownerUserId = explicitUserId ?? request?.userId ?? null;
  const explicitContext = typeof record.contextSpaceId === 'string' && record.contextSpaceId.trim()
    ? record.contextSpaceId.trim()
    : null;

  // SECURITY: Under active custody, an explicit different owner is never converted to that owner's
  // default space. Existing cross-owner flows must enter the target custody through the named 8.7 boundary first.
  if (request && explicitUserId && explicitUserId !== request.userId) {
    throw new Error('Cross-owner context-scoped Prisma access requires an explicit Stage 8.7 custody boundary.');
  }

  const implicitContext = explicitUserId
    ? (request ? request.contextSpaceId : defaultContextSpaceIdForUser(explicitUserId))
    : request?.contextSpaceId ?? null;

  // SECURITY: A request may only operate in the ContextSpace it explicitly entered.
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
  if (operation === 'create' || operation === 'createMany') {
    if (everyCreateRowHasExplicitCustody(args.data)) return;
    throw new Error(`Context-scoped Prisma ${model}.${operation} requires active workspace custody or explicit userId and contextSpaceId on every created row.`);
  }

  // SECURITY: Upsert can create a row, so outside custody both lookup and create must name exact custody.
  if (operation === 'upsert') {
    const whereCustody = explicitCustodyPair(args.where);
    const createCustody = explicitCustodyPair(args.create);
    if (whereCustody && createCustody
      && whereCustody.userId === createCustody.userId
      && whereCustody.contextSpaceId === createCustody.contextSpaceId) return;
    throw new Error(`Context-scoped Prisma ${model}.upsert requires matching explicit userId and contextSpaceId in both where and create.`);
  }

  // SECURITY: Reads, updates and deletes outside a request must name the owner in the top-level where clause.
  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    if (hasExplicitOwnerInWhere(args.where)) return;
    throw new Error(`Context-scoped Prisma ${model}.${operation} requires active workspace custody or an explicit userId in the where clause.`);
  }

  throw new Error(`Context-scoped Prisma ${model}.${operation} requires an active workspace custody context.`);
}

// IT: Pure helper so behavioural tests can prove owner + ContextSpace scoping without source-text assertions.
export function scopeContextPrismaArgs(model: string | undefined, operation: string, args: any, request = currentWorkspaceCustody()) {
  if (!model || !isObject(args)) return args;
  const directlyScoped = CONTEXT_SCOPED_MODELS.has(model);
  const inheritedScoped = INHERITED_CONTEXT_SCOPED_MODELS.has(model);
  if (!directlyScoped && !inheritedScoped) return args;

  assertFailClosedScope(model, operation, args, directlyScoped, request);
  assertCrossCustodyOperationAllowed(model, operation, args, request);

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
