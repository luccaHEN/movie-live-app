import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';
import Modal from './Modal';
import { ArrowUp, Star, Search } from 'lucide-react';

const TMDB_GENRES: Record<number, string> = {
  28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
  99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia", 36: "História",
  27: "Terror", 10402: "Música", 9648: "Mistério", 10749: "Romance", 878: "Ficção científica",
  10770: "Cinema TV", 53: "Thriller", 10752: "Guerra", 37: "Faroeste"
};

interface MovieSearchProps {
  token: string;
  streamerMode: boolean;
}

export default function MovieSearch({ token, streamerMode }: MovieSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [movies, setMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [savedMoviesMap, setSavedMoviesMap] = useState<Record<number, string | number>>({});
  const [movieToRemove, setMovieToRemove] = useState<{ id: number, title: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { requestedBy?: string, watchDate?: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const currentRequestRef = useRef(0); // Referência para controlar a condição de corrida

  const fetchPopular = async (pageNum = 1, genreStr = selectedGenre) => {
    const requestId = ++currentRequestRef.current;
    try {
      setIsLoading(true);
      const genreQuery = genreStr ? `&genre=${genreStr}` : '';
      const response = await api.get(`/movies/popular?page=${pageNum}${genreQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Se uma nova requisição foi feita enquanto esta carregava, ignoramos os dados antigos
      if (requestId !== currentRequestRef.current) return;

      const validMovies = response.data.filter((m: any) => m.poster_path);
      // Se não retornou nada, é porque a lista acabou
      if (response.data.length === 0) setHasMore(false);
      
      // Se for a página 1, substitui. Se for > 1, junta com a lista filtrando duplicatas.
      setMovies(prev => {
        if (pageNum === 1) return validMovies;
        const existingIds = new Set(prev.map(m => m.id));
        const newMovies = validMovies.filter((m: any) => !existingIds.has(m.id));
        return [...prev, ...newMovies];
      });
    } catch (error) {
      if (requestId === currentRequestRef.current) console.error("Erro ao buscar filmes populares:", error);
    } finally {
      if (requestId === currentRequestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch, we don't have genre yet
    fetchPopular(1, '');
  }, [token]);

  // Detecta a rolagem para mostrar o botão de Voltar ao Topo
  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      setShowScrollTop(target.scrollTop > 300);
    };
    mainContent?.addEventListener('scroll', handleScroll);
    return () => mainContent?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Busca a lista de IDs de filmes que o usuário já salvou
  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await api.get('/movies', { headers: { Authorization: `Bearer ${token}` } });
        const map: Record<number, string | number> = {};
        res.data.forEach((m: any) => {
          if (m.tmdbId) map[m.tmdbId] = m.id;
        });
        setSavedMoviesMap(map);
      } catch (e) {}
    };
    fetchSaved();
  }, [token]);

  // Efeito de Debounce para buscar enquanto o usuário digita
  useEffect(() => {
    // Se for o render inicial, não fazemos a busca dupla pois o outro useEffect já cuidou,
    // mas o debounce cobre isso de qualquer forma substituindo.
    const delayDebounceFn = setTimeout(() => {
      setPage(1); // Reinicia a paginação na nova busca
      setHasMore(true);
      if (searchQuery.trim() || selectedGenre) {
        if (searchQuery.trim()) {
          performSearch(searchQuery, 1, selectedGenre);
        } else {
          // Se tiver só gênero, buscamos nos populares (que agora no backend cai no discover)
          fetchPopular(1, selectedGenre);
        }
        scrollToTop();
      } else {
        fetchPopular(1, '');
        scrollToTop();
      }
    }, 600); // 600ms de atraso

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedGenre, token]);

  // Efeito para carregar mais páginas quando o 'page' mudar (Rolagem Infinita)
  useEffect(() => {
    if (page === 1) return; // A página 1 já é tratada pelo debounce ou load inicial
    if (searchQuery.trim()) {
      performSearch(searchQuery, page, selectedGenre);
    } else {
      fetchPopular(page, selectedGenre);
    }
  }, [page]);

  // Observador para detectar quando o usuário chegou no elemento final da página
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoading && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    }, { threshold: 1.0 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore]);

  const performSearch = async (query: string, pageNum = 1, genreStr = '') => {
    const requestId = ++currentRequestRef.current;
    setIsLoading(true);
    try {
      const genreQuery = genreStr ? `&genre=${genreStr}` : '';
      const response = await api.get(`/movies/search?query=${query}&page=${pageNum}${genreQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (requestId !== currentRequestRef.current) return;

      const validMovies = response.data.filter((m: any) => m.poster_path);
      if (response.data.length === 0) setHasMore(false);
      
      setMovies(prev => {
        if (pageNum === 1) return validMovies;
        const existingIds = new Set(prev.map(m => m.id));
        const newMovies = validMovies.filter((m: any) => !existingIds.has(m.id));
        return [...prev, ...newMovies];
      });
    } catch (error) {
      if (requestId === currentRequestRef.current) toast.error("Erro ao buscar filmes. Seu login pode ter expirado.");
    } finally {
      if (requestId === currentRequestRef.current) setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // O debounce já fará a busca, mas deixamos aqui caso o usuário aperte 'Enter' rápido demais
    if (searchQuery.trim() || selectedGenre) {
      if (searchQuery.trim()) performSearch(searchQuery, 1, selectedGenre);
      else fetchPopular(1, selectedGenre);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setPage(1);
    setHasMore(true);
    fetchPopular(1, ''); // Volta a mostrar os filmes populares
    scrollToTop();
  };

  const handleSaveMovie = async (movie: any) => {
    const draft = drafts[movie.id] || {};

    // Validação para tornar os campos obrigatórios
    if (streamerMode) {
      if (!draft.requestedBy || draft.requestedBy.trim() === '') {
        toast.error('Por favor, preencha quem resgatou o filme.');
        return;
      }
    }

    const movieGenres = movie.genre_ids ? movie.genre_ids.map((id: number) => TMDB_GENRES[id]).filter(Boolean).join(', ') : "Desconhecido";

    // Monta o pacote de dados básico do filme
    const payload: any = {
      title: movie.title, 
      tmdbId: movie.id, 
      poster: movie.poster_path, 
      genre: movieGenres || "Desconhecido",
    };

    if (streamerMode) {
      payload.requestedBy = draft.requestedBy?.trim() || '';
      payload.watchDate = draft.watchDate || null;
    }

    try {
      const res = await api.post('/movies', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Filme "${movie.title}" salvo com sucesso!`);
      setSavedMoviesMap(prev => ({ ...prev, [movie.id]: res.data.id }));
      window.dispatchEvent(new Event('moviesUpdated'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar o filme.');
    }
  };

  const handleRemoveMovieClick = (tmdbId: number, title: string) => {
    setMovieToRemove({ id: tmdbId, title });
  };

  const confirmRemoveMovie = async () => {
    if (!movieToRemove) return;
    const dbId = savedMoviesMap[movieToRemove.id];
    if (!dbId) return;
    try {
      await api.delete(`/movies/${dbId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Filme "${movieToRemove.title}" removido da lista.`);
      setSavedMoviesMap(prev => {
        const newMap = { ...prev };
        delete newMap[movieToRemove.id];
        return newMap;
      });
      window.dispatchEvent(new Event('moviesUpdated'));
      setMovieToRemove(null);
    } catch (error) {
      toast.error('Erro ao remover o filme.');
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

  const displayedMovies = movies; // A filtragem de gênero agora é feita no backend!

  return (
    <>
      <style>
        {`
          .premium-search-container {
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 12px 25px;
            border-radius: 50px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            width: 100%;
            max-width: 800px;
            margin: 0 auto 40px auto;
          }
          .premium-search-container:focus-within {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 8px 32px 0 rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.25);
            transform: translateY(-3px);
          }
          .premium-search-input {
            flex: 1;
            background: transparent;
            border: none;
            color: #fff;
            font-size: 1.15rem;
            outline: none;
            padding: 5px 0;
            width: 100%;
          }
          .premium-search-input:focus {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .premium-search-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
            font-weight: 300;
          }
          .premium-search-icon {
            color: rgba(255, 255, 255, 0.4);
            transition: color 0.4s ease, transform 0.4s ease;
          }
          .premium-search-container:focus-within .premium-search-icon {
            color: #3b82f6;
            transform: scale(1.1);
          }
          .premium-genre-select {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.7);
            font-size: 1.05rem;
            outline: none;
            cursor: pointer;
            padding: 5px 10px;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            transition: color 0.3s;
          }
          .premium-genre-select:hover, .premium-genre-select:focus {
            color: #fff;
          }
          .premium-genre-select option {
            background-color: var(--bg-color);
            color: var(--text-color);
          }
          .premium-clear-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #aaa;
            cursor: pointer;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            padding: 0;
            font-size: 18px;
          }
          .premium-clear-btn:hover {
            background: var(--danger);
            border-color: var(--danger);
            color: #fff;
            transform: rotate(90deg);
          }
        `}
      </style>

      <form onSubmit={handleSearch} className="premium-search-container">
        <Search className="premium-search-icon" size={24} />
        <input 
          type="text" 
          className="premium-search-input"
          placeholder="Ex: Batman, Interestelar, Matrix..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
        <select className="premium-genre-select" value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)}>
          <option value="">Todos os Gêneros</option>
          {Object.entries(TMDB_GENRES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {(searchQuery || selectedGenre) && (
          <button type="button" className="premium-clear-btn" onClick={handleClearSearch} title="Limpar busca">
            &times;
          </button>
        )}
      </form>
      
        <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', width: '100%', maxWidth: '100%', gap: '20px' }}>
          {displayedMovies.length === 0 && (searchQuery.trim() !== '' || selectedGenre !== '') && !isLoading ? (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px', color: '#aaa' }}>Nenhum filme encontrado com esse filtro 😥</p>
          ) : displayedMovies.map(movie => (
          <div key={movie.id} className="movie-card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            {/* Capa e título agora são clicáveis */}
            <div onClick={() => handleShowDetails(movie.id)} className="movie-card-header" title="Ver Detalhes">
              <p className="movie-title">
                {movie.title} <span style={{ fontSize: '0.8em', color: '#aaa', fontWeight: 'normal' }}>{movie.release_date ? `(${movie.release_date.substring(0,4)})` : ''}</span>
              </p>
              <div style={{ position: 'relative' }}>
                {movie.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} className="movie-poster" style={{ height: 'auto', aspectRatio: '2/3', display: 'block' }} />
                ) : (
                  <div className="movie-poster-placeholder" style={{ height: 'auto', aspectRatio: '2/3' }}><span>Sem capa</span></div>
                )}
                {movie.vote_average > 0 && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 'bold', color: '#fbbf24', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                    <Star size={14} fill="#fbbf24" /> {movie.vote_average.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
              {streamerMode && (
                <>
                  <label className="input-label" style={{ opacity: savedMoviesMap[movie.id] ? 0.5 : 1 }}>
                    Resgatado por:
                    <input 
                      type="text" 
                      placeholder="Ex: viewer123" 
                      value={drafts[movie.id]?.requestedBy || ''} 
                      onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], requestedBy: e.target.value } })}
                      disabled={!!savedMoviesMap[movie.id]}
                      style={{ cursor: savedMoviesMap[movie.id] ? 'not-allowed' : 'text' }}
                    />
                  </label>
                  <label className="input-label" style={{ opacity: savedMoviesMap[movie.id] ? 0.5 : 1 }}>
                    Agendar para:
                    <input 
                      type="date" 
                      value={drafts[movie.id]?.watchDate || ''} 
                      onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], watchDate: e.target.value } })}
                      disabled={!!savedMoviesMap[movie.id]}
                      style={{ cursor: savedMoviesMap[movie.id] ? 'not-allowed' : 'text' }}
                    />
                  </label>
                </>
              )}
              {savedMoviesMap[movie.id] ? (
                <button 
                  onClick={() => handleRemoveMovieClick(movie.id, movie.title)}
                  className="btn-danger" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  title="Clique para remover"
                >
                  Remover
                </button>
              ) : (
                <button onClick={() => handleSaveMovie(movie)} className="btn-success" style={{ width: '100%' }}>
                  Salvar Filme
                </button>
              )}
            </div>
            </div>
          ))}
          {isLoading && Array.from({ length: 20 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
          ))}
        </div>


      
      {/* Elemento invisível no final da lista que funciona como "gatilho" para carregar mais */}
      {!isLoading && hasMore && movies.length > 0 && (
        <div ref={loaderRef} style={{ height: '20px', width: '100%' }}></div>
      )}

      {/* Modal Flutuante com os Detalhes do Filme */}
      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />

      {/* Modal Customizado de Confirmação de Remoção */}
      <Modal isOpen={!!movieToRemove} onClose={() => setMovieToRemove(null)} maxWidth="400px">
        <h3 style={{ marginTop: 0, color: 'var(--danger)', textAlign: 'center', fontSize: '1.5rem' }}>Confirmação</h3>
        <p style={{ textAlign: 'center', marginBottom: '25px', fontSize: '1.1rem', color: '#ccc' }}>
          Tem certeza que deseja remover <strong>{movieToRemove?.title}</strong> da sua lista?
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button onClick={() => setMovieToRemove(null)} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancelar</button>
          <button onClick={confirmRemoveMovie} className="btn-danger" style={{ flex: 1, padding: '10px' }}>Remover</button>
        </div>
      </Modal>

      {/* Botão flutuante para voltar ao topo */}
      {showScrollTop && (
        <button 
          onClick={scrollToTop} 
          className="btn-primary"
          style={{ 
            position: 'fixed', 
            bottom: '40px', 
            right: '40px', 
            borderRadius: '50%', 
            width: '55px', 
            height: '55px', 
            fontSize: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            zIndex: 1000
          }}
          title="Voltar ao Topo"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </>
  );
}