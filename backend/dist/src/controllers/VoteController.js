"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteController = void 0;
const TwitchVoteService_1 = require("../services/TwitchVoteService");
const prisma_1 = require("../prisma");
class VoteController {
    // POST /votes/start - body: { movieId, twitchChannel }
    async start(req, res) {
        const userId = req.userId;
        const { movieId, twitchChannel, durationMinutes = 3 } = req.body;
        if (!movieId || !twitchChannel) {
            return res.status(400).json({ error: 'movieId e twitchChannel são obrigatórios.' });
        }
        // Verifica se o filme pertence a este usuário
        const movie = await prisma_1.prisma.movie.findFirst({ where: { id: movieId, userId } });
        if (!movie) {
            return res.status(404).json({ error: 'Filme não encontrado.' });
        }
        const result = await (0, TwitchVoteService_1.startVoting)(userId, movieId, twitchChannel.replace('@', '').trim().toLowerCase(), durationMinutes);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        return res.json({ message: `Votação iniciada no canal ${twitchChannel}!`, movieId });
    }
    // POST /votes/stop - salva automaticamente chatRating no filme
    async stop(req, res) {
        const userId = req.userId;
        const result = await (0, TwitchVoteService_1.stopVoting)(userId);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        // Salva a média em chatRating do filme se houveram votos
        if (result.average !== null && result.movieId) {
            await prisma_1.prisma.movie.update({
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
    async status(req, res) {
        const userId = req.userId;
        const status = (0, TwitchVoteService_1.getVotingStatus)(userId);
        return res.json(status);
    }
}
exports.VoteController = VoteController;
