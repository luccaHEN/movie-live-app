import { Request, Response } from 'express';
import { startVoting, stopVoting, getVotingStatus } from '../services/TwitchVoteService';
import { prisma } from '../prisma';

export class VoteController {
  // POST /votes/start - body: { movieId, twitchChannel }
  async start(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const { movieId, twitchChannel } = req.body;

    if (!movieId || !twitchChannel) {
      return res.status(400).json({ error: 'movieId e twitchChannel são obrigatórios.' });
    }

    // Verifica se o filme pertence a este usuário
    const movie = await prisma.movie.findFirst({ where: { id: movieId, userId } });
    if (!movie) {
      return res.status(404).json({ error: 'Filme não encontrado.' });
    }

    const result = await startVoting(userId, movieId, twitchChannel.replace('@', '').trim().toLowerCase());
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ message: `Votação iniciada no canal ${twitchChannel}!`, movieId });
  }

  // POST /votes/stop - salva automaticamente chatRating no filme
  async stop(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;

    const result = await stopVoting(userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Salva a média em chatRating do filme se houveram votos
    if (result.average !== null && result.movieId) {
      await prisma.movie.update({
        where: { id: result.movieId },
        data: { chatRating: result.average }
      });
    }

    return res.json({
      message: 'Votação encerrada!',
      average: result.average,
      totalVotes: result.totalVotes,
      votes: result.votes
    });
  }

  // GET /votes/status
  async status(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const status = getVotingStatus(userId);
    return res.json(status);
  }
}
