import { prisma } from './prisma';
import bcrypt from 'bcrypt';

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@stream.com' },
    update: {},
    create: {
      email: 'admin@stream.com',
      password: hashedPassword,
    },
  });
  console.log('✅ Admin criado:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());