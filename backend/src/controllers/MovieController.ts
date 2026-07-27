import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';
import { GoogleGenAI } from '@google/genai';

async function sendPushToFollowers(streamerName: string, title: string, message: string, extraData: any = {}) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) return;

  try {
    const followers = await prisma.user.findMany({
      where: {
        followedStreamersList: { has: streamerName }
      }
    });

    const playerIds = followers
      .map(f => f.oneSignalPlayerId)
      .filter((id): id is string => id != null && id !== '');

    if (playerIds.length === 0) return;

    const appId = process.env.ONESIGNAL_APP_ID.replace(/["']/g, '').trim();
    const apiKey = process.env.ONESIGNAL_REST_API_KEY.replace(/["']/g, '').trim();

    await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: appId,
        include_player_ids: playerIds,
        headings: { "en": title, "pt": title },
        contents: { "en": message, "pt": message },
        data: { streamerName: streamerName, ...extraData }
      },
      { headers: { Authorization: `Basic ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao enviar push via OneSignal:', error);
  }
}

// ============================================================
// SISTEMA DE BUSCA INTELIGENTE
// ============================================================

// Função auxiliar para normalizar a query de busca
function normalizeQuery(query: string): string {
  return query
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(o |a |os |as |um |uma |uns |umas |the |an? )/i, '')
    .trim();
}

// Extrai filmes de resultados do /search/multi
function extractMoviesFromMultiResults(results: any[]): any[] {
  const movies: any[] = [];
  for (const item of results) {
    if (item.media_type === 'movie') {
      movies.push(item);
    } else if (item.media_type === 'person' && Array.isArray(item.known_for)) {
      for (const work of item.known_for) {
        if (work.media_type === 'movie') {
          movies.push(work);
        }
      }
    }
  }
  return movies;
}

export class MovieController {

  async search(req: Request, res: Response): Promise<Response | any> {
    const { query, page = 1, genre } = req.query;

    if (!query && !genre) {
      return res.status(400).json({ error: 'O parâmetro query ou genre é obrigatório' });
    }

    if (!process.env.TMDB_TOKEN) {
      console.error('ERRO: TMDB_TOKEN não está definido no arquivo .env');
      return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
    }

    try {
      if (!query && genre) {
        const response = await axios.get(`https://api.themoviedb.org/3/discover/movie`, {
          params: {
            with_genres: genre,
            language: 'pt-BR',
            page,
            sort_by: 'popularity.desc'
          },
          headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
        });
        return res.json(response.data.results);
      }

      const rawQuery = query as string;
      const normalizedQuery = normalizeQuery(rawQuery);

      // ------ PASSO 1: Busca normal no TMDB ------
      const searchPromises = [
        axios.get(`https://api.themoviedb.org/3/search/multi`, {
          params: { query: rawQuery, language: 'pt-BR', page, include_adult: false },
          headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
        }),
        axios.get(`https://api.themoviedb.org/3/search/multi`, {
          params: { query: rawQuery, language: 'en-US', page, include_adult: false },
          headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
        })
      ];

      if (normalizedQuery.toLowerCase() !== rawQuery.toLowerCase().trim()) {
        searchPromises.push(
          axios.get(`https://api.themoviedb.org/3/search/multi`, {
            params: { query: normalizedQuery, language: 'pt-BR', page, include_adult: false },
            headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
          })
        );
      }

      const responses = await Promise.all(searchPromises);

      let results: any[] = [];
      for (const response of responses) {
        const movies = extractMoviesFromMultiResults(response.data.results);
        results.push(...movies);
      }

      // ------ PASSO 2: Auto-correção com Google Gemini AI ------
      // Se a busca normal retornou poucos resultados, pedimos para a IA corrigir o nome
      if (results.length < 15 && page == 1 && process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const prompt = `Você é um corretor de nomes de filmes.
O usuário digitou: "${rawQuery}"
Descubra qual é o filme, ator ou série que o usuário quis dizer.
Responda APENAS com o nome correto. Sem pontos, sem aspas, sem texto adicional. Retorne apenas a palavra base da franquia caso seja um filme com subtítulo (ex: "Vingadores: Ultimato" -> "Vingadores"). Se já estiver correto ou você não souber, devolva exatamente a mesma palavra.`;

          const aiResponse = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: prompt,
          });

          const correctedTitle = aiResponse.text?.trim();

          if (correctedTitle && correctedTitle.toLowerCase() !== rawQuery.toLowerCase()) {
            console.log(`[SmartSearch AI] Corrigindo "${rawQuery}" → "${correctedTitle}"`);

            const correctedResponses = await Promise.all([
              axios.get(`https://api.themoviedb.org/3/search/multi`, {
                params: { query: correctedTitle, language: 'pt-BR', page, include_adult: false },
                headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
              }),
              axios.get(`https://api.themoviedb.org/3/search/multi`, {
                params: { query: correctedTitle, language: 'en-US', page, include_adult: false },
                headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
              })
            ]);

            for (const response of correctedResponses) {
              const movies = extractMoviesFromMultiResults(response.data.results);
              results.push(...movies);
            }
          }
        } catch (aiError) {
          console.error('[SmartSearch AI] Erro ao consultar o Gemini:', aiError);
        }
      }

      // Remove duplicatas mantendo a ordem de relevância
      const uniqueResults = [];
      const ids = new Set();
      for (const movie of results) {
        if (!ids.has(movie.id)) {
          ids.add(movie.id);
          uniqueResults.push(movie);
        }
      }

      // Filtra por gênero se tiver
      let finalResults = uniqueResults;
      if (genre) {
        finalResults = finalResults.filter(m => m.genre_ids && m.genre_ids.includes(parseInt(genre as string)));
      }

      return res.json(finalResults);
    } catch (error: any) {
      console.error('Detalhes do Erro TMDB:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Erro ao buscar filmes no TMDB', details: error.response?.data });
    }
  }

  async reorder(req: Request, res: Response): Promise<Response | any> {
    const { updates } = req.body;
    const userId = (req as any).userId;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Formato inválido para reordenação.' });
    }

    try {
      const transactions = updates.map((update: any) =>
        prisma.movie.update({
          where: { id: update.id, userId },
          data: { watchDate: new Date(update.watchDate) }
        })
      );

      await prisma.$transaction(transactions);

      return res.json({ message: 'Ordem atualizada com sucesso.' });
    } catch (error: any) {
      console.error('Erro ao reordenar:', error);
      return res.status(500).json({ error: 'Erro ao reordenar filmes', details: error.message });
    }
  }

  async popular(req: Request, res: Response): Promise<Response | any> {
    const { page = 1, genre } = req.query;
    if (!process.env.TMDB_TOKEN) {
      return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
    }

    try {
      let url = `https://api.themoviedb.org/3/movie/popular`;
      const params: any = { language: 'pt-BR', page };

      if (genre) {
        url = `https://api.themoviedb.org/3/discover/movie`;
        params.with_genres = genre;
        params.sort_by = 'popularity.desc';
      }

      const response = await axios.get(url, {
        params,
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
      let runtime = null;
      let finalGenre = genre;
      
      if (tmdbId) {
        try {
          const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?language=pt-BR`, {
            headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` }
          });
          runtime = tmdbRes.data.runtime || null;
          if (tmdbRes.data.genres && tmdbRes.data.genres.length > 0) {
            finalGenre = tmdbRes.data.genres.map((g: any) => g.name).join(', ');
          }
        } catch (e) {
          console.error('Erro ao buscar detalhes adicionais do TMDB na criação');
        }
      }

      let movie = await prisma.movie.findFirst({ where: { tmdbId, userId } });
      if (!movie) {
        movie = await prisma.movie.create({ data: { title, tmdbId, poster, genre: finalGenre, runtime, userId, requestedBy, watchDate: watchDate ? new Date(watchDate) : null } });
      } else {
        // Se o filme já existir, atualizamos com o novo Nick e Data agendada
        movie = await prisma.movie.update({
          where: { id: movie.id },
          data: {
            requestedBy: requestedBy !== undefined ? requestedBy : movie.requestedBy,
            watchDate: watchDate ? new Date(watchDate) : (watchDate === null ? null : movie.watchDate),
            runtime: runtime || movie.runtime,
            genre: finalGenre || movie.genre
          }
        });
      }
      
      // Envia notificação para seguidores
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.name) {
        await sendPushToFollowers(
          user.name,
          'Novo filme na agenda! 🎬',
          `${user.name} adicionou "${movie.title}" à agenda de lives!`,
          { movieTitle: movie.title, isWatched: false }
        );
      }

      return res.status(201).json(movie);
    } catch (error: any) {
      console.error('Erro detalhado ao salvar no Prisma:', error);
      return res.status(500).json({ error: 'Erro ao salvar o filme', details: error.message });
    }
  }

  async update(req: Request, res: Response): Promise<Response | any> {
    const { id } = req.params;
    const { watchDate, streamerRating, chatRating, watched, requestedBy, isChampion, isTrash } = req.body;
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
          isTrash,
        }
      });

      // Envia notificação de alteração para seguidores
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.name && existingMovie) {
        if (watched && !existingMovie.watched) {
          await sendPushToFollowers(
            user.name,
            'Filme Assistido! ✅',
            `${user.name} acabou de assistir "${updatedMovie.title}"!`,
            { movieTitle: updatedMovie.title, isWatched: true }
          );
        } else if (watchDate && existingMovie.watchDate !== watchDate) {
          await sendPushToFollowers(
            user.name,
            'Agenda Atualizada 📅',
            `${user.name} alterou a data de "${updatedMovie.title}".`,
            { movieTitle: updatedMovie.title, isWatched: existingMovie.watched }
          );
        }
      }

      return res.json(updatedMovie);
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao atualizar o filme', details: error.message });
    }
  }

  async index(req: Request, res: Response): Promise<Response | any> {
    const userId = (req as any).userId;
    const { page, limit, status, sortBy, month, search, genre } = req.query;

    try {
      if (page) {
        const pageNum = parseInt(page as string, 10);
        const limitNum = Math.min(parseInt((limit as string) || '35', 10), 100);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { userId };
        
        if (status === 'WATCHED') where.watched = true;
        if (status === 'UNWATCHED') where.watched = false;

        if (month && month !== 'ALL') {
          if (month === 'none') {
            where.watchDate = null;
          } else {
            const year = parseInt((month as string).split('-')[0], 10);
            const monthNum = parseInt((month as string).split('-')[1], 10);
            const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
            const endDate = new Date(Date.UTC(year, monthNum, 1));
            where.watchDate = { gte: startDate, lt: endDate };
          }
        }

        if (search) {
          where.OR = [
            { title: { contains: search as string, mode: 'insensitive' } },
            { requestedBy: { contains: search as string, mode: 'insensitive' } }
          ];
        }

        if (genre && genre !== 'ALL') {
          const genresToMatch = (genre as string).split(',').map(g => g.trim()).filter(g => g);
          if (genresToMatch.length > 0) {
            const genreConditions = genresToMatch.map(g => ({
              genre: { contains: g, mode: 'insensitive' }
            }));
            
            if (where.AND) {
              where.AND.push(...genreConditions);
            } else {
              where.AND = genreConditions;
            }
          }
        }

        let orderBy: any = {};
        if (sortBy === 'ALPHA') orderBy = { title: 'asc' };
        else if (sortBy === 'RATING_DESC') {
          where.streamerRating = { not: null };
          orderBy = { streamerRating: 'desc' };
        }
        else if (sortBy === 'RATING_ASC') {
          where.streamerRating = { not: null };
          orderBy = { streamerRating: 'asc' };
        }
        else orderBy = { watchDate: 'asc' };

        // Select only needed fields to reduce data transfer
        const movieSelect = {
          id: true,
          title: true,
          tmdbId: true,
          poster: true,
          genre: true,
          runtime: true,
          userId: true,
          watched: true,
          watchDate: true,
          streamerRating: true,
          chatRating: true,
          requestedBy: true,
          isChampion: true,
          isTrash: true,
        };

        // Run all queries in parallel for page 1
        if (pageNum === 1) {
          let [movies, total, totalMovies, watchedMovies, allFilterData] = await prisma.$transaction([
            prisma.movie.findMany({ where, orderBy, skip, take: limitNum, select: movieSelect }),
            prisma.movie.count({ where }),
            prisma.movie.count({ where: { userId } }),
            prisma.movie.count({ where: { userId, watched: true } }),
            prisma.movie.findMany({
              where: { userId },
              select: { watchDate: true, genre: true }
            })
          ]);

          // --- Início: Smart Search (Correção de Busca) para "Meus Filmes" ---
          if (total === 0 && search && process.env.GEMINI_API_KEY) {
            try {
              const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const prompt = `Você é um corretor. O usuário procurou na própria lista de filmes salvos por: "${search}"
Adivinhe qual filme, série, ator ou apelido ele tentou digitar. Responda APENAS com o nome corrigido. Sem aspas ou pontuações.`;
              
              const aiResponse = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: prompt,
              });
              
              const correctedTitle = aiResponse.text?.trim();
              
              if (correctedTitle && correctedTitle.toLowerCase() !== (search as string).toLowerCase()) {
                console.log(`[SmartSearch Local] Corrigindo "${search}" → "${correctedTitle}"`);
                
                // Atualiza a query do Prisma com o novo termo
                where.OR = [
                  { title: { contains: correctedTitle, mode: 'insensitive' } },
                  { requestedBy: { contains: correctedTitle, mode: 'insensitive' } }
                ];
                
                // Refaz APENAS a busca e a contagem (stats já temos)
                const [newMovies, newTotal] = await prisma.$transaction([
                  prisma.movie.findMany({ where, orderBy, skip, take: limitNum, select: movieSelect }),
                  prisma.movie.count({ where })
                ]);
                
                movies = newMovies;
                total = newTotal;
              }
            } catch (e) {
              console.error('[SmartSearch Local] Erro no Gemini:', e);
            }
          }
          // --- Fim: Smart Search ---

          const uniqueMonths = Array.from(new Set(allFilterData.map(m => m.watchDate ? m.watchDate.toISOString().substring(0, 7) : 'none')));
          
          const allGenresSet = new Set<string>();
          allFilterData.forEach(m => {
            if (m.genre) {
              m.genre.split(',').forEach(g => {
                const trimmed = g.trim();
                if (trimmed) allGenresSet.add(trimmed);
              });
            }
          });
          const uniqueGenres = Array.from(allGenresSet).sort((a, b) => a.localeCompare(b));

          return res.json({
            data: movies,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            stats: { total: totalMovies, watched: watchedMovies },
            uniqueMonths,
            uniqueGenres
          });
        }

        // For subsequent pages, only fetch movies + count (no stats/filters)
        const [movies, total] = await prisma.$transaction([
          prisma.movie.findMany({ where, orderBy, skip, take: limitNum, select: movieSelect }),
          prisma.movie.count({ where })
        ]);

        return res.json({
          data: movies,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        });
      }

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

      // Pega o nome do filme antes de deletar
      const movieToDelete = await prisma.movie.findFirst({ where: { id: movieId, userId } });

      // deleteMany permite passar múltiplos filtros e checar se algo foi deletado
      const result = await prisma.movie.deleteMany({
        where: { id: movieId, userId },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: 'Filme não encontrado ou você não tem permissão para deletá-lo' });
      }

      if (movieToDelete) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.name) {
          await sendPushToFollowers(
            user.name,
            'Filme removido 🗑️',
            `${user.name} retirou "${movieToDelete.title}" da agenda.`
          );
        }
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

      const totalWatchMinutes = watchedMoviesList.reduce((acc, m) => acc + (m.runtime || 105), 0);
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