import { Router } from 'express';
import { AuthController } from './controllers/AuthController';
import { MovieController } from './controllers/MovieController';
import { UserController } from './controllers/UserController';
import { CommunityController } from './controllers/CommunityController';
import { isAuthenticated, isAdministrator } from './middlewares/auth';
import { prisma } from './prisma';

export const routes = Router();

const authController = new AuthController();
const movieController = new MovieController();
const userController = new UserController();
const communityController = new CommunityController();

// Rotas Públicas
routes.post('/login', authController.login);
routes.post('/refresh-token', authController.refreshToken);
routes.get('/movies/public/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Busca o usuário pelo nome
    const user = await prisma.user.findFirst({
      where: { name: username }
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // 2. Busca os filmes apenas desse usuário, retornando apenas campos seguros
    const movies = await prisma.movie.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        poster: true,
        watched: true,
        watchDate: true,
        requestedBy: true,
        streamerRating: true,
      }
    });

    res.json(movies);
  } catch (error) {
    console.error("Erro ao buscar filmes públicos:", error);
    res.status(500).json({ error: "Erro ao carregar a lista de filmes." });
  }
});

// Rotas Protegidas (Exigem o envio do Token no header de Autorização)
routes.use(isAuthenticated);

// Rota de registro agora é protegida e só para administradores
routes.post('/register', isAdministrator, authController.register);

routes.get('/movies/search', movieController.search);
routes.get('/movies/popular', movieController.popular);
routes.get('/movies/tmdb/:id', movieController.getTmdbDetails);
routes.get('/movies/stats', movieController.stats);
routes.get('/movies', movieController.index);
routes.post('/movies', movieController.create);
routes.put('/movies/reorder', movieController.reorder);
routes.put('/movies/:id', movieController.update);
routes.delete('/movies/:id', movieController.delete);
routes.get('/profile', userController.getProfile);
routes.put('/profile', userController.updateProfile);

// Rotas da Comunidade
routes.get('/community/streamers', communityController.getStreamers);
routes.post('/community/follow', communityController.toggleFollow);
routes.get('/community/streamer/:streamerId', communityController.getStreamerMovies);
routes.get('/community/streamer-by-name/:streamerName', communityController.getStreamerMoviesByName);

// Rota para o App Mobile salvar o ID do OneSignal
routes.post('/users/set-player-id', async (req, res) => {
    const userId = (req as any).userId;
    const { playerId } = req.body;

    if (!playerId) return res.status(400).json({ error: 'playerId é obrigatório.' });

    await prisma.user.update({ where: { id: userId }, data: { oneSignalPlayerId: playerId } });
    return res.status(200).json({ message: 'Player ID salvo com sucesso.' });
});
