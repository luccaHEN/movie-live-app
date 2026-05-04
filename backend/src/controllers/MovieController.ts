import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';

export class MovieController {
  async search(req: Request, res: Response): Promise<Response | any> {
    const { query, page = 1 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'O parâmetro query é obrigatório' });
    }

    if (!process.env.TMDB_TOKEN) {
      console.error('ERRO: TMDB_TOKEN não está definido no arquivo .env');
      return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
    }

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
        params: {
          query: query as string,
          language: 'pt-BR',
          page
        },
        headers: {
          Authorization: `Bearer ${process.env.TMDB_TOKEN}`
        }
      });

      return res.json(response.data.results);
    } catch (error: any) {
      console.error('Detalhes do Erro TMDB:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Erro ao buscar filmes no TMDB', details: error.response?.data });
    }
  }

  async popular(req: Request, res: Response): Promise<Response | any> {
    const { page = 1 } = req.query;
    if (!process.env.TMDB_TOKEN) {
      return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
    }

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/movie/popular`, {
        params: { language: 'pt-BR', page },
        headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
      });
      return res.json(response.data.results);
    } catch (error: any) {
      console.error('Erro TMDB (Popular):', error.response?.data || error.message);
      return res.status(500).json({ error: 'Erro ao buscar filmes populares no TMDB' });
    }
  }

  async create(req: Request, res: Response): Promise<Response | any> {
    const { title, tmdbId, poster, genre, requestedBy, watchDate } = req.body;
    const userId = (req as any).userId; // Pegando o usuário que fez a requisição

    try {
      let movie = await prisma.movie.findFirst({ where: { tmdbId, userId } });
      if (!movie) {
        movie = await prisma.movie.create({ data: { title, tmdbId, poster, genre, userId, requestedBy, watchDate: watchDate ? new Date(watchDate) : null } });
      } else {
        // Se o filme já existir, atualizamos com o novo Nick e Data agendada
        movie = await prisma.movie.update({
          where: { id: movie.id },
          data: {
            requestedBy: requestedBy !== undefined ? requestedBy : movie.requestedBy,
            watchDate: watchDate ? new Date(watchDate) : (watchDate === null ? null : movie.watchDate)
          }
        });
      }
      return res.status(201).json(movie);
    } catch (error: any) {
      console.error('Erro detalhado ao salvar no Prisma:', error);
      return res.status(500).json({ error: 'Erro ao salvar o filme', details: error.message });
    }
  }

  async update(req: Request, res: Response): Promise<Response | any> {
    const { id } = req.params;
    const { watchDate, streamerRating, chatRating, watched, requestedBy, isChampion } = req.body;
    const userId = (req as any).userId;

    try {
      const movieId = parseInt(id as string, 10);

      // Verifica se o filme existe e pertence ao usuário logado
      const existingMovie = await prisma.movie.findFirst({ where: { id: movieId, userId } });
      if (!existingMovie) {
        return res.status(404).json({ error: 'Filme não encontrado.' });
      }

      // Atualiza os dados no banco de dados
      const updatedMovie = await prisma.movie.update({
        where: { id: movieId },
        data: {
          watchDate: watchDate !== undefined ? (watchDate ? new Date(watchDate) : null) : undefined,
          streamerRating,
          chatRating,
          watched,
          requestedBy,
          isChampion,
        }
      });
      return res.json(updatedMovie);
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao atualizar o filme', details: error.message });
    }
  }

  async index(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId; // Pegando o usuário que fez a requisição

    try {
      const movies = await prisma.movie.findMany({ where: { userId } });
      return res.json(movies);
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao buscar os filmes salvos' });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    const { id } = req.params; // O ID do filme virá nos parâmetros da URL
    const userId = (req as any).userId; // Pegando o usuário que fez a requisição

    try {
      const movieId = parseInt(id as string, 10); // Converte o ID para número

      // deleteMany permite passar múltiplos filtros e checar se algo foi deletado
      const result = await prisma.movie.deleteMany({
        where: { id: movieId, userId },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: 'Filme não encontrado ou você não tem permissão para deletá-lo' });
      }

      // Retorna 204 No Content para indicar sucesso na exclusão sem corpo de resposta
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao deletar o filme', details: error.message });
    }
  }

  async stats(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    try {
      const movies = await prisma.movie.findMany({ where: { userId } });

      const totalMovies = movies.length;
      const watchedMoviesList = movies.filter(m => m.watched);
      const watchedMovies = watchedMoviesList.length;
      const unwatchedMovies = totalMovies - watchedMovies;

      const totalWatchMinutes = watchedMoviesList.reduce((acc, m) => acc + 105, 0); // Estimativa padrão
      const totalWatchHours = Math.floor(totalWatchMinutes / 60);
      const totalWatchDays = (totalWatchHours / 24).toFixed(1);

      const streamerRatings = movies.filter(m => m.streamerRating != null).map(m => m.streamerRating as number);
      const avgStreamerRating = streamerRatings.length ? (streamerRatings.reduce((a, b) => a + b, 0) / streamerRatings.length).toFixed(1) : 'N/A';

      const chatRatings = movies.filter(m => m.chatRating != null).map(m => m.chatRating as number);
      const avgChatRating = chatRatings.length ? (chatRatings.reduce((a, b) => a + b, 0) / chatRatings.length).toFixed(1) : 'N/A';

      const rescuerCounts = movies.reduce((acc, m) => {
        const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ranking = Object.entries(rescuerCounts)
        .filter(([name]) => name.toLowerCase() !== 'ninguém' && name !== '')
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => {
          if (a.name.toLowerCase() === 'chat') return 1;
          if (b.name.toLowerCase() === 'chat') return -1;
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
      }, {} as Record<string, any>);

      const allUpcomingMovies = movies
        .filter(m => !m.watched && m.watchDate)
        .sort((a, b) => new Date(a.watchDate as Date).getTime() - new Date(b.watchDate as Date).getTime());

      const upcomingMovies = allUpcomingMovies.slice(0, 3);

      const moviesPerMonth = movies.reduce((acc, m) => {
        if (m.watched && m.watchDate) {
          const month = new Date(m.watchDate).toISOString().substring(0, 7);
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const monthlyRescuers = movies.reduce((acc, m) => {
        if (m.watchDate) {
          const month = new Date(m.watchDate).toISOString().substring(0, 7);
          const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
          if (name.toLowerCase() !== 'ninguém' && name !== '' && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas') {
            if (!acc[month]) acc[month] = {};
            acc[month][name] = (acc[month][name] || 0) + 1;
          }
        }
        return acc;
      }, {} as Record<string, Record<string, number>>);

      const topRescuerByMonth: Record<string, {name: string, count: number, tooltip: string}> = {};
      Object.entries(monthlyRescuers).forEach(([month, counts]) => {
        let max = 0;
        let tops: string[] = [];
        Object.entries(counts as Record<string, number>).forEach(([name, count]) => {
          if (count > max) { max = count; tops = [name]; } 
          else if (count === max) { tops.push(name); }
        });
        if (max > 0) {
          topRescuerByMonth[month] = { name: tops.length > 1 ? 'Empate' : tops[0], count: max, tooltip: tops.length > 1 ? tops.join(' / ') : tops[0] };
        }
      });

      const currentMonth = new Date().toISOString().substring(0, 7);
      const monthMovies = movies.filter(m => (m.watchDate ? new Date(m.watchDate).toISOString().substring(0, 7) : 'none') === currentMonth);
      let bestMovies = monthMovies.filter(m => m.watched && m.streamerRating === 10);
      if (bestMovies.length === 0) bestMovies = monthMovies.filter(m => m.watched && m.streamerRating === 9);

      const currentMonthRescuerCounts = monthMovies.reduce((acc, m) => {
        const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const currentMonthRanking = Object.entries(currentMonthRescuerCounts)
        .filter(([name]) => name.toLowerCase() !== 'ninguém' && name !== '' && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas')
        .map(([name, count]) => ({ name, count: count as number }))
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
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao gerar estatísticas' });
    }
  }

  async getTmdbDetails(req: Request, res: Response): Promise<Response | any> {
    const { id } = req.params; // tmdbId do filme

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
        params: { language: 'pt-BR' },
        headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
      });

      return res.json(response.data);
    } catch (error: any) {
      console.error('Erro ao buscar detalhes no TMDB:', error.message);
      return res.status(500).json({ error: 'Erro ao buscar detalhes do filme' });
    }
  }
}