import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';

interface SavedMoviesProps {
  token: string;
  streamerMode: boolean;
}

// COMPONENTE ISOLADO: Garante que os filmes não re-renderizem ao digitar as notas!
const MovieCardItem = React.memo(({ movie, onUpdate, onDelete, onShowDetails, sortBy, draggedMovieId, dragOverMovieId, setDraggedMovieId, setDragOverMovieId, onDrop, streamerMode }: any) => {
  const [requestedBy, setRequestedBy] = useState(movie.requestedBy || '');
  const [streamerRating, setStreamerRating] = useState(movie.streamerRating ?? '');
  const [chatRating, setChatRating] = useState(movie.chatRating ?? '');

  // Sincroniza estados locais caso ocorra alguma alteração externa via Drag & Drop
  useEffect(() => setRequestedBy(movie.requestedBy || ''), [movie.requestedBy]);
  useEffect(() => setStreamerRating(movie.streamerRating ?? ''), [movie.streamerRating]);
  useEffect(() => setChatRating(movie.chatRating ?? ''), [movie.chatRating]);

  return (
    <div 
      className={`movie-card ${sortBy === 'DATE' ? 'draggable-card' : ''} ${draggedMovieId === movie.id ? 'dragging' : ''} ${dragOverMovieId === movie.id ? 'drag-over' : ''}`} 
      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
      draggable={sortBy === 'DATE'}
      onDragStart={() => setDraggedMovieId(movie.id)}
      onDragOver={(e) => { e.preventDefault(); if (dragOverMovieId !== movie.id) setDragOverMovieId(movie.id); }}
      onDrop={() => onDrop(movie.id)}
      onDragEnd={() => { setDraggedMovieId(null); setDragOverMovieId(null); }}
    >
      <div onClick={() => onShowDetails(movie.tmdbId)} className="movie-card-header" title="Ver Detalhes">
        <p className="movie-title">{movie.title}</p>
        {movie.poster ? (
          <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} className="movie-poster" style={{ height: 'auto', aspectRatio: '2/3' }} />
        ) : (
          <div className="movie-poster-placeholder" style={{ height: 'auto', aspectRatio: '2/3' }}><span>Sem capa</span></div>
        )}
      </div>
      
      <label className="checkbox-label">
        <input type="checkbox" checked={movie.watched} onChange={(e) => onUpdate(movie.id, { watched: e.target.checked })} />
        <span className="toggle-switch"></span>
        Já assisti
      </label>

      {streamerMode && (
        <label className="input-label">
          Resgatado por:
          <input type="text" placeholder="Ninguém" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => { if (requestedBy !== (movie.requestedBy || '')) onUpdate(movie.id, { requestedBy: requestedBy.trim() || null }); }} />
        </label>
      )}
      
      {(streamerMode || movie.watched) && (
        <label className="input-label" style={{ marginBottom: '15px' }}>
          {streamerMode ? 'Agendado para:' : 'Data que assistiu:'}
          <input type="date" value={movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : ''} onChange={(e) => onUpdate(movie.id, { watchDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
      )}

      <div className="ratings-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <label className="input-label" style={{ width: streamerMode ? '50%' : '100%' }}>
            Minha Nota:
            <input type="number" min="0" max="10" step="0.01" value={streamerRating} onChange={(e) => setStreamerRating(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => {
                if (streamerRating !== (movie.streamerRating ?? '')) {
                  let val = streamerRating ? parseFloat(String(streamerRating).replace(',', '.')) : null;
                  if (val !== null) { val = Math.max(0, Math.min(10, parseFloat(val.toFixed(2)))); }
                  onUpdate(movie.id, { streamerRating: val });
                }
              }} />
          </label>
          {streamerMode && (
            <label className="input-label" style={{ width: '50%' }}>
              Nota Chat:
              <input type="number" min="0" max="10" step="0.01" value={chatRating} onChange={(e) => setChatRating(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => {
                  if (chatRating !== (movie.chatRating ?? '')) {
                    let val = chatRating ? parseFloat(String(chatRating).replace(',', '.')) : null;
                    if (val !== null) { val = Math.max(0, Math.min(10, parseFloat(val.toFixed(2)))); }
                    onUpdate(movie.id, { chatRating: val });
                  }
                }} />
            </label>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(movie.id)} className="btn-danger" style={{ marginTop: 'auto' }}>Deletar Filme</button>
    </div>
  );
});

export default function SavedMovies({ token, streamerMode }: SavedMoviesProps) {
  const [savedMovies, setSavedMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WATCHED' | 'UNWATCHED'>('ALL');
  const [rescuerFilter, setRescuerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE' | 'RATING_DESC' | 'RATING_ASC' | 'ALPHA'>('DATE');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const moviesPerPage = 35;
  const [draggedMovieId, setDraggedMovieId] = useState<number | null>(null);
  const [dragOverMovieId, setDragOverMovieId] = useState<number | null>(null);

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
  }, [statusFilter, rescuerFilter, sortBy, selectedMonth]);

  const handleResetFilters = () => {
    setRescuerFilter('');
    setStatusFilter('ALL');
    setSortBy('DATE');
    setSelectedMonth('ALL');
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
              setSavedMovies(prev => prev.filter((movie: any) => movie.id !== id));
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
    setSavedMovies(prevMovies => prevMovies.map((movie: any) => movie.id === id ? { ...movie, ...updates } : movie));

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

  // Extrai as chaves únicas de Ano e Mês (ex: "2024-04")
  const uniqueMonthKeys = Array.from(
    new Set(savedMovies.map((m: any) => m.watchDate ? String(m.watchDate).substring(0, 7) : 'none'))
  ).sort((a: any, b: any) => a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b));

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
    .filter((m: any) => selectedMonth === 'ALL' || (m.watchDate ? String(m.watchDate).substring(0, 7) : 'none') === selectedMonth)
    .filter((m: any) => {
      if (statusFilter === 'WATCHED') return m.watched === true;
      if (statusFilter === 'UNWATCHED') return m.watched === false;
      return true; // Se for 'ALL', retorna todos
    })
    .filter((m: any) => {
      if (rescuerFilter.trim() === '') return true;
      const searchTerm = rescuerFilter.toLowerCase();
      const requestedBy = (m.requestedBy || 'ninguém').toLowerCase();
      const title = (m.title || '').toLowerCase();
      return requestedBy.includes(searchTerm) || title.includes(searchTerm);
    })
    .filter((m: any) => {
      // Se estiver ordenando por nota, remove os filmes que não têm nenhuma avaliação
      if (sortBy === 'RATING_DESC' || sortBy === 'RATING_ASC') {
        return m.streamerRating != null;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'ALPHA') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'RATING_DESC') {
        return (b.streamerRating ?? 0) - (a.streamerRating ?? 0);
      }
      if (sortBy === 'RATING_ASC') {
        return (a.streamerRating ?? 0) - (b.streamerRating ?? 0);
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

  // Lógica de Drag & Drop para reordenar filmes no mesmo dia
  const handleDrop = async (targetId: number) => {
    if (!draggedMovieId || draggedMovieId === targetId) {
      setDraggedMovieId(null);
      setDragOverMovieId(null);
      return;
    }

    const draggedMovie = savedMovies.find((m: any) => m.id === draggedMovieId);
    const targetMovie = savedMovies.find((m: any) => m.id === targetId);
    if (!draggedMovie || !targetMovie) return;

    const baseDateString = targetMovie.watchDate
      ? new Date(targetMovie.watchDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const moviesOnSameDay = filteredMovies.filter((m: any) => {
      const mDate = m.watchDate ? new Date(m.watchDate).toISOString().split('T')[0] : null;
      return mDate === baseDateString;
    });

    const otherMovies = moviesOnSameDay.filter((m: any) => m.id !== draggedMovieId);
    const targetIndex = otherMovies.findIndex((m: any) => m.id === targetId);
    const originalDraggedIndex = filteredMovies.findIndex((m: any) => m.id === draggedMovieId);
    const originalTargetIndex = filteredMovies.findIndex((m: any) => m.id === targetId);

    let insertIndex = targetIndex;
    if (targetIndex !== -1) {
      insertIndex = originalDraggedIndex > originalTargetIndex ? targetIndex : targetIndex + 1;
    } else {
      insertIndex = otherMovies.length;
    }

    otherMovies.splice(insertIndex, 0, draggedMovie);

    const changedMovies: any[] = [];
    const newSavedMovies = savedMovies.map((m: any) => {
      const dayIndex = otherMovies.findIndex((dayMovie: any) => dayMovie.id === m.id);
      if (dayIndex !== -1) {
        const newDateObj = new Date(`${baseDateString}T00:00:00.000Z`);
        newDateObj.setSeconds(dayIndex);
        const newDateStr = newDateObj.toISOString();
        if (m.watchDate !== newDateStr) {
          changedMovies.push({ id: m.id, watchDate: newDateStr });
          return { ...m, watchDate: newDateStr };
        }
      }
      return m;
    });

    setSavedMovies(newSavedMovies);
    setDraggedMovieId(null);
    setDragOverMovieId(null);

    for (const update of changedMovies) {
      try {
        await api.put(`/movies/${update.id}`, { watchDate: update.watchDate }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Erro ao reordenar filme', error);
      }
    }
  };

  // Lógica de Paginação
  const indexOfLastMovie = currentPage * moviesPerPage;
  const indexOfFirstMovie = indexOfLastMovie - moviesPerPage;
  const currentMovies = filteredMovies.slice(indexOfFirstMovie, indexOfLastMovie);
  const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);

  // Cálculos para o Resumo
  const totalFiltered = filteredMovies.length;
  const watchedFiltered = filteredMovies.filter((m: any) => m.watched).length;
  const unwatchedFiltered = totalFiltered - watchedFiltered;
  const progressPercentage = totalFiltered > 0 ? Math.round((watchedFiltered / totalFiltered) * 100) : 0;

  return (
    <div className="saved-movies-container" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', gap: '30px' }}>
      <style>
        {`
          .btn-reset-filters:hover {
            background-color: var(--danger, #dc2626) !important;
            border-color: var(--danger, #dc2626) !important;
            color: #fff !important;
          }
          .drag-over {
            border: 2px dashed var(--primary) !important;
            transform: scale(1.02);
            transition: all 0.2s;
          }
          .dragging {
            opacity: 0.4;
          }
          .draggable-card {
            cursor: grab;
          }
          .draggable-card:active {
            cursor: grabbing;
          }
        `}
      </style>
      
      {/* Painel lateral de Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '250px', minWidth: '250px', flexShrink: 0, gap: '20px', position: 'sticky', top: '20px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', zIndex: 10, backgroundColor: 'var(--bg-color)', paddingRight: '5px' }}>
        
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
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', outline: 'none' }}
            >
              <option value="ALL">Todos os Filmes</option>
              {uniqueMonthKeys.map(key => (
                <option key={key} value={key}>{getMonthLabel(key)}</option>
              ))}
            </select>
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
            <option value="RATING_DESC">⭐ Maior Nota</option>
            <option value="RATING_ASC">⭐ Menor Nota</option>
            <option value="ALPHA">🔤 Ordem Alfabética</option>
          </select>
        </div>

        {/* Resumo da Lista (Estatísticas) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '15px', backgroundColor: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--primary)', textAlign: 'center' }}>📊 Resumo da Lista</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: '#ccc' }}>Total Listado:</span>
            <span style={{ fontWeight: 'bold' }}>{totalFiltered}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: '#ccc' }}>Já Assistidos:</span>
            <span style={{ fontWeight: 'bold', color: '#10b981' }}>{watchedFiltered}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: '#ccc' }}>Para Assistir:</span>
            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{unwatchedFiltered}</span>
          </div>
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
          <span style={{ color: '#aaa' }}>Progresso</span>
          <span style={{ fontWeight: 'bold', color: '#10b981' }}>{progressPercentage}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercentage}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease-in-out' }}></div>
        </div>
      </div>
        </div>

        {/* Botão de Limpar Filtros */}
        {(rescuerFilter !== '' || statusFilter !== 'ALL' || sortBy !== 'DATE' || selectedMonth !== 'ALL') && (
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

        <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--primary)', width: '100%', borderBottom: '1px solid var(--input-border)', paddingBottom: '10px' }}>
          {selectedMonth === 'ALL' ? 'Todos os Filmes Salvos' : `Meus Filmes - ${getMonthLabel(selectedMonth)}`}
        </h2>

      {isLoading ? (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Carregando filmes... 🍿</p>
      ) : (
        <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', width: '100%', maxWidth: '100%', gap: '20px', marginTop: '0' }}>
        {currentMovies.length === 0 ? <p>Nenhum filme encontrado para este filtro.</p> : currentMovies.map((movie: any) => (
          <MovieCardItem 
            key={movie.id} movie={movie} onUpdate={handleUpdateMovie} onDelete={handleDeleteMovie}
            onShowDetails={handleShowDetails} sortBy={sortBy} draggedMovieId={draggedMovieId} dragOverMovieId={dragOverMovieId}
            setDraggedMovieId={setDraggedMovieId} setDragOverMovieId={setDragOverMovieId} onDrop={handleDrop} streamerMode={streamerMode}
          />
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
      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />
    </div>
  );
}