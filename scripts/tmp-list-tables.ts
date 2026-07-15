// import 'dotenv/config';
// import { prisma } from '../lib/prisma';

// async function main() {
//   const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
//     `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
//   );
//   console.log(rows.map((r) => r.table_name));
//   await prisma.$disconnect();
// }
// main();
