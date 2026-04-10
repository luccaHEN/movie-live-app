import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from './prisma';
import { routes } from './routes';

const app = express();

// Permite que qualquer site (incluindo sua Vercel) acesse a API, evitando erros de CORS
app.use(cors());
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