// Stage 8.20.4 — Relish owns Dorian deployment identity, not conversation context.
// AgentProviderBinding.contextSpaceId remains a legacy required FK. It is NOT an
// instruction to select or access that space for a Dorian conversation.
// An authenticated external operator may register ONLY the configured owner in this
// deployment. The control plane never gets direct database access or caller data.
import { prisma } from '$lib/db';
import { buildScopedIndexToken, encrypt, decrypt } from '$lib/crypto';
import { requiredEnv } from '$lib/server/config/requiredEnv';

const PROVIDER_AAD = 'agentProviderBinding.providerAgentId';
const PROVIDER_SCOPE = 'agent-provider:elevenlabs:agent-id';
const DOMAINS = new Set(['general', 'business', 'dating']);
export const validElevenLabsAgentId = (id: unknown): id is string =>
  typeof id === 'string' && (/^agent_[A-Za-z0-9_-]{8,180}$/.test(id) || /^[A-Za-z0-9_-]{16,180}$/.test(id));
export function expectedRelishDorianEnvironment() {
  const value = requiredEnv('RELISH_CONTROL_PLANE_ENV');
  if (!['local','dev','prod'].includes(value)) throw Error('Invalid Relish environment');
  return value as 'local'|'dev'|'prod';
}
export function expectedProviderEnvironment() {
  return expectedRelishDorianEnvironment() === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT';
}
function configuredOwner() { return requiredEnv('RELISH_DORIAN_DEPLOYMENT_OWNER_USER_ID'); }

async function scopedSpaces(ownerUserId: string) {
  const rows = await prisma.contextSpace.findMany({
    where: { ownerUserId, domainKey: { in: ['general','business','dating'] } },
    select: { id: true, domainKey: true }, orderBy: [{ domainKey:'asc' },{ createdAt:'asc' }]
  });
  // No personal names or private context are transferred to the control plane.
  return rows.filter(row => DOMAINS.has(row.domainKey));
}
// The schema's existing required FK is a registration anchor ONLY. Prefer the
// owner's General space; when unavailable use an existing owned domain space.
// This choice never grants caller access to the owner or selects call context.
function legacyAnchor(spaces: { id:string; domainKey:string }[]) {
  return spaces.find(space => space.domainKey === 'general') ?? spaces[0] ?? null;
}

export async function readDorianDeploymentRegistration() {
  const ownerUserId = configuredOwner();
  const env = expectedRelishDorianEnvironment();
  const [owner, spaces, definition] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true } }),
    scopedSpaces(ownerUserId),
    prisma.agentDefinition.findUnique({ where: { userId_key: { userId: ownerUserId, key: 'DORIAN' } }, select: { id: true, category: true, deploymentScope: true } })
  ]);
  if (!owner) return { environment: env, ready: false, reason: 'OWNER_NOT_FOUND', spaces: [], bindings:[],binding:null };
  const rows = definition ? await prisma.agentProviderBinding.findMany({
    where: { userId:ownerUserId, agentDefinitionId:definition.id, provider:'ELEVENLABS', isActive:true,
      validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}] },
    select:{id:true,environment:true,providerAgentIdEnc:true},take:1000
  }) : [];
  const bindings = rows.map(row=>({
    id:row.id,environment:row.environment,
    agentId:row.providerAgentIdEnc?decrypt(row.providerAgentIdEnc,PROVIDER_AAD):''
  }));
  const environmentMatches=rows.every(row=>row.environment===expectedProviderEnvironment());
  const compatible=!(definition && (definition.category!=='conversation'||definition.deploymentScope!=='external_voice'));
  const ready=Boolean(owner && legacyAnchor(spaces) && environmentMatches && compatible);
  return {environment:env,providerEnvironment:expectedProviderEnvironment(),
    runtimeContextSource:'PARTICIPANT_SESSION',ready,
    reason:!owner?'OWNER_NOT_FOUND':!environmentMatches?'BINDING_ENVIRONMENT_MISMATCH':
      !compatible?'INCOMPATIBLE_AGENT_DEFINITION':!legacyAnchor(spaces)?'OWNER_CONTEXT_ANCHOR_NOT_FOUND':null,
    bindings,
    // Compatibility with old console versions; never select one binding from
    // multiple active choices as the implicit primary.
    binding:bindings.length===1?bindings[0]:null};
}

export class DorianRegistrationConflict extends Error { status=409; }

export async function registerDorianDeployment(input: { environment:unknown; agentId:unknown }) {
  const env=expectedRelishDorianEnvironment();
  if(input.environment !== env) throw new DorianRegistrationConflict('The selected environment does not match this Relish server.');
  const ownerUserId=configuredOwner();
  const agentId=String(input.agentId ?? '').trim();
  if (!validElevenLabsAgentId(agentId)) throw new Error('Enter a valid ElevenLabs Agent ID.');
  // Never accept a ContextSpace from the operator or provider as runtime authority.
  // An existing binding retains its historic anchor; new ones receive an
  // automatically selected owned FK solely for schema compatibility.
  const spaces = await scopedSpaces(ownerUserId);
  const anchor = legacyAnchor(spaces);
  if (!anchor) throw new DorianRegistrationConflict('The deployment owner needs an owned ContextSpace for the legacy binding foreign key.');
  const owner=await prisma.user.findUnique({where:{id:ownerUserId},select:{id:true}});
  if(!owner) throw new Error('Configured deployment owner was not found.');
  const agentIdIdx=buildScopedIndexToken(agentId,PROVIDER_SCOPE);
  const environment=expectedProviderEnvironment();
  // Serialize registrations in this database. A transaction-scoped advisory lock
  // works with both Neon direct connections and transaction pooling; no permanent
  // session lock is left behind when a request finishes.
  return prisma.$transaction(async tx=>{
    // PostgreSQL advisory-lock functions return VOID. Prisma cannot deserialize a
    // selected VOID column, so return a supported integer instead.
    // Keep the lock acquisition inside the same transaction as registration.
    await tx.$queryRaw`SELECT 1::integer AS locked FROM (SELECT pg_advisory_xact_lock(820300031)) AS lock_row`;
    const current=await tx.agentDefinition.findUnique({where:{userId_key:{userId:ownerUserId,key:'DORIAN'}}});
    if(current && (current.category!=='conversation'||current.deploymentScope!=='external_voice'))
      throw new DorianRegistrationConflict('An incompatible DORIAN definition already exists; review it before registration.');
    const agent=current || await tx.agentDefinition.create({data:{
      userId:ownerUserId,key:'DORIAN',name:'Dorian',description:'External conversational relationship partner',
      category:'conversation',status:'active',personaKey:'dorian',purposeKey:'conversation',
      deploymentScope:'external_voice',authorityLevel:'advisory',allowedDomainKeys:['general','business','dating'],
      allowedContextSpaceIds:[],defaultModelProvider:'openai',defaultModelName:'provider-managed',
      systemPrompt:'You are Dorian, a Relish conversation partner. Use only server-authorised participant context, consent procedures and tool permissions.'
    }});
    const validity={provider:'ELEVENLABS',isActive:true,validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]};
    // Multiple provider IDs may be active for the same Dorian definition.
    // Authorization is exact-ID; a different ID never replaces the old one.
    const activeForId=await tx.agentProviderBinding.findMany({where:{...validity,providerAgentIdIdx:agentIdIdx},
      select:{id:true,userId:true,agentDefinitionId:true,environment:true},take:2});
    if(activeForId.length>1)throw new DorianRegistrationConflict('Ambiguous provider ID; review the existing bindings.');
    const candidate=activeForId[0];
    if(candidate && (candidate.userId!==ownerUserId || candidate.agentDefinitionId!==agent.id || candidate.environment!==environment))
      throw new DorianRegistrationConflict('ElevenLabs Agent ID is already bound to a different active deployment.');
    if(candidate)return {status:'ALREADY_REGISTERED',bindingId:candidate.id,agentDefinitionId:agent.id,environment};
    // Existing definition permissions are preserved. Deployment registration
    // must not implicitly grant access to any participant's private data.
    const binding=await tx.agentProviderBinding.create({data:{
      userId:ownerUserId,agentDefinitionId:agent.id,contextSpaceId:anchor.id,
      provider:'ELEVENLABS',environment,isActive:true,
      providerAgentIdEnc:encrypt(agentId,PROVIDER_AAD),providerAgentIdIdx:agentIdIdx
    },select:{id:true}});
    return {status:'REGISTERED',bindingId:binding.id,agentDefinitionId:agent.id,environment};
  },{timeout:15000});
}

// Stage 8.21 — explicit replacement of a provider agent ID. Historical bindings
// are archived (never deleted) so audit/session relationships stay intact.
// This is intended for a quiet pilot cutover; recent calls prevent rotation.
export async function replaceDorianDeployment(input: {
  environment:unknown; agentId:unknown; previousBindingId:unknown;
}) {
  const env=expectedRelishDorianEnvironment();
  if(input.environment!==env)throw new DorianRegistrationConflict('Relish environment mismatch.');
  const ownerUserId=configuredOwner();
  const agentId=String(input.agentId??'').trim();
  const previousBindingId=String(input.previousBindingId??'');
  if(!validElevenLabsAgentId(agentId)||!/^[a-fA-F0-9-]{36}$/.test(previousBindingId))
    throw new Error('Invalid replacement identifiers.');
  const idx=buildScopedIndexToken(agentId,PROVIDER_SCOPE);
  const providerEnvironment=expectedProviderEnvironment();
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1::integer AS locked FROM (SELECT pg_advisory_xact_lock(820300031)) AS lock_row`;
    const definition=await tx.agentDefinition.findUnique({where:{userId_key:{userId:ownerUserId,key:'DORIAN'}}});
    if(!definition||definition.category!=='conversation'||definition.deploymentScope!=='external_voice')
      throw new DorianRegistrationConflict('Dorian definition missing or incompatible.');
    const active=await tx.agentProviderBinding.findMany({where:{userId:ownerUserId,
      agentDefinitionId:definition.id,provider:'ELEVENLABS',isActive:true,
      validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]},
      select:{id:true,providerAgentIdIdx:true,environment:true,userId:true,contextSpaceId:true}});
    if(active.length!==1 || active[0].id!==previousBindingId || active[0].environment!==providerEnvironment)
      throw new DorianRegistrationConflict('Current binding changed. Refresh before replacing it.');
    if(active[0].providerAgentIdIdx===idx)
      return {status:'ALREADY_REGISTERED',bindingId:active[0].id,agentDefinitionId:definition.id,environment:providerEnvironment};
    const collision=await tx.agentProviderBinding.count({where:{provider:'ELEVENLABS',providerAgentIdIdx:idx,isActive:true}});
    if(collision)throw new DorianRegistrationConflict('New ElevenLabs agent ID is already used by an active binding.');
    const cutoff=new Date(Date.now()-2*60*60*1000);
    const recent=await tx.networkDorianSession.count({where:{agentBindingId:previousBindingId,createdAt:{gte:cutoff}}});
    if(recent>0)throw new DorianRegistrationConflict('Recent Dorian calls exist for this binding. Wait at least two hours after the final call before replacing.');
    const activeWork=await tx.networkDorianSession.count({where:{agentBindingId:previousBindingId,
      understandingOutcome:{in:['QUEUED','WORKING']}}});
    if(activeWork>0)throw new DorianRegistrationConflict('Unfinished understanding processing must be recovered before replacing this binding.');
    const priorSessions=await tx.networkDorianSession.findMany({where:{agentBindingId:previousBindingId,
      conversationId:{not:null}},select:{conversationId:true},take:2001});
    if(priorSessions.length>2000)throw new DorianRegistrationConflict('Too many historical sessions to verify safely. Manual audit required.');
    const conversationIds=priorSessions.map(x=>x.conversationId).filter((x):x is string=>!!x);
    if(conversationIds.length) {
      const stillInCall=await tx.networkPhoneCaller.count({where:{understandingState:'IN_CALL',understandingConversationId:{in:conversationIds}}});
      if(stillInCall>0)throw new DorianRegistrationConflict('A phone caller is still IN_CALL. Resolve this in Call Recovery before replacing.');
    }
    const now=new Date();
    await tx.agentProviderBinding.update({where:{id:previousBindingId},data:{isActive:false,validTo:now}});
    const next=await tx.agentProviderBinding.create({data:{
      userId:ownerUserId,agentDefinitionId:definition.id,contextSpaceId:active[0].contextSpaceId,
      provider:'ELEVENLABS',environment:providerEnvironment,isActive:true,
      providerAgentIdEnc:encrypt(agentId,PROVIDER_AAD),providerAgentIdIdx:idx
    },select:{id:true}});
    return {status:'REPLACED',bindingId:next.id,previousBindingId,agentDefinitionId:definition.id,environment:providerEnvironment};
  },{timeout:15000});
}
