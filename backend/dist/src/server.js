"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prisma_1 = require("./prisma");
const routes_1 = require("./routes");
const cron_1 = require("./cron");
const app = (0, express_1.default)();
// Bloqueia acessos de outros sites, permitindo apenas o seu Frontend (Vercel) e o localhost (seu PC)
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173' // Garante que você consiga continuar testando localmente
];
app.use((0, cors_1.default)({
    origin: allowedOrigins
}));
app.use(express_1.default.json({ limit: '10mb' })); // Aumentamos para 10MB por segurança
// Rota pública de teste para garantir que a API está no ar (Usada pelo Cron-job)
app.get('/', (req, res) => {
    res.json({ message: '🎬 Sumasflix API está rodando perfeitamente!' });
});
// Importa as demais rotas (protegidas e desprotegidas)
app.use(routes_1.routes);
const PORT = process.env.PORT || 3333;
app.listen(PORT, async () => {
    // Tenta conectar ao banco para confirmar que está tudo ok
    await prisma_1.prisma.$connect();
    // Inicia as rotinas em segundo plano (Despertador)
    (0, cron_1.initCronJobs)();
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log('📦 Conectado ao banco de dados com sucesso!');
});
