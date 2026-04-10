import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from './prisma';
import { routes } from './routes';

const app = express();

// Bloqueia acessos de outros sites, permitindo apenas o seu Frontend (Vercel) e o localhost (seu PC)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173' // Garante que você consiga continuar testando localmente
];

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json({ limit: '5mb' }));
app.use(routes);

// Rota de teste para garantir que a API está no ar
app.get('/', (req: Request, res: Response) => {
  res.json({ message: '🎬 SumasMovie API está rodando perfeitamente!' });
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, async () => {
  // Tenta conectar ao banco para confirmar que está tudo ok
  await prisma.$connect();
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('📦 Conectado ao banco de dados com sucesso!');
});