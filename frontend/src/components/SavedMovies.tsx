import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';
import Modal from './Modal';
import { Search } from 'lucide-react';

interface SavedMoviesProps {
  token: string;
  streamerMode: boolean;
}

// COMPONENTE ISOLADO: Garante que os filmes não re-renderizem ao digitar as notas!
const MovieCardItem = React.memo(({ movie, onUpdate, onDelete, onShowDetails, sortBy, draggedMovieId, dragOverMovieId, setDraggedMovieId, setDragOverMovieId, onDrop, streamerMode }: any) => {
  const [requestedBy, setRequestedBy] = useState(movie.requestedBy || '');
  const [streamerRating, setStreamerRating] = useState(movie.streamerRating ?? '');
  const [chatRating, setChatRating] = useState(movie.chatRating ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [watchDate, setWatchDate] = useState(movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : '');

  // Sincroniza estados locais caso ocorra alguma alteração externa via Drag & Drop
  useEffect(() => setRequestedBy(movie.requestedBy || ''), [movie.requestedBy]);
  useEffect(() => setStreamerRating(movie.streamerRating ?? ''), [movie.streamerRating]);
  useEffect(() => setChatRating(movie.chatRating ?? ''), [movie.chatRating]);
  useEffect(() => setWatchDate(movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : ''), [movie.watchDate]);

  const handleSaveEdit = () => {
    const updates: any = {};
    if (requestedBy !== (movie.requestedBy || '')) {
      updates.requestedBy = requestedBy.trim() || null;
    }
    const currentWatchDateStr = movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : '';
    if (watchDate !== currentWatchDateStr) {
      updates.watchDate = watchDate ? new Date(watchDate).toISOString() : null;
    }
    if (Object.keys(updates).length > 0) {
      onUpdate(movie.id, updates);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setRequestedBy(movie.requestedBy || '');
    setWatchDate(movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : '');
    setIsEditing(false);
  };

  return (
    <>
      <div 
        className={`movie-card ${sortBy === 'DATE' ? 'draggable-card' : ''} ${draggedMovieId === movie.id ? 'dragging' : ''} ${dragOverMovieId === movie.id ? 'drag-over' : ''}`} 
        style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
        draggable={sortBy === 'DATE'}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', movie.id.toString());
          setDraggedMovieId(movie.id);
        }}
        onDragOver={(e) => { e.preventDefault(); if (dragOverMovieId !== movie.id) setDragOverMovieId(movie.id); }}
        onDrop={(e) => onDrop(e, movie.id)}
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
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
        <label className="checkbox-label" style={{ margin: 0 }}>
          <input type="checkbox" checked={movie.watched} onChange={(e) => onUpdate(movie.id, { watched: e.target.checked })} />
          <span className="toggle-switch"></span>
          Já assisti
        </label>
        <span style={{ color: isEditing ? 'var(--primary)' : '#666', cursor: 'pointer', fontSize: '1.1rem', lineHeight: '1' }} onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)} title="Editar informações">✏️</span>
      </div>

      <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {streamerMode && movie.requestedBy && (
          <div style={{ fontSize: '0.85rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Resgate: <strong style={{ color: 'var(--primary)' }}>{movie.requestedBy}</strong>
          </div>
        )}
        {(streamerMode || movie.watched) && movie.watchDate && (
          <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
            {streamerMode ? 'Agendado: ' : 'Assistido: '}
            <strong style={{ color: '#10b981' }}>{new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
          </div>
        )}
      </div>

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

      <Modal isOpen={isEditing} onClose={handleCancelEdit} maxWidth="400px">
        <h2 style={{ marginTop: 0, color: 'var(--primary)', marginBottom: '20px', textAlign: 'center' }}>✏️ Editar Filme</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
          {streamerMode && (
            <label className="input-label" style={{ margin: 0, fontSize: '0.9rem' }}>
              Resgatado por:
              <input type="text" placeholder="Ninguém" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); } }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', marginTop: '5px', outline: 'none' }} />
            </label>
          )}
          <label className="input-label" style={{ margin: 0, fontSize: '0.9rem' }}>
            {streamerMode ? 'Agendado para:' : 'Data que assistiu:'}
            <input type="date" value={watchDate} onChange={(e) => setWatchDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', marginTop: '5px', outline: 'none' }} />
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleSaveEdit} className="btn-primary" style={{ flex: 1, margin: 0 }}>Salvar</button>
            <button onClick={handleCancelEdit} className="btn-secondary" style={{ flex: 1, margin: 0 }}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </>
  );
});

export default function SavedMovies({ token, streamerMode }: SavedMoviesProps) {
  const [savedMovies, setSavedMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WATCHED' | 'UNWATCHED'>('ALL');
  const [rescuerFilter, setRescuerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE' | 'RATING_DESC' | 'RATING_ASC' | 'ALPHA'>('DATE');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uniqueMonthKeys, setUniqueMonthKeys] = useState<string[]>([]);
  const [globalStats, setGlobalStats] = useState({ total: 0, watched: 0 });
  
  const loaderRef = React.useRef<HTMLDivElement>(null);
  
  const [draggedMovieId, setDraggedMovieId] = useState<number | null>(null);
  const [dragOverMovieId, setDragOverMovieId] = useState<number | null>(null);

  const fetchSavedMovies = async (pageNum: number) => {
    if (pageNum === 1) setIsLoading(true);
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: pageNum, limit: 35, status: statusFilter, sortBy, month: selectedMonth, search: rescuerFilter }
      });
      if (pageNum === 1) {
        setSavedMovies(response.data.data);
        if (response.data.uniqueMonths) {
          let months = response.data.uniqueMonths;
          if (selectedMonth !== 'ALL' && !months.includes(selectedMonth)) {
            months.push(selectedMonth);
          }
          setUniqueMonthKeys(months.sort((a: any, b: any) => a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)));
        }
      } else {
        setSavedMovies(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMovies = response.data.data.filter((m: any) => !existingIds.has(m.id));
          return [...prev, ...newMovies];
        });
      }
      setHasMore(pageNum < response.data.totalPages);
      setGlobalStats(response.data.stats || { total: 0, watched: 0 });
    } catch (error) {
      toast.error("Erro ao carregar seus filmes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchSavedMovies(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [statusFilter, rescuerFilter, sortBy, selectedMonth]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoading && hasMore) {
        setCurrentPage(prev => {
          const next = prev + 1;
          fetchSavedMovies(next);
          return next;
        });
      }
    }, { threshold: 1.0 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore]);

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

  const getMonthLabel = (key: string) => {
    if (key === 'none') return 'Sem data';
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (!draggedId || draggedId === targetId) {
      setDraggedMovieId(null);
      setDragOverMovieId(null);
      return;
    }

    const draggedMovie = savedMovies.find((m: any) => m.id === draggedId);
    const targetMovie = savedMovies.find((m: any) => m.id === targetId);
    if (!draggedMovie || !targetMovie) return;

    const baseDateString = targetMovie.watchDate
      ? new Date(targetMovie.watchDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const moviesOnSameDay = savedMovies.filter((m: any) => {
      const mDate = m.watchDate ? new Date(m.watchDate).toISOString().split('T')[0] : null;
      return mDate === baseDateString;
    });

    const otherMovies = moviesOnSameDay.filter((m: any) => m.id !== draggedId);
    const targetIndex = otherMovies.findIndex((m: any) => m.id === targetId);
    const originalDraggedIndex = savedMovies.findIndex((m: any) => m.id === draggedId);
    const originalTargetIndex = savedMovies.findIndex((m: any) => m.id === targetId);

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

    if (changedMovies.length > 0) {
      try {
        await api.put('/movies/reorder', { updates: changedMovies }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Erro ao reordenar filmes', error);
        toast.error('Erro ao salvar a nova ordem dos filmes.');
      }
    }
  };

  const progressPercentage = globalStats.total > 0 ? Math.round((globalStats.watched / globalStats.total) * 100) : 0;

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
          .sidebar-premium-input {
            width: 100%;
            box-sizing: border-box;
            padding: 12px 15px 12px 42px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-color);
            outline: none;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            font-size: 0.95rem;
          }
          .sidebar-premium-input:focus {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.15), 0 0 15px rgba(59, 130, 246, 0.25);
            transform: translateY(-2px);
          }
          .sidebar-premium-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
          }
          .search-icon-wrapper {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: rgba(255,255,255,0.4);
            transition: all 0.3s ease;
            pointer-events: none;
          }
          .search-container:focus-within .search-icon-wrapper {
            color: #3b82f6;
            transform: translateY(-50%) scale(1.1);
          }
          .sidebar-premium-select {
            padding: 10px 15px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-color);
            outline: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            cursor: pointer;
            width: 100%;
            font-size: 0.95rem;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          }
          .sidebar-premium-select:hover, .sidebar-premium-select:focus {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(59, 130, 246, 0.5);
          }
        `}
      </style>
      
      {/* Painel lateral de Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '250px', minWidth: '250px', flexShrink: 0, gap: '20px', position: 'sticky', top: '20px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', zIndex: 10, backgroundColor: 'var(--bg-color)', padding: '15px 5px 15px 10px' }}>
        
        {/* Barra de Pesquisa */}
        <div className="search-container" style={{ width: '100%', position: 'relative' }}>
          <Search size={18} className="search-icon-wrapper" />
          <input 
            type="text" 
            placeholder={streamerMode ? "Buscar filme ou nick..." : "Buscar filme..."}
            value={rescuerFilter} 
            onChange={e => setRescuerFilter(e.target.value)} 
            className="sidebar-premium-input"
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
              className="sidebar-premium-select"
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
            className="sidebar-premium-select"
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
            <span style={{ fontWeight: 'bold' }}>{globalStats.total}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: '#ccc' }}>Já Assistidos:</span>
            <span style={{ fontWeight: 'bold', color: '#10b981' }}>{globalStats.watched}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: '#ccc' }}>Para Assistir:</span>
            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{globalStats.total - globalStats.watched}</span>
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

      <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', width: '100%', maxWidth: '100%', gap: '20px', marginTop: '0' }}>
      {savedMovies.length === 0 && !isLoading ? <p style={{ gridColumn: '1 / -1', textAlign: 'center' }}>Nenhum filme encontrado para este filtro.</p> : savedMovies.map((movie: any) => (
        <MovieCardItem 
          key={movie.id} movie={movie} onUpdate={handleUpdateMovie} onDelete={handleDeleteMovie}
          onShowDetails={handleShowDetails} sortBy={sortBy} draggedMovieId={draggedMovieId} dragOverMovieId={dragOverMovieId}
          setDraggedMovieId={setDraggedMovieId} setDragOverMovieId={setDragOverMovieId} onDrop={handleDrop} streamerMode={streamerMode}
        />
      ))}
      
      {isLoading && Array.from({ length: 15 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="skeleton-card" style={{ width: '100%', height: '400px' }}></div>
      ))}
      </div>

      {!isLoading && hasMore && savedMovies.length > 0 && (
        <div ref={loaderRef} style={{ height: '20px', width: '100%', marginTop: '20px' }}></div>
      )}
      </div>

      {/* Modal Flutuante com os Detalhes do Filme */}
      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />
    </div>
  );
}