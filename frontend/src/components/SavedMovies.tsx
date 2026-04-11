import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SavedMoviesProps {
  token: string;
  streamerMode: boolean;
}

export default function SavedMovies({ token, streamerMode }: SavedMoviesProps) {
  const [savedMovies, setSavedMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WATCHED' | 'UNWATCHED'>('ALL');
  const [rescuerFilter, setRescuerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE' | 'RATING' | 'ALPHA'>('DATE');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const moviesPerPage = 35;

  const fetchSavedMovies = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedMovies(response.data);
    } catch (error) {
      toast.error("Erro ao carregar seus filmes.");
    } finally {
      setIsLoading(false);
    }
  };

  // Dispara a busca sozinho assim que o componente aparecer na tela
  useEffect(() => {
    fetchSavedMovies();
  }, []);

  // Volta para a primeira página sempre que os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, statusFilter, rescuerFilter, sortBy]);

  const handleResetFilters = () => {
    setRescuerFilter('');
    setStatusFilter('ALL');
    setSelectedMonth('ALL');
    setSortBy('DATE');
  };

  const handleDeleteMovie = (id: number) => {
    toast(
      (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
          <span>Tem certeza que deseja remover este filme?</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn-danger" style={{ width: 'auto' }} onClick={async () => {
              toast.dismiss(t.id);
              try {
                await api.delete(`/movies/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                setSavedMovies(prev => prev.filter(movie => movie.id !== id));
                toast.success('Filme removido!');
              } catch (error: any) {
                toast.error(error.response?.data?.error || 'Erro ao deletar o filme.');
              }
            }}>Sim</button>
            <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => toast.dismiss(t.id)}>Não</button>
          </div>
        </div>
      ),
      { 
        duration: 8000, 
        position: 'top-center',
        style: { marginTop: '40vh', minWidth: '320px', padding: '20px' } 
      }
    );
  };

  // Função para atualizar qualquer campo do filme automaticamente
  const handleUpdateMovie = async (id: number, updates: any) => {
    // Atualização Otimista: Muda na tela imediatamente para não travar a digitação
    setSavedMovies(prevMovies => prevMovies.map(movie => movie.id === id ? { ...movie, ...updates } : movie));

    try {
      await api.put(`/movies/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar o filme.');
      // Se der erro no banco de dados, busca os dados reais novamente para reverter a tela
      fetchSavedMovies();
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

  // Extrai as chaves únicas de Ano e Mês (ex: "2024-04")
  const uniqueMonthKeys = Array.from(
    new Set(savedMovies.map(m => m.watchDate ? String(m.watchDate).substring(0, 7) : 'none'))
  ).sort((a, b) => a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b));

  // Transforma a chave "2024-04" no texto amigável "Abril 2024"
  const getMonthLabel = (key: string) => {
    if (key === 'none') return 'Sem data';
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  // Filtra e ordena os filmes pela data de agendamento (mais antigos primeiro)
  const filteredMovies = savedMovies
    .filter(m => selectedMonth === 'ALL' || (m.watchDate ? String(m.watchDate).substring(0, 7) : 'none') === selectedMonth)
    .filter(m => {
      if (statusFilter === 'WATCHED') return m.watched === true;
      if (statusFilter === 'UNWATCHED') return m.watched === false;
      return true; // Se for 'ALL', retorna todos
    })
    .filter(m => {
      if (rescuerFilter.trim() === '') return true;
      const searchTerm = rescuerFilter.toLowerCase();
      const requestedBy = (m.requestedBy || 'ninguém').toLowerCase();
      const title = (m.title || '').toLowerCase();
      return requestedBy.includes(searchTerm) || title.includes(searchTerm);
    })
    .sort((a, b) => {
      if (sortBy === 'ALPHA') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'RATING') {
        return (b.streamerRating || 0) - (a.streamerRating || 0);
      }
      // Se os dois não têm data, mantém a ordem original
      if (!a.watchDate && !b.watchDate) return 0;
      // Se 'a' não tem data, joga para o final da lista
      if (!a.watchDate) return 1;
      // Se 'b' não tem data, joga para o final da lista
      if (!b.watchDate) return -1;
      // Ordena cronologicamente (ex: 10/04 antes de 11/04)
      return new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime();
    });

  // Lógica de Paginação
  const indexOfLastMovie = currentPage * moviesPerPage;
  const indexOfFirstMovie = indexOfLastMovie - moviesPerPage;
  const currentMovies = filteredMovies.slice(indexOfFirstMovie, indexOfLastMovie);
  const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);

  return (
    <div className="saved-movies-container" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', gap: '30px' }}>
      <style>
        {`
          .btn-reset-filters:hover {
            background-color: var(--danger, #dc2626) !important;
            border-color: var(--danger, #dc2626) !important;
            color: #fff !important;
          }
        `}
      </style>
      
      {/* Painel lateral de Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '250px', minWidth: '250px', flexShrink: 0, gap: '20px', position: 'sticky', top: '20px', zIndex: 10, backgroundColor: 'var(--bg-color)' }}>
        
        {/* Barra de Pesquisa */}
        <div style={{ width: '100%' }}>
          <input 
            type="text" 
            placeholder={streamerMode ? "🔍 Buscar filme ou nick..." : "🔍 Buscar filme..."}
            value={rescuerFilter} 
            onChange={e => setRescuerFilter(e.target.value)} 
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filtros por Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Status</h3>
          <button className={statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('ALL')}>Todos</button>
          <button className={statusFilter === 'UNWATCHED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('UNWATCHED')}>🍿 Para Assistir</button>
          <button className={statusFilter === 'WATCHED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('WATCHED')}>✅ Já Assistidos</button>
        </div>

        {/* Filtros por Mês */}
        {savedMovies.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Mês</h3>
            <button className={selectedMonth === 'ALL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setSelectedMonth('ALL')}>Todos os Filmes</button>
            {uniqueMonthKeys.map(key => (
              <button key={key} className={selectedMonth === key ? 'btn-primary' : 'btn-secondary'} onClick={() => setSelectedMonth(key)}>{getMonthLabel(key)}</button>
            ))}
          </div>
        )}

        {/* Filtros de Ordenação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Ordenar por</h3>
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', outline: 'none' }}
          >
            <option value="DATE">📅 Data de Agendamento</option>
            <option value="RATING">⭐ Minha Nota</option>
            <option value="ALPHA">🔤 Ordem Alfabética</option>
          </select>
        </div>

        {/* Botão de Limpar Filtros */}
        {(rescuerFilter !== '' || statusFilter !== 'ALL' || selectedMonth !== 'ALL' || sortBy !== 'DATE') && (
          <button 
            className="btn-secondary btn-reset-filters" 
            onClick={handleResetFilters}
            style={{ marginTop: '10px', transition: 'all 0.2s ease-in-out' }}
          >
            ✖️ Limpar Filtros
          </button>
        )}
      </div>

      {/* Conteúdo Principal (Grid de Filmes e Paginação) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>

      {isLoading ? (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Carregando filmes... 🍿</p>
      ) : (
        <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', width: '100%', maxWidth: '100%', gap: '20px', marginTop: '0' }}>
          {currentMovies.length === 0 ? <p>Nenhum filme encontrado para este filtro.</p> : currentMovies.map(movie => (
          <div key={movie.id} className="movie-card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {/* Capa e título agora são clicáveis */}
          <div onClick={() => handleShowDetails(movie.tmdbId)} className="movie-card-header" title="Ver Detalhes">
            <p className="movie-title">{movie.title}</p>
            {movie.poster ? (
              <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} className="movie-poster" style={{ height: 'auto', aspectRatio: '2/3' }} />
            ) : (
              <div className="movie-poster-placeholder" style={{ height: 'auto', aspectRatio: '2/3' }}><span>Sem capa</span></div>
            )}
          </div>
          
          <label className="checkbox-label">
            <input type="checkbox" checked={movie.watched} onChange={(e) => handleUpdateMovie(movie.id, { watched: e.target.checked })} />
            <span className="toggle-switch"></span>
            Já assisti
          </label>

          {streamerMode && (
            <label className="input-label">
              Resgatado por:
              <input
                type="text"
                placeholder="Ninguém"
                value={movie.requestedBy || ''}
                onChange={(e) => setSavedMovies(prev => prev.map(m => m.id === movie.id ? { ...m, requestedBy: e.target.value } : m))}
                onBlur={(e) => handleUpdateMovie(movie.id, { requestedBy: e.target.value })}
              />
            </label>
          )}
          
          {(streamerMode || movie.watched) && (
            <label className="input-label" style={{ marginBottom: '15px' }}>
              {streamerMode ? 'Agendado para:' : 'Data que assistiu:'}
              <input
                type="date"
                value={movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : ''}
                onChange={(e) => handleUpdateMovie(movie.id, { watchDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </label>
          )}

          <div className="ratings-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <label className="input-label" style={{ width: streamerMode ? '50%' : '100%' }}>
                Minha Nota:
                <input 
                  type="number" min="0" max="5" step="0.5" 
                  value={movie.streamerRating ?? ''} 
                  onChange={(e) => setSavedMovies(prev => prev.map(m => m.id === movie.id ? { ...m, streamerRating: e.target.value } : m))} 
                  onBlur={(e) => handleUpdateMovie(movie.id, { streamerRating: e.target.value ? parseFloat(e.target.value) : null })} 
                />
              </label>
              {streamerMode && (
                <label className="input-label" style={{ width: '50%' }}>
                  Nota Chat:
                  <input 
                    type="number" min="0" max="5" step="0.5" 
                    value={movie.chatRating ?? ''} 
                    onChange={(e) => setSavedMovies(prev => prev.map(m => m.id === movie.id ? { ...m, chatRating: e.target.value } : m))} 
                    onBlur={(e) => handleUpdateMovie(movie.id, { chatRating: e.target.value ? parseFloat(e.target.value) : null })} 
                  />
                </label>
              )}
            </div>
          </div>

          <button onClick={() => handleDeleteMovie(movie.id)} className="btn-danger" style={{ marginTop: 'auto' }}>Deletar Filme</button>
          </div>
        ))}
        </div>
      )}

    {/* Controles de Paginação */}
    {totalPages > 1 && (
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', alignItems: 'center', alignSelf: 'center' }}>
        <button 
          className="btn-secondary" 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span style={{ fontWeight: 'bold' }}>Página {currentPage} de {totalPages}</span>
        <button 
          className="btn-secondary" 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
          disabled={currentPage === totalPages}
        >
          Próxima
        </button>
      </div>
    )}
      </div>

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
            
            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center' }}>
              <a href={`https://www.themoviedb.org/movie/${selectedMovieDetails.id}/watch`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: '100%' }}>
                <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.1rem', padding: '12px' }}>
                  ▶️ Onde Assistir (JustWatch)
                </button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}