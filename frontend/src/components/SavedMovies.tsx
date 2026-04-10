import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SavedMoviesProps {
  token: string;
}

export default function SavedMovies({ token }: SavedMoviesProps) {
  const [savedMovies, setSavedMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WATCHED' | 'UNWATCHED'>('ALL');
  const [rescuerFilter, setRescuerFilter] = useState<string>('');
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
  }, [selectedMonth, statusFilter, rescuerFilter]);

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
      const requestedBy = m.requestedBy || 'ninguém'; // Permite buscar por "ninguém" também
      return requestedBy.toLowerCase().includes(rescuerFilter.toLowerCase());
    })
    .sort((a, b) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      {/* Barra de Pesquisa de Resgatador */}
      <div style={{ marginBottom: '20px', width: '100%', maxWidth: '400px' }}>
        <input 
          type="text" 
          placeholder="🔍 Buscar pelo Nick de quem resgatou..." 
          value={rescuerFilter} 
          onChange={e => setRescuerFilter(e.target.value)} 
        />
      </div>

      {/* Botões de Filtro por Status */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '15px' }}>
        <button className={statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('ALL')}>Todos os Status</button>
        <button className={statusFilter === 'UNWATCHED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('UNWATCHED')}>🍿 Para Assistir</button>
        <button className={statusFilter === 'WATCHED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatusFilter('WATCHED')}>✅ Já Assistidos</button>
      </div>

      {/* Botões de Filtro por Mês */}
      {savedMovies.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '30px' }}>
          <button className={selectedMonth === 'ALL' ? 'btn-primary' : 'btn-secondary'} onClick={() => setSelectedMonth('ALL')}>Todos os Filmes</button>
          {uniqueMonthKeys.map(key => (
            <button key={key} className={selectedMonth === key ? 'btn-primary' : 'btn-secondary'} onClick={() => setSelectedMonth(key)}>{getMonthLabel(key)}</button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Carregando filmes... 🍿</p>
      ) : (
        <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', width: '100%', gap: '20px' }}>
          {currentMovies.length === 0 ? <p>Nenhum filme encontrado para este filtro.</p> : currentMovies.map(movie => (
          <div key={movie.id} className="movie-card">
          {/* Capa e título agora são clicáveis */}
          <div onClick={() => handleShowDetails(movie.tmdbId)} className="movie-card-header" title="Ver Detalhes">
            <p className="movie-title">{movie.title}</p>
            {movie.poster ? (
              <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} className="movie-poster" />
            ) : (
              <div className="movie-poster-placeholder"><span>Sem capa</span></div>
            )}
          </div>
          
          <label className="checkbox-label">
            <input type="checkbox" checked={movie.watched} onChange={(e) => handleUpdateMovie(movie.id, { watched: e.target.checked })} />
            <span className="toggle-switch"></span>
            Já assisti
          </label>

          <div className="info-text">
            <span>👤 Resgatado:</span> 
            <strong>{movie.requestedBy || 'Ninguém'}</strong>
          </div>
          <div className="info-text" style={{ marginBottom: '15px' }}>
            <span>📅 Agendado:</span> 
            <strong>{movie.watchDate ? new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definido'}</strong>
          </div>

          <div className="ratings-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <label className="input-label" style={{ width: '50%' }}>
                Minha Nota:
                <input type="number" min="0" max="5" step="0.5" value={movie.streamerRating || ''} onChange={(e) => handleUpdateMovie(movie.id, { streamerRating: e.target.value ? parseFloat(e.target.value) : null })} />
              </label>
              <label className="input-label" style={{ width: '50%' }}>
                Nota Chat:
                <input type="number" min="0" max="5" step="0.5" value={movie.chatRating || ''} onChange={(e) => handleUpdateMovie(movie.id, { chatRating: e.target.value ? parseFloat(e.target.value) : null })} />
              </label>
            </div>
          </div>

          <button onClick={() => handleDeleteMovie(movie.id)} className="btn-danger" style={{ marginTop: 'auto' }}>Deletar Filme</button>
          </div>
        ))}
        </div>
      )}

    {/* Controles de Paginação */}
    {totalPages > 1 && (
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', alignItems: 'center' }}>
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
    </div>
  );
}