import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class CommunityController {
  // Retorna todos os usuários (Streamers) que possuem pelo menos 1 filme salvo, com a contagem.
  async getStreamers(req: Request, res: Response): Promise<Response | any> {
    try {
      const streamers = await prisma.user.findMany({
        where: {
          isStreamerMode: true,
          movies: { some: {} } // Filtra quem tem filmes
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          _count: {
            select: { movies: true }
          }
        }
      });
      return res.json(streamers);
    } catch (error) {
      console.error('Erro ao buscar streamers:', error);
      return res.status(500).json({ error: 'Erro ao buscar streamers' });
    }
  }

  // Alterna o follow/unfollow de um streamer específico
  async toggleFollow(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const { streamerName } = req.body;

    if (!streamerName) {
      return res.status(400).json({ error: 'O nome do streamer é obrigatório' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

      let newList = [...(user.followedStreamersList || [])];
      
      if (newList.includes(streamerName)) {
        // Unfollow
        newList = newList.filter(name => name !== streamerName);
      } else {
        // Follow
        newList.push(streamerName);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { followedStreamersList: newList },
        select: { id: true, followedStreamersList: true }
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error('Erro ao seguir/desseguir:', error);
      return res.status(500).json({ error: 'Erro interno ao tentar seguir' });
    }
  }

  // Busca os filmes de um streamer específico para visualizar o perfil dele
  async getStreamerMovies(req: Request, res: Response): Promise<Response | any> {
    const { streamerId } = req.params;

    try {
      const id = parseInt(streamerId as string, 10);
      const streamer = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, avatar: true }
      });

      if (!streamer) {
        return res.status(404).json({ error: 'Streamer não encontrado' });
      }

      const movies = await prisma.movie.findMany({
        where: { userId: id }
      });

      return res.json({ streamer, movies });
    } catch (error) {
      console.error('Erro ao buscar perfil do streamer:', error);
      return res.status(500).json({ error: 'Erro ao carregar os filmes do streamer' });
    }
  }

  // Busca os filmes de um streamer específico pelo nome (útil para Push Notifications)
  async getStreamerMoviesByName(req: Request, res: Response): Promise<Response | any> {
    const { streamerName } = req.params;

    try {
      const streamer = await prisma.user.findFirst({
        where: { name: streamerName as string },
        select: { id: true, name: true, avatar: true }
      });

      if (!streamer) {
        return res.status(404).json({ error: 'Streamer não encontrado' });
      }

      const movies = await prisma.movie.findMany({
        where: { userId: streamer.id }
      });

      return res.json({ streamer, movies });
    } catch (error) {
      console.error('Erro ao buscar perfil do streamer por nome:', error);
      return res.status(500).json({ error: 'Erro ao carregar os filmes do streamer' });
    }
  }
}
