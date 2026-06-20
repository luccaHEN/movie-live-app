"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const prisma_1 = require("../prisma");
class UserController {
    // Busca as informações do usuário logado (sem trazer a senha)
    async getProfile(req, res) {
        const userId = req.userId;
        try {
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true, avatar: true, isAdmin: true, followedStreamer: true, followedStreamersList: true }
            });
            return res.json(user);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar perfil' });
        }
    }
    // Atualiza o nome e a foto do usuário logado
    async updateProfile(req, res) {
        const userId = req.userId;
        const { name, avatar, followedStreamer } = req.body;
        try {
            const user = await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { name, avatar, followedStreamer },
                select: { id: true, email: true, name: true, avatar: true, isAdmin: true, followedStreamer: true, followedStreamersList: true }
            });
            return res.json(user);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar perfil' });
        }
    }
}
exports.UserController = UserController;
