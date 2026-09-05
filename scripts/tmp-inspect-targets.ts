import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const rows = await prisma.$queryRawUnsafe<
    { request_id: string; whisper_transcript: string | null; targets: unknown; matching_tier_used: string | null; matched_entity_value: string | null }[]
  >(`
    select request_id, whisper_transcript, targets, matching_tier_used, matched_entity_value
    from voice_interactions
    order by created_at desc
    limit 5;
  `);
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}
main();
