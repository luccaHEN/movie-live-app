import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';

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
  const [savedMovieIds, setSavedMovieIds] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, { requestedBy?: string, watchDate?: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const currentRequestRef = useRef(0); // Referência para controlar a condição de corrida

  const fetchPopular = async (pageNum = 1) => {
    const requestId = ++currentRequestRef.current;
    try {
      setIsLoading(true);
      const response = await api.get(`/movies/popular?page=${pageNum}`, {
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
    fetchPopular(1);
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
        setSavedMovieIds(new Set(res.data.map((m: any) => m.tmdbId)));
      } catch (e) {}
    };
    fetchSaved();
  }, [token]);

  // Efeito de Debounce para buscar enquanto o usuário digita
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1); // Reinicia a paginação na nova busca
      setHasMore(true);
      if (searchQuery.trim()) {
        performSearch(searchQuery, 1);
        scrollToTop();
      } else {
        fetchPopular(1);
        scrollToTop();
      }
    }, 600); // 600ms de atraso

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  // Efeito para carregar mais páginas quando o 'page' mudar (Rolagem Infinita)
  useEffect(() => {
    if (page === 1) return; // A página 1 já é tratada pelo debounce ou load inicial
    if (searchQuery.trim()) {
      performSearch(searchQuery, page);
    } else {
      fetchPopular(page);
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

  const performSearch = async (query: string, pageNum = 1) => {
    const requestId = ++currentRequestRef.current;
    setIsLoading(true);
    try {
      const response = await api.get(`/movies/search?query=${query}&page=${pageNum}`, {
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
    if (searchQuery.trim()) performSearch(searchQuery, 1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setPage(1);
    setHasMore(true);
    fetchPopular(1); // Volta a mostrar os filmes populares
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
      if (!draft.watchDate) {
        toast.error('Por favor, selecione uma data para assistir o filme.');
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
      payload.watchDate = draft.watchDate;
    }

    try {
      await api.post('/movies', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Filme "${movie.title}" salvo com sucesso!`);
      setSavedMovieIds(prev => new Set(prev).add(movie.id));
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

  const displayedMovies = selectedGenre ? movies.filter(m => m.genre_ids && m.genre_ids.includes(parseInt(selectedGenre))) : movies;

  return (
    <>
      <form onSubmit={handleSearch} className="search-form" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Ex: Batman..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '400px' }} />
        <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', backgroundColor: '#1a1a1a', color: '#fff', outline: 'none' }}>
          <option value="">Todos os Gêneros</option>
          {Object.entries(TMDB_GENRES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={handleClearSearch}>Limpar / Populares</button>
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
              {movie.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} className="movie-poster" style={{ height: 'auto', aspectRatio: '2/3' }} />
              ) : (
                <div className="movie-poster-placeholder" style={{ height: 'auto', aspectRatio: '2/3' }}><span>Sem capa</span></div>
              )}
            </div>
            
            {savedMovieIds.has(movie.id) ? (
              <div style={{ marginTop: 'auto', textAlign: 'center', padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', fontWeight: 'bold' }}>
                ✅ Já na lista
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                {streamerMode && (
                  <>
                    <label className="input-label">
                      Resgatado por:
                      <input type="text" placeholder="Ex: viewer123" value={drafts[movie.id]?.requestedBy || ''} onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], requestedBy: e.target.value } })} />
                    </label>
                    <label className="input-label">
                      Agendar para:
                      <input type="date" value={drafts[movie.id]?.watchDate || ''} onChange={(e) => setDrafts({ ...drafts, [movie.id]: { ...drafts[movie.id], watchDate: e.target.value } })} />
                    </label>
                  </>
                )}
                <button onClick={() => handleSaveMovie(movie)} className="btn-success" style={{ width: '100%' }}>Salvar Filme</button>
              </div>
            )}
            </div>
          ))}
        </div>

      {isLoading && (
        <p style={{ textAlign: 'center', marginTop: '30px', marginBottom: '30px', fontSize: '1.2rem', width: '100%' }}>Buscando... 🍿</p>
      )}
      
      {/* Elemento invisível no final da lista que funciona como "gatilho" para carregar mais */}
      {!isLoading && hasMore && movies.length > 0 && (
        <div ref={loaderRef} style={{ height: '20px', width: '100%' }}></div>
      )}

      {/* Modal Flutuante com os Detalhes do Filme */}
      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />

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
          ⬆️
        </button>
      )}
    </>
  );
}