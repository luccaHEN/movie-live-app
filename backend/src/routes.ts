import { Router } from 'express';
import { AuthController } from './controllers/AuthController';
import { MovieController } from './controllers/MovieController';
import { UserController } from './controllers/UserController';
import { authMiddleware } from './middlewares/auth';
import { prisma } from './prisma';

export const routes = Router();

const authController = new AuthController();
const movieController = new MovieController();
const userController = new UserController();

// Rotas Públicas
routes.post('/login', authController.login);
routes.post('/register', authController.register);

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
routes.use(authMiddleware);

routes.get('/movies/search', movieController.search);
routes.get('/movies/popular', movieController.popular);
routes.get('/movies/tmdb/:id', movieController.getTmdbDetails);
routes.get('/movies', movieController.index);
routes.post('/movies', movieController.create);
routes.put('/movies/:id', movieController.update);
routes.delete('/movies/:id', movieController.delete);
routes.get('/profile', userController.getProfile);
routes.put('/profile', userController.updateProfile);
