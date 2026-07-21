import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class UserController {
  // Busca as informações do usuário logado (sem trazer a senha)
  async getProfile(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatar: true, isAdmin: true, followedStreamer: true, followedStreamersList: true, isStreamerMode: true, twitchChannel: true } as any
      });
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
  }

  // Atualiza o nome e a foto do usuário logado
  async updateProfile(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const { name, avatar, followedStreamer, isStreamerMode, twitchChannel } = req.body;
    
    // Normaliza o canal da Twitch (minúsculas e sem espaços)
    const normalizedTwitchChannel = twitchChannel ? twitchChannel.trim().toLowerCase() : twitchChannel;

    try {
      // Faz a verificação manual de duplicidade (para não alterar a estrutura do banco de dados)
      if (normalizedTwitchChannel) {
        const canalEmUso = await prisma.user.findFirst({
          where: { 
            twitchChannel: normalizedTwitchChannel, 
            id: { not: userId } 
          }
        });
        
        if (canalEmUso) {
          return res.status(400).json({ error: 'Este canal da Twitch já está vinculado a outra conta no app.' });
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { name, avatar, followedStreamer, isStreamerMode, twitchChannel: normalizedTwitchChannel },
        select: { id: true, email: true, name: true, avatar: true, isAdmin: true, followedStreamer: true, followedStreamersList: true, isStreamerMode: true, twitchChannel: true } as any
      });
      return res.json(user);
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
  }
}