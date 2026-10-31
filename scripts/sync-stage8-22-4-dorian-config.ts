// Explicit out-of-band config sync. Run before first calls for new agents.
// The initiation endpoint reads only the verified local snapshot.
import { prisma } from '../src/lib/db';
import { syncActiveDorianConfigSnapshots } from '../src/lib/server/integrations/elevenlabs/dorianControlPlane';

try {
  const count = await syncActiveDorianConfigSnapshots();
  console.log(`[Relish control plane] Synced ${count} active agent configuration snapshots.`);
} finally {
  await prisma.$disconnect();
}
