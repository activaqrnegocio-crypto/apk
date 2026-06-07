const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.pushSubscription.findMany({ where: { userId: 61 } });
  console.log('=== Suscripciones para userId=61 ===');
  console.log('Total:', subs.length);
  subs.forEach((s, i) => {
    console.log(`\n--- Suscripcion ${i+1} ---`);
    console.log('ID:', s.id);
    console.log('Type:', s.type);
    console.log('Endpoint:', s.endpoint ? s.endpoint.substring(0, 30) + '...' : 'null');
    console.log('FCM Token:', s.fcmToken ? s.fcmToken.substring(0, 50) + '...' : 'null');
    console.log('Created:', s.createdAt);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());