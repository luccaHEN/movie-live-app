import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface MovieSearchProps {
  token: string;
}

export default function MovieSearch({ token }: MovieSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { requestedBy?: string, watchDate?: string }>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchPopular = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/movies/popular', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data);
    } catch (error) {
      console.error("Erro ao buscar filmes populares:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPopular();
  }, [token]);

  // Efeito de Debounce para buscar enquanto o usuário digita
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        fetchPopular();
      }
    }, 600); // 600ms de atraso

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  const performSearch = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.get(`/movies/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data);
    } catch (error) {
      toast.error("Erro ao buscar filmes. Seu login pode ter expirado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // O debounce já fará a busca, mas deixamos aqui caso o usuário aperte 'Enter' rápido demais
    if (searchQuery.trim()) performSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchPopular(); // Volta a mostrar os filmes populares
  };

  const handleSaveMovie = async (movie: any) => {
    const draft = drafts[movie.id] || {};

    // Validação para tornar os campos obrigatórios
    if (!draft.requestedBy || draft.requestedBy.trim() === '') {
      toast.error('Por favor, preencha quem resgatou o filme.');
      return;
    }
    if (!draft.watchDate) {
      toast.error('Por favor, selecione uma data para assistir o filme.');
      return;
    }

    // Monta o pacote de dados básico do filme
    const payload: any = {
      title: movie.title, 
      tmdbId: movie.id, 
      poster: movie.poster_path, 
      genre: "N/A",
      requestedBy: draft.requestedBy.trim(),
      watchDate: draft.watchDate
    };

    try {
      await api.post('/movies', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Filme "${movie.title}" salvo com sucesso!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar o filme.');
    }
  };

  // Função para buscar os detalhes completos do filme no TMDB
  const handleShowDetails = async (tmdbId: number) => {
    if (!tmdbId) return;
    try {
      const response = await api.get(`/movies/tmdb/${tmdbId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMovieDetails(response.data);
    } catch (error) {
      toast.error("Erro ao buscar detalhes do filme.");
    }
  };

  const formatRuntime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <>
      <form onSubmit={handleSearch} className="search-form">
        <input type="text" placeholder="Ex: Batman..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '400px' }} />
        <button type="button" className="btn-secondary" onClick={handleClearSearch}>Limpar / Populares</button>
      </form>
      {isLoading ? (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Buscando... 🍿</p>
      ) : (
        <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', width: '100%', gap: '20px' }}>
          {movies.map(movie => (
          <div key={movie.id} className="movie-card">
            {/* Capa e título agora são clicáveis */}
            <div onClick={() => handleShowDetails(movie.id)} className="movie-card-header" title="Ver Detalhes">
              <p className="movie-title">{movie.title}</p>
              {movie.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} className="movie-poster" />
              ) : (
                <div className="movie-poster-placeholder"><span>Sem capa</span></div>
              )}
            </div>
            
            <label className="input-label">
              Resgatado por:
              <input type="text" placeholder="Ex: viewer123" value={drafts[movie.id]?.requestedBy || ''} onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], requestedBy: e.target.value } })} />
            </label>
            <label className="input-label" style={{ marginBottom: '15px' }}>
              Agendar para:
              <input type="date" value={drafts[movie.id]?.watchDate || ''} onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], watchDate: e.target.value } })} />
            </label>

            <button onClick={() => handleSaveMovie(movie)} className="btn-success" style={{ marginTop: 'auto' }}>Salvar Filme</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Flutuante com os Detalhes do Filme */}
      {selectedMovieDetails && (
        <div onClick={() => setSelectedMovieDetails(null)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content">
            <button onClick={() => setSelectedMovieDetails(null)} className="close-btn">&times;</button>
            <h2>{selectedMovieDetails.title}</h2>
            <p style={{ margin: '5px 0' }}><strong>Lançamento:</strong> {selectedMovieDetails.release_date ? new Date(selectedMovieDetails.release_date).getFullYear() : 'N/A'}</p>
            <p style={{ margin: '5px 0' }}><strong>Duração:</strong> {selectedMovieDetails.runtime ? formatRuntime(selectedMovieDetails.runtime) : 'N/A'}</p>
            <p style={{ margin: '5px 0' }}><strong>Gêneros:</strong> {selectedMovieDetails.genres?.map((g: any) => g.name).join(', ')}</p>
            <p style={{ margin: '5px 0' }}><strong>Nota TMDB:</strong> {selectedMovieDetails.vote_average ? `${selectedMovieDetails.vote_average.toFixed(1)} / 10` : 'N/A'}</p>
            <p style={{ marginTop: '15px', lineHeight: '1.5' }}><strong>Sinopse:</strong><br/>{selectedMovieDetails.overview || 'Nenhuma sinopse disponível para este filme.'}</p>
          </div>
        </div>
      )}
    </>
  );
}