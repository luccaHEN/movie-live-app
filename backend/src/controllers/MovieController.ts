import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';

export class MovieController {
  async search(req: Request, res: Response): Promise<Response | any> {
    const { query } = req.query;

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
    if (!process.env.TMDB_TOKEN) {
      return res.status(500).json({ error: 'Erro interno de configuração do servidor' });
    }

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/movie/popular`, {
        params: { language: 'pt-BR' },
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
    const { watchDate, streamerRating, chatRating, watched, requestedBy } = req.body;
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
          watchDate: watchDate ? new Date(watchDate) : undefined,
          streamerRating,
          chatRating,
          watched,
          requestedBy,
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