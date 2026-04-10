import bcrypt from 'bcrypt';
import { prisma } from './prisma';

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sumasmovie.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('❌ ERRO: A variável ADMIN_PASSWORD não está definida no arquivo .env');
    process.exit(1);
  }

  // Gera o hash da senha (nunca salve em texto puro!)
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Igão',
    },
  });
  console.log('✅ Usuário Admin criado/verificado:', admin.email);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });