"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../prisma");
class AuthController {
    async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
        }
        try {
            const user = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            const isValidPassword = await bcrypt_1.default.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            // Usamos (user as any) para forçar o TypeScript a ignorar a tipagem antiga
            const token = jsonwebtoken_1.default.sign({ id: user.id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, {
                expiresIn: '7d',
            });
            // Remove a senha do objeto do usuário antes de enviar a resposta
            const { password: _, ...userWithoutPassword } = user;
            return res.json({ user: userWithoutPassword, token });
        }
        catch (error) {
            console.error('Erro detalhado no login:', error);
            return res.status(500).json({ error: 'Erro interno ao tentar fazer login.' });
        }
    }
    // Renova o token sem exigir email/senha novamente.
    // Aceita tokens expirados há até 30 dias (janela de graça).
    async refreshToken(req, res) {
        const { authorization } = req.headers;
        if (!authorization) {
            return res.status(401).json({ error: 'Token não fornecido.' });
        }
        const [, token] = authorization.split(' ');
        try {
            // Tenta decodificar o token, ignorando a expiração
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, {
                ignoreExpiration: true,
            });
            // Verifica se o token expirou há mais de 30 dias (janela de graça)
            const now = Math.floor(Date.now() / 1000);
            const GRACE_PERIOD_SECONDS = 30 * 24 * 60 * 60; // 30 dias
            if (decoded.exp && (now - decoded.exp) > GRACE_PERIOD_SECONDS) {
                return res.status(401).json({ error: 'Token expirado há muito tempo. Faça login novamente.' });
            }
            // Verifica se o usuário ainda existe no banco
            const user = await prisma_1.prisma.user.findUnique({ where: { id: decoded.id } });
            if (!user) {
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }
            // Gera um novo token com os dados atuais do banco
            const newToken = jsonwebtoken_1.default.sign({ id: user.id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token: newToken });
        }
        catch (error) {
            // Se o token for completamente inválido (não apenas expirado)
            return res.status(401).json({ error: 'Token inválido. Faça login novamente.' });
        }
    }
    async register(req, res) {
        const { email, password, name } = req.body;
        try {
            const hashedPassword = await bcrypt_1.default.hash(password, 10);
            // Salva o novo usuário no banco de dados via Prisma
            const newUser = await prisma_1.prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    // Novos usuários criados pela API nunca são administradores por padrão
                    isAdmin: false,
                }, // Ignora o erro de tipagem no objeto data
            });
            const { password: _, ...userWithoutPassword } = newUser;
            return res.status(201).json({ message: 'Usuário criado com sucesso!', user: userWithoutPassword });
        }
        catch (error) {
            console.error('Erro detalhado no registro:', error);
            return res.status(400).json({ error: 'Erro ao criar usuário. O e-mail pode já estar em uso.' });
        }
    }
}
exports.AuthController = AuthController;
