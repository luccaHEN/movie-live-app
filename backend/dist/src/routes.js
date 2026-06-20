"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const express_1 = require("express");
const AuthController_1 = require("./controllers/AuthController");
const MovieController_1 = require("./controllers/MovieController");
const UserController_1 = require("./controllers/UserController");
const CommunityController_1 = require("./controllers/CommunityController");
const auth_1 = require("./middlewares/auth");
const prisma_1 = require("./prisma");
exports.routes = (0, express_1.Router)();
const authController = new AuthController_1.AuthController();
const movieController = new MovieController_1.MovieController();
const userController = new UserController_1.UserController();
const communityController = new CommunityController_1.CommunityController();
// Rotas Públicas
exports.routes.post('/login', authController.login);
exports.routes.post('/refresh-token', authController.refreshToken);
exports.routes.get('/movies/public/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // 1. Busca o usuário pelo nome
        const user = await prisma_1.prisma.user.findFirst({
            where: { name: username }
        });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        // 2. Busca os filmes apenas desse usuário, retornando apenas campos seguros
        const movies = await prisma_1.prisma.movie.findMany({
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
    }
    catch (error) {
        console.error("Erro ao buscar filmes públicos:", error);
        res.status(500).json({ error: "Erro ao carregar a lista de filmes." });
    }
});
// Rotas Protegidas (Exigem o envio do Token no header de Autorização)
exports.routes.use(auth_1.isAuthenticated);
// Rota de registro agora é protegida e só para administradores
exports.routes.post('/register', auth_1.isAdministrator, authController.register);
exports.routes.get('/movies/search', movieController.search);
exports.routes.get('/movies/popular', movieController.popular);
exports.routes.get('/movies/tmdb/:id', movieController.getTmdbDetails);
exports.routes.get('/movies/stats', movieController.stats);
exports.routes.get('/movies', movieController.index);
exports.routes.post('/movies', movieController.create);
exports.routes.put('/movies/:id', movieController.update);
exports.routes.delete('/movies/:id', movieController.delete);
exports.routes.get('/profile', userController.getProfile);
exports.routes.put('/profile', userController.updateProfile);
// Rotas da Comunidade
exports.routes.get('/community/streamers', communityController.getStreamers);
exports.routes.post('/community/follow', communityController.toggleFollow);
exports.routes.get('/community/streamer/:streamerId', communityController.getStreamerMovies);
exports.routes.get('/community/streamer-by-name/:streamerName', communityController.getStreamerMoviesByName);
// Rota para o App Mobile salvar o ID do OneSignal
exports.routes.post('/users/set-player-id', async (req, res) => {
    const userId = req.userId;
    const { playerId } = req.body;
    if (!playerId)
        return res.status(400).json({ error: 'playerId é obrigatório.' });
    await prisma_1.prisma.user.update({ where: { id: userId }, data: { oneSignalPlayerId: playerId } });
    return res.status(200).json({ message: 'Player ID salvo com sucesso.' });
});
