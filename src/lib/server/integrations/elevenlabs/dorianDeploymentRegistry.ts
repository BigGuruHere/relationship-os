// Stage 8.20.3 — Relish owns the Dorian provider binding and participant custody.
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

export async function readDorianDeploymentRegistration() {
  const ownerUserId = configuredOwner();
  const env = expectedRelishDorianEnvironment();
  const [owner, spaces, definition] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true } }),
    scopedSpaces(ownerUserId),
    prisma.agentDefinition.findUnique({ where: { userId_key: { userId: ownerUserId, key: 'DORIAN' } }, select: { id: true, category: true, deploymentScope: true } })
  ]);
  if (!owner) return { environment: env, ready: false, reason: 'OWNER_NOT_FOUND', spaces: [], binding: null };
  const rows = definition ? await prisma.agentProviderBinding.findMany({
    where: { userId:ownerUserId, agentDefinitionId:definition.id, provider:'ELEVENLABS', isActive:true,
      validFrom:{ lte:new Date() }, OR:[{validTo:null},{validTo:{gt:new Date()}}] },
    select: { id:true, contextSpaceId:true, environment:true, providerAgentIdEnc:true }, take: 3
  }) : [];
  const binding = rows.length === 1 ? {
    id: rows[0].id, contextSpaceId:rows[0].contextSpaceId, environment:rows[0].environment,
    agentId: rows[0].providerAgentIdEnc ? decrypt(rows[0].providerAgentIdEnc,PROVIDER_AAD) : ''
  } : null;
  return { environment:env, providerEnvironment:expectedProviderEnvironment(), ready:rows.length<=1 && !(definition && (definition.category!=='conversation' || definition.deploymentScope!=='external_voice')),
    reason:rows.length>1?'MULTIPLE_ACTIVE_DORIAN_BINDINGS':
      definition && (definition.category!=='conversation' || definition.deploymentScope!=='external_voice')?'INCOMPATIBLE_AGENT_DEFINITION':null,
    spaces, binding };
}

export class DorianRegistrationConflict extends Error { status=409; }

export async function registerDorianDeployment(input: { environment:unknown; contextSpaceId:unknown; agentId:unknown }) {
  const env=expectedRelishDorianEnvironment();
  if(input.environment !== env) throw new DorianRegistrationConflict('The selected environment does not match this Relish server.');
  const ownerUserId=configuredOwner();
  const spaceId=String(input.contextSpaceId ?? '');
  const agentId=String(input.agentId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(spaceId) || !validElevenLabsAgentId(agentId))
    throw new Error('Select an owned ContextSpace and a valid ElevenLabs Agent ID.');
  const space=await prisma.contextSpace.findFirst({ where:{id:spaceId,ownerUserId,domainKey:{in:['general','business','dating']}},select:{id:true,domainKey:true}});
  if(!space) throw new Error('Selected ContextSpace does not belong to the configured deployment owner.');
  const owner=await prisma.user.findUnique({where:{id:ownerUserId},select:{id:true}});
  if(!owner) throw new Error('Configured deployment owner was not found.');
  const agentIdIdx=buildScopedIndexToken(agentId,PROVIDER_SCOPE);
  const environment=expectedProviderEnvironment();
  // Serialize registrations in this database. A transaction-scoped advisory lock
  // works with both Neon direct connections and transaction pooling; no permanent
  // session lock is left behind when a request finishes.
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(820300031)`;
    const current=await tx.agentDefinition.findUnique({where:{userId_key:{userId:ownerUserId,key:'DORIAN'}}});
    if(current && (current.category!=='conversation'||current.deploymentScope!=='external_voice'))
      throw new DorianRegistrationConflict('An incompatible DORIAN definition already exists; review it before registration.');
    const agent=current || await tx.agentDefinition.create({data:{
      userId:ownerUserId,key:'DORIAN',name:'Dorian',description:'External conversational relationship partner',
      category:'conversation',status:'active',personaKey:'dorian',purposeKey:'conversation',
      deploymentScope:'external_voice',authorityLevel:'advisory',allowedDomainKeys:[space.domainKey],
      allowedContextSpaceIds:[space.id],defaultModelProvider:'openai',defaultModelName:'provider-managed',
      systemPrompt:'You are Dorian, a Relish conversation partner. Use only server-authorised participant context, consent procedures and tool permissions.'
    }});
    const validity={provider:'ELEVENLABS',isActive:true,validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]};
    const active=await tx.agentProviderBinding.findMany({where:{...validity,agentDefinitionId:agent.id},
      select:{id:true,userId:true,contextSpaceId:true,environment:true,providerAgentIdIdx:true}});
    const sameProviderId=await tx.agentProviderBinding.findMany({where:{...validity,providerAgentIdIdx:agentIdIdx},
      select:{id:true,userId:true,agentDefinitionId:true,contextSpaceId:true,environment:true}});
    if(active.length>1 || sameProviderId.length>1) throw new DorianRegistrationConflict('Ambiguous active bindings; resolve the duplicates before registering.');
    const candidate=active[0];
    if(candidate && (candidate.providerAgentIdIdx!==agentIdIdx || candidate.contextSpaceId!==space.id || candidate.environment!==environment))
      throw new DorianRegistrationConflict('An active Dorian binding already uses another Agent ID, environment or ContextSpace. Registration never silently replaces it.');
    if(sameProviderId[0] && (!candidate || sameProviderId[0].id!==candidate.id || sameProviderId[0].userId!==ownerUserId))
      throw new DorianRegistrationConflict('The ElevenLabs Agent ID is already bound to a different active deployment.');
    if(candidate) return {status:'ALREADY_REGISTERED',bindingId:candidate.id,agentDefinitionId:agent.id,environment};
    if(current) await tx.agentDefinition.update({where:{id:agent.id},data:{
      allowedDomainKeys:[...new Set([...agent.allowedDomainKeys,space.domainKey])],
      allowedContextSpaceIds:[...new Set([...agent.allowedContextSpaceIds,space.id])]
    }});
    const binding=await tx.agentProviderBinding.create({data:{
      userId:ownerUserId,agentDefinitionId:agent.id,contextSpaceId:space.id,
      provider:'ELEVENLABS',environment,isActive:true,
      providerAgentIdEnc:encrypt(agentId,PROVIDER_AAD),providerAgentIdIdx:agentIdIdx
    },select:{id:true}});
    return {status:'REGISTERED',bindingId:binding.id,agentDefinitionId:agent.id,environment};
  },{timeout:15000});
}
