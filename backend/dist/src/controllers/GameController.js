"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const prisma_1 = require("../prisma");
class GameController {
    async guess(req, res) {
        const userId = req.userId;
        const { movieId } = req.body;
        if (!movieId) {
            return res.status(400).json({ error: 'movieId é obrigatório' });
        }
        try {
            // 1. Pegar todos os filmes assistidos pelo usuário
            const watchedMovies = await prisma_1.prisma.movie.findMany({
                where: { userId, watched: true },
                orderBy: { id: 'asc' }, // Ordenação determinística
            });
            if (watchedMovies.length === 0) {
                return res.status(400).json({ error: 'Você ainda não tem filmes assistidos para jogar.' });
            }
            // 2. Determinar o Filme do Dia (Daily Movie)
            // Usar o fuso horário de Brasília para resetar exatamente à meia-noite (00:00 BRT)
            const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options);
            const today = formatter.format(new Date()); // YYYY-MM-DD in BRT
            // Para evitar repetições, usamos o número de dias desde uma data fixa (ex: 2024-01-01)
            const epoch = new Date('2024-01-01T00:00:00-03:00');
            const now = new Date(today + 'T00:00:00-03:00');
            const daysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
            // Um pseudo-aleatório baseado no userId para que o "salto" seja diferente por usuário
            const jump = (userId * 17) % watchedMovies.length || 1;
            // index avança determinísticamente a cada dia, sem repetir
            const dailyIndex = Math.abs(daysSinceEpoch * jump) % watchedMovies.length;
            const dailyMovie = watchedMovies[dailyIndex];
            // 3. Pegar o filme que o usuário palpitou
            const guessedMovie = await prisma_1.prisma.movie.findFirst({
                where: { id: parseInt(movieId, 10), userId }
            });
            if (!guessedMovie) {
                return res.status(404).json({ error: 'Palpite não encontrado na sua lista de filmes.' });
            }
            // 4. Comparar os dados
            const isCorrect = dailyMovie.id === guessedMovie.id;
            // Comparar Gêneros
            let genreStatus = 'wrong';
            const dailyGenres = (dailyMovie.genre || '').split(',').map(g => g.trim().toLowerCase());
            const guessedGenres = (guessedMovie.genre || '').split(',').map(g => g.trim().toLowerCase());
            if (dailyMovie.genre === guessedMovie.genre) {
                genreStatus = 'match';
            }
            else if (guessedGenres.some(g => dailyGenres.includes(g))) {
                genreStatus = 'partial';
            }
            // Comparar Duração
            let runtimeStatus = 'match';
            if ((guessedMovie.runtime || 0) < (dailyMovie.runtime || 0)) {
                runtimeStatus = 'higher';
            }
            else if ((guessedMovie.runtime || 0) > (dailyMovie.runtime || 0)) {
                runtimeStatus = 'lower';
            }
            // Comparar Nota do Streamer
            let ratingStatus = 'match';
            const guessedRating = guessedMovie.streamerRating || 0;
            const dailyRating = dailyMovie.streamerRating || 0;
            if (guessedRating < dailyRating) {
                ratingStatus = 'higher';
            }
            else if (guessedRating > dailyRating) {
                ratingStatus = 'lower';
            }
            // Comparar Solicitante
            const requestedByStatus = (guessedMovie.requestedBy?.trim().toLowerCase() === dailyMovie.requestedBy?.trim().toLowerCase()) ? 'match' : 'wrong';
            return res.json({
                isCorrect,
                guess: {
                    id: guessedMovie.id,
                    title: guessedMovie.title,
                    poster: guessedMovie.poster,
                    genre: { value: guessedMovie.genre || 'N/A', status: genreStatus },
                    runtime: { value: guessedMovie.runtime || 0, status: runtimeStatus },
                    streamerRating: { value: guessedMovie.streamerRating || 0, status: ratingStatus },
                    requestedBy: { value: guessedMovie.requestedBy || 'Ninguém', status: requestedByStatus },
                }
            });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao processar a tentativa.' });
        }
    }
    async getDailyPoster(req, res) {
        const userId = req.userId;
        try {
            const watchedMovies = await prisma_1.prisma.movie.findMany({
                where: { userId, watched: true, poster: { not: null } },
                orderBy: { id: 'asc' },
            });
            if (watchedMovies.length === 0) {
                return res.status(400).json({ error: 'Sem filmes com capa para jogar.' });
            }
            const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options);
            const today = formatter.format(new Date());
            const epoch = new Date('2024-01-01T00:00:00-03:00');
            const now = new Date(today + 'T00:00:00-03:00');
            const daysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
            const jump = (userId * 23) % watchedMovies.length || 1;
            const dailyIndex = Math.abs(daysSinceEpoch * jump) % watchedMovies.length;
            const dailyMovie = watchedMovies[dailyIndex];
            return res.json({ poster: dailyMovie.poster });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar poster diário.' });
        }
    }
    async guessPoster(req, res) {
        const userId = req.userId;
        const { movieId } = req.body;
        if (!movieId) {
            return res.status(400).json({ error: 'movieId é obrigatório' });
        }
        try {
            const watchedMovies = await prisma_1.prisma.movie.findMany({
                where: { userId, watched: true, poster: { not: null } },
                orderBy: { id: 'asc' },
            });
            if (watchedMovies.length === 0) {
                return res.status(400).json({ error: 'Sem filmes para jogar.' });
            }
            const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options);
            const today = formatter.format(new Date());
            const epoch = new Date('2024-01-01T00:00:00-03:00');
            const now = new Date(today + 'T00:00:00-03:00');
            const daysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
            const jump = (userId * 23) % watchedMovies.length || 1;
            const dailyIndex = Math.abs(daysSinceEpoch * jump) % watchedMovies.length;
            const dailyMovie = watchedMovies[dailyIndex];
            const guessedMovie = await prisma_1.prisma.movie.findFirst({
                where: { id: parseInt(movieId, 10), userId }
            });
            if (!guessedMovie) {
                return res.status(404).json({ error: 'Palpite não encontrado.' });
            }
            const isCorrect = dailyMovie.id === guessedMovie.id;
            return res.json({
                isCorrect,
                guess: {
                    id: guessedMovie.id,
                    title: guessedMovie.title,
                    poster: guessedMovie.poster,
                }
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao processar a tentativa.' });
        }
    }
    async getDailySynopsis(req, res) {
        const userId = req.userId;
        try {
            const watchedMovies = await prisma_1.prisma.movie.findMany({
                where: { userId, watched: true, tmdbId: { not: null } },
                orderBy: { id: 'asc' },
            });
            if (watchedMovies.length === 0) {
                return res.status(400).json({ error: 'Sem filmes válidos para jogar.' });
            }
            const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options);
            const today = formatter.format(new Date());
            const epoch = new Date('2024-01-01T00:00:00-03:00');
            const now = new Date(today + 'T00:00:00-03:00');
            const daysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
            // Jump diferente para a sinopse
            const jump = (userId * 47) % watchedMovies.length || 1;
            let dailyMovie = null;
            let synopsis = '';
            let attempts = 0;
            const axios = require('axios');
            while (attempts < 10) {
                const index = Math.abs((daysSinceEpoch + attempts) * jump) % watchedMovies.length;
                const candidate = watchedMovies[index];
                try {
                    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${candidate.tmdbId}?language=pt-BR`, {
                        headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
                    });
                    if (tmdbRes.data.overview && tmdbRes.data.overview.length > 20) {
                        dailyMovie = candidate;
                        const originalText = tmdbRes.data.overview;
                        // Censurar nomes próprios e o próprio título do filme se aparecer
                        const ignoreList = ['O', 'A', 'Os', 'As', 'Um', 'Uma', 'Ele', 'Ela', 'Mas', 'Quando', 'Na', 'No', 'Em', 'Para', 'Com', 'De', 'Da', 'Do', 'Dos', 'Das', 'Por', 'Após', 'Durante', 'Se', 'Como', 'Ao', 'Que', 'Sua', 'Seu', 'Suas', 'Seus'];
                        synopsis = originalText.replace(/\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]*\b/g, (match) => {
                            if (ignoreList.includes(match))
                                return match;
                            return '[██████]';
                        });
                        break;
                    }
                }
                catch (e) {
                    console.error('Erro ao buscar sinopse no tmdb');
                }
                attempts++;
            }
            if (!dailyMovie || !synopsis) {
                return res.status(400).json({ error: 'Não foi possível carregar a sinopse hoje.' });
            }
            return res.json({ synopsis });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar sinopse diária.' });
        }
    }
    async guessSynopsis(req, res) {
        const userId = req.userId;
        const { movieId } = req.body;
        if (!movieId) {
            return res.status(400).json({ error: 'movieId é obrigatório' });
        }
        try {
            const watchedMovies = await prisma_1.prisma.movie.findMany({
                where: { userId, watched: true, tmdbId: { not: null } },
                orderBy: { id: 'asc' },
            });
            if (watchedMovies.length === 0) {
                return res.status(400).json({ error: 'Sem filmes para jogar.' });
            }
            const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options);
            const today = formatter.format(new Date());
            const epoch = new Date('2024-01-01T00:00:00-03:00');
            const now = new Date(today + 'T00:00:00-03:00');
            const daysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
            const jump = (userId * 47) % watchedMovies.length || 1;
            let dailyMovie = null;
            let fullSynopsisText = null;
            let attempts = 0;
            const axios = require('axios');
            while (attempts < 10) {
                const index = Math.abs((daysSinceEpoch + attempts) * jump) % watchedMovies.length;
                const candidate = watchedMovies[index];
                try {
                    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${candidate.tmdbId}?language=pt-BR`, {
                        headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
                    });
                    if (tmdbRes.data.overview && tmdbRes.data.overview.length > 20) {
                        dailyMovie = candidate;
                        fullSynopsisText = tmdbRes.data.overview;
                        break;
                    }
                }
                catch (e) { }
                attempts++;
            }
            if (!dailyMovie) {
                return res.status(400).json({ error: 'Filme diário não encontrado.' });
            }
            const guessedMovie = await prisma_1.prisma.movie.findFirst({
                where: { id: parseInt(movieId, 10), userId }
            });
            if (!guessedMovie) {
                return res.status(404).json({ error: 'Palpite não encontrado.' });
            }
            const isCorrect = dailyMovie.id === guessedMovie.id;
            let fullSynopsis = null;
            if (isCorrect && fullSynopsisText) {
                fullSynopsis = fullSynopsisText;
            }
            return res.json({
                isCorrect,
                fullSynopsis,
                guess: {
                    id: guessedMovie.id,
                    title: guessedMovie.title,
                    poster: guessedMovie.poster,
                }
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao processar a tentativa.' });
        }
    }
}
exports.GameController = GameController;
