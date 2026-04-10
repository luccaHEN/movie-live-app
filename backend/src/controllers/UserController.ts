import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class UserController {
  // Busca as informações do usuário logado (sem trazer a senha)
  async getProfile(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatar: true }
      });
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
  }

  // Atualiza o nome e a foto do usuário logado
  async updateProfile(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const { name, avatar } = req.body;
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { name, avatar },
        select: { id: true, email: true, name: true, avatar: true }
      });
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
  }
}