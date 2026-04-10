import { Router } from 'express';
import { AuthController } from './controllers/AuthController';
import { MovieController } from './controllers/MovieController';
import { UserController } from './controllers/UserController';
import { authMiddleware } from './middlewares/auth';

export const routes = Router();

const authController = new AuthController();
const movieController = new MovieController();
const userController = new UserController();

// Rotas Públicas
routes.post('/login', authController.login);
routes.post('/register', authController.register);

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
