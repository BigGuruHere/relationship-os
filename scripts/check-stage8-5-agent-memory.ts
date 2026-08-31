// scripts/check-stage8-5-agent-memory.ts
// PURPOSE: Read-only integrity check for Stage 8.5 agent profile/data-policy separation.

import { prisma } from '../src/lib/db.ts';

const BUILT_INS = new Set([
  'broker_brief_agent',
  'opportunity_scoring_agent',
  'contact_enrichment_agent',
  'outreach_agent'
]);

async function main() {
  const agents = await prisma.agentDefinition.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      userId: true,
      key: true,
      personaKey: true,
      purposeKey: true,
      deploymentScope: true,
      authorityLevel: true,
      dataAccessPolicy: {
        select: {
          id: true,
          userId: true,
          allowContacts: true,
          allowCompanies: true,
          allowDeals: true,
          allowProjects: true,
          allowPeople: true
        }
      }
    }
  });

  const builtIns = agents.filter((agent) => BUILT_INS.has(agent.key));
  const missingProfile = builtIns.filter((agent) =>
    !agent.personaKey || !agent.purposeKey || agent.purposeKey === 'general' || !agent.deploymentScope || !agent.authorityLevel
  );
  const missingPolicy = builtIns.filter((agent) => !agent.dataAccessPolicy);
  const crossTenantPolicy = builtIns.filter((agent) => agent.dataAccessPolicy && agent.dataAccessPolicy.userId !== agent.userId);

  const memoryTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'MemoryProjection'
    ) AS "exists"
  `;

  console.log(`Active agent definitions: ${agents.length}`);
  console.log(`Built-in agents checked: ${builtIns.length}`);
  console.log(`Built-ins missing explicit purpose/profile: ${missingProfile.length}`);
  console.log(`Built-ins missing data-access policy: ${missingPolicy.length}`);
  console.log(`Policies with mismatched tenant owner: ${crossTenantPolicy.length}`);
  console.log(`Persisted MemoryProjection table exists: ${memoryTable[0]?.exists ? 'YES' : 'no'}`);

  if (missingProfile.length || missingPolicy.length || crossTenantPolicy.length || memoryTable[0]?.exists) {
    throw new Error('FAIL: Stage 8.5 agent purpose/access foundation is not internally consistent.');
  }

  console.log('PASS: Stage 8.5 agent purpose/access and derived memory projection are internally consistent.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
