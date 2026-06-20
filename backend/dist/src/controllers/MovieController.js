"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieController = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../prisma");
async function sendPushToFollowers(streamerName, title, message) {
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY)
        return;
    try {
        const followers = await prisma_1.prisma.user.findMany({
            where: {
                followedStreamersList: { has: streamerName }
            }
        });
        const playerIds = followers
            .map(f => f.oneSignalPlayerId)
            .filter((id) => id != null && id !== '');
        if (playerIds.length === 0)
            return;
        const appId = process.env.ONESIGNAL_APP_ID.replace(/["']/g, '').trim();
        const apiKey = process.env.ONESIGNAL_REST_API_KEY.replace(/["']/g, '').trim();
        await axios_1.default.post('https://onesignal.com/api/v1/notifications', {
            app_id: appId,
            include_player_ids: playerIds,
            headings: { "en": title, "pt": title },
            contents: { "en": message, "pt": message },
            data: { streamerName: streamerName }
        }, { headers: { Authorization: `Basic ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Erro ao enviar push via OneSignal:', error);
    }
}
class MovieController {
    async search(req, res) {
        const { query, page = 1 } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'O parâmetro query é obrigatório' });
        }
        if (!process.env.TMDB_TOKEN) {
            console.error('ERRO: TMDB_TOKEN não está definido no arquivo .env');
            return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
        }
        try {
            const response = await axios_1.default.get(`https://api.themoviedb.org/3/search/movie`, {
                params: {
                    query: query,
                    language: 'pt-BR',
                    page
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_TOKEN}`
                }
            });
            return res.json(response.data.results);
        }
        catch (error) {
            console.error('Detalhes do Erro TMDB:', error.response?.data || error.message);
            return res.status(500).json({ error: 'Erro ao buscar filmes no TMDB', details: error.response?.data });
        }
    }
    async popular(req, res) {
        const { page = 1 } = req.query;
        if (!process.env.TMDB_TOKEN) {
            return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
        }
        try {
            const response = await axios_1.default.get(`https://api.themoviedb.org/3/movie/popular`, {
                params: { language: 'pt-BR', page },
                headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
            });
            return res.json(response.data.results);
        }
        catch (error) {
            console.error('Erro TMDB (Popular):', error.response?.data || error.message);
            return res.status(500).json({ error: 'Erro ao buscar filmes populares no TMDB' });
        }
    }
    async create(req, res) {
        const { title, tmdbId, poster, genre, requestedBy, watchDate } = req.body;
        const userId = req.userId; // Pegando o usuário que fez a requisição
        try {
            let movie = await prisma_1.prisma.movie.findFirst({ where: { tmdbId, userId } });
            if (!movie) {
                movie = await prisma_1.prisma.movie.create({ data: { title, tmdbId, poster, genre, userId, requestedBy, watchDate: watchDate ? new Date(watchDate) : null } });
            }
            else {
                // Se o filme já existir, atualizamos com o novo Nick e Data agendada
                movie = await prisma_1.prisma.movie.update({
                    where: { id: movie.id },
                    data: {
                        requestedBy: requestedBy !== undefined ? requestedBy : movie.requestedBy,
                        watchDate: watchDate ? new Date(watchDate) : (watchDate === null ? null : movie.watchDate)
                    }
                });
            }
            // Envia notificação para seguidores
            const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
            if (user && user.name) {
                await sendPushToFollowers(user.name, 'Novo filme na agenda! 🎬', `${user.name} adicionou "${movie.title}" à agenda de lives!`);
            }
            return res.status(201).json(movie);
        }
        catch (error) {
            console.error('Erro detalhado ao salvar no Prisma:', error);
            return res.status(500).json({ error: 'Erro ao salvar o filme', details: error.message });
        }
    }
    async update(req, res) {
        const { id } = req.params;
        const { watchDate, streamerRating, chatRating, watched, requestedBy, isChampion, isTrash } = req.body;
        const userId = req.userId;
        try {
            const movieId = parseInt(id, 10);
            // Verifica se o filme existe e pertence ao usuário logado
            const existingMovie = await prisma_1.prisma.movie.findFirst({ where: { id: movieId, userId } });
            if (!existingMovie) {
                return res.status(404).json({ error: 'Filme não encontrado.' });
            }
            // Atualiza os dados no banco de dados
            const updatedMovie = await prisma_1.prisma.movie.update({
                where: { id: movieId },
                data: {
                    watchDate: watchDate !== undefined ? (watchDate ? new Date(watchDate) : null) : undefined,
                    streamerRating,
                    chatRating,
                    watched,
                    requestedBy,
                    isChampion,
                    isTrash,
                }
            });
            // Envia notificação de alteração para seguidores
            const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
            if (user && user.name && existingMovie) {
                if (watched && !existingMovie.watched) {
                    await sendPushToFollowers(user.name, 'Filme Assistido! ✅', `${user.name} acabou de assistir "${updatedMovie.title}"!`);
                }
                else if (watchDate && existingMovie.watchDate !== watchDate) {
                    await sendPushToFollowers(user.name, 'Agenda Atualizada 📅', `${user.name} alterou a data de "${updatedMovie.title}".`);
                }
            }
            return res.json(updatedMovie);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar o filme', details: error.message });
        }
    }
    async index(req, res) {
        const userId = req.userId; // Pegando o usuário que fez a requisição
        try {
            const movies = await prisma_1.prisma.movie.findMany({ where: { userId } });
            return res.json(movies);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar os filmes salvos' });
        }
    }
    async delete(req, res) {
        const { id } = req.params; // O ID do filme virá nos parâmetros da URL
        const userId = req.userId; // Pegando o usuário que fez a requisição
        try {
            const movieId = parseInt(id, 10); // Converte o ID para número
            // Pega o nome do filme antes de deletar
            const movieToDelete = await prisma_1.prisma.movie.findFirst({ where: { id: movieId, userId } });
            // deleteMany permite passar múltiplos filtros e checar se algo foi deletado
            const result = await prisma_1.prisma.movie.deleteMany({
                where: { id: movieId, userId },
            });
            if (result.count === 0) {
                return res.status(404).json({ error: 'Filme não encontrado ou você não tem permissão para deletá-lo' });
            }
            if (movieToDelete) {
                const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
                if (user && user.name) {
                    await sendPushToFollowers(user.name, 'Filme removido 🗑️', `${user.name} retirou "${movieToDelete.title}" da agenda.`);
                }
            }
            // Retorna 204 No Content para indicar sucesso na exclusão sem corpo de resposta
            return res.status(204).send();
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao deletar o filme', details: error.message });
        }
    }
    async stats(req, res) {
        const userId = req.userId;
        try {
            const movies = await prisma_1.prisma.movie.findMany({ where: { userId } });
            const totalMovies = movies.length;
            const watchedMoviesList = movies.filter(m => m.watched);
            const watchedMovies = watchedMoviesList.length;
            const unwatchedMovies = totalMovies - watchedMovies;
            const totalWatchMinutes = watchedMoviesList.reduce((acc, m) => acc + 105, 0); // Estimativa padrão
            const totalWatchHours = Math.floor(totalWatchMinutes / 60);
            const totalWatchDays = (totalWatchHours / 24).toFixed(1);
            const streamerRatings = movies.filter(m => m.streamerRating != null).map(m => m.streamerRating);
            const avgStreamerRating = streamerRatings.length ? (streamerRatings.reduce((a, b) => a + b, 0) / streamerRatings.length).toFixed(1) : 'N/A';
            const chatRatings = movies.filter(m => m.chatRating != null).map(m => m.chatRating);
            const avgChatRating = chatRatings.length ? (chatRatings.reduce((a, b) => a + b, 0) / chatRatings.length).toFixed(1) : 'N/A';
            const rescuerCounts = movies.reduce((acc, m) => {
                const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
            const ranking = Object.entries(rescuerCounts)
                .filter(([name]) => name.toLowerCase() !== 'ninguém' && name !== '')
                .map(([name, count]) => ({ name, count: count }))
                .sort((a, b) => {
                if (a.name.toLowerCase() === 'chat')
                    return 1;
                if (b.name.toLowerCase() === 'chat')
                    return -1;
                return b.count - a.count;
            });
            const sumasData = ranking.find(r => r.name.toLowerCase() === 'sumas') || null;
            const chatData = ranking.find(r => r.name.toLowerCase() === 'chat') || null;
            const filteredRanking = ranking.filter(r => r.name.toLowerCase() !== 'sumas' && r.name.toLowerCase() !== 'chat');
            let topRescuer = 'N/A';
            if (filteredRanking.length > 0) {
                const maxRescues = filteredRanking[0].count;
                const tiedUsers = filteredRanking.filter(r => r.count === maxRescues);
                topRescuer = tiedUsers.length === 1 ? tiedUsers[0].name : 'Empate!';
            }
            const champions = movies.reduce((acc, m) => {
                if (m.isChampion && m.watchDate) {
                    acc[new Date(m.watchDate).toISOString().substring(0, 7)] = m;
                }
                return acc;
            }, {});
            const allUpcomingMovies = movies
                .filter(m => !m.watched && m.watchDate)
                .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());
            const upcomingMovies = allUpcomingMovies.slice(0, 3);
            const moviesPerMonth = movies.reduce((acc, m) => {
                if (m.watched && m.watchDate) {
                    const month = new Date(m.watchDate).toISOString().substring(0, 7);
                    acc[month] = (acc[month] || 0) + 1;
                }
                return acc;
            }, {});
            const monthlyRescuers = movies.reduce((acc, m) => {
                if (m.watchDate) {
                    const month = new Date(m.watchDate).toISOString().substring(0, 7);
                    const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
                    if (name.toLowerCase() !== 'ninguém' && name !== '' && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas') {
                        if (!acc[month])
                            acc[month] = {};
                        acc[month][name] = (acc[month][name] || 0) + 1;
                    }
                }
                return acc;
            }, {});
            const topRescuerByMonth = {};
            Object.entries(monthlyRescuers).forEach(([month, counts]) => {
                let max = 0;
                let tops = [];
                Object.entries(counts).forEach(([name, count]) => {
                    if (count > max) {
                        max = count;
                        tops = [name];
                    }
                    else if (count === max) {
                        tops.push(name);
                    }
                });
                if (max > 0) {
                    topRescuerByMonth[month] = { name: tops.length > 1 ? 'Empate' : tops[0], count: max, tooltip: tops.length > 1 ? tops.join(' / ') : tops[0] };
                }
            });
            const currentMonth = new Date().toISOString().substring(0, 7);
            const monthMovies = movies.filter(m => (m.watchDate ? new Date(m.watchDate).toISOString().substring(0, 7) : 'none') === currentMonth);
            let bestMovies = monthMovies.filter(m => m.watched && m.streamerRating === 10);
            if (bestMovies.length === 0)
                bestMovies = monthMovies.filter(m => m.watched && m.streamerRating === 9);
            const currentMonthRescuerCounts = monthMovies.reduce((acc, m) => {
                const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
            const currentMonthRanking = Object.entries(currentMonthRescuerCounts)
                .filter(([name]) => name.toLowerCase() !== 'ninguém' && name !== '' && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas')
                .map(([name, count]) => ({ name, count: count }))
                .sort((a, b) => b.count - a.count);
            let currentMonthTopRescuer = 'N/A';
            if (currentMonthRanking.length > 0) {
                const maxRescues = currentMonthRanking[0].count;
                const tiedUsers = currentMonthRanking.filter(r => r.count === maxRescues);
                currentMonthTopRescuer = tiedUsers.length > 1 ? 'Empate!' : tiedUsers[0].name;
            }
            return res.json({
                totalMovies, watchedMovies, unwatchedMovies, totalWatchHours, totalWatchDays,
                avgStreamerRating, avgChatRating, rankingForTop: filteredRanking,
                topRescuer, sumasData, chatData, filteredRanking, champions, allUpcomingMovies,
                upcomingMovies, moviesPerMonth, topRescuerByMonth, bestMovies,
                monthRanking: currentMonthRanking,
                monthTopRescuer: currentMonthTopRescuer,
                rawMoviesForGenre: movies // Retorna todos os filmes para o Frontend decidir
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao gerar estatísticas' });
        }
    }
    async getTmdbDetails(req, res) {
        const { id } = req.params; // tmdbId do filme
        try {
            const response = await axios_1.default.get(`https://api.themoviedb.org/3/movie/${id}`, {
                params: { language: 'pt-BR' },
                headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
            });
            return res.json(response.data);
        }
        catch (error) {
            console.error('Erro ao buscar detalhes no TMDB:', error.message);
            return res.status(500).json({ error: 'Erro ao buscar detalhes do filme' });
        }
    }
}
exports.MovieController = MovieController;
