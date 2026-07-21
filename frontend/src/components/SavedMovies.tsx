import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';
import Modal from './Modal';
import CustomDatePicker from './CustomDatePicker';
import { Search } from 'lucide-react';
import TwitchVotePanel from './TwitchVotePanel';

interface SavedMoviesProps {
  token: string;
  streamerMode: boolean;
  user: any;
}

// COMPONENTE ISOLADO: Garante que os filmes não re-renderizem ao digitar as notas!
const MovieCardItem = React.memo(({ movie, onUpdate, onDelete, onShowDetails, sortBy, draggedMovieId, dragOverMovieId, setDraggedMovieId, setDragOverMovieId, onDrop, streamerMode, token, twitchChannel }: any) => {
  const [requestedBy, setRequestedBy] = useState(movie.requestedBy || '');
  const [streamerRating, setStreamerRating] = useState(movie.streamerRating ?? '');
  const [chatRating, setChatRating] = useState(movie.chatRating ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [watchDate, setWatchDate] = useState(movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : '');
  const [showVotePanel, setShowVotePanel] = useState(false);

  const handleVoteRatingUpdated = (movieId: number, newRating: number) => {
    setChatRating(newRating);
    onUpdate(movieId, { chatRating: newRating });
  };

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
          <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} className="movie-poster" loading="lazy" style={{ height: 'auto', aspectRatio: '2/3' }} />
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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" min="0" max="10" step="0.01" value={chatRating} onChange={(e) => setChatRating(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => {
                  if (chatRating !== (movie.chatRating ?? '')) {
                    let val = chatRating ? parseFloat(String(chatRating).replace(',', '.')) : null;
                    if (val !== null) { val = Math.max(0, Math.min(10, parseFloat(val.toFixed(2)))); }
                    onUpdate(movie.id, { chatRating: val });
                  }
                }} />
                <button 
                  onClick={() => setShowVotePanel(true)} 
                  title="Abrir votação no chat da Twitch"
                  style={{ 
                    padding: '7px 8px', borderRadius: '6px',
                    background: 'linear-gradient(135deg, #9146ff, #6441a5)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    fontSize: '0.85rem', lineHeight: '1', flexShrink: 0
                  }}
                >
                  🗳️
                </button>
              </div>
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
            <CustomDatePicker 
              value={watchDate} 
              onChange={(val) => setWatchDate(val)} 
              token={token} 
            />
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleSaveEdit} className="btn-primary" style={{ flex: 1, margin: 0 }}>Salvar</button>
            <button onClick={handleCancelEdit} className="btn-secondary" style={{ flex: 1, margin: 0 }}>Cancelar</button>
          </div>
        </div>
      </Modal>

      <TwitchVotePanel
        movieId={movie.id}
        movieTitle={movie.title}
        token={token}
        twitchChannel={twitchChannel || ''}
        isOpen={showVotePanel}
        onClose={() => setShowVotePanel(false)}
        onRatingUpdated={handleVoteRatingUpdated}
      />
    </>
  );
});

export default function SavedMovies({ token, streamerMode, user }: SavedMoviesProps) {
  const [savedMovies, setSavedMovies] = useState<any[]>([]);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WATCHED' | 'UNWATCHED'>('ALL');

  const genreDropdownRef = React.useRef<HTMLDivElement>(null);
  const monthDropdownRef = React.useRef<HTMLDivElement>(null);
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setIsGenreOpen(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const [rescuerFilter, setRescuerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE' | 'RATING_DESC' | 'RATING_ASC' | 'ALPHA'>('DATE');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uniqueMonthKeys, setUniqueMonthKeys] = useState<string[]>([]);
  const [uniqueGenres, setUniqueGenres] = useState<string[]>([]);

  
  const loaderRef = React.useRef<HTMLDivElement>(null);
  
  const [draggedMovieId, setDraggedMovieId] = useState<number | null>(null);
  const [dragOverMovieId, setDragOverMovieId] = useState<number | null>(null);

  const fetchSavedMovies = async (pageNum: number) => {
    if (pageNum === 1) setIsLoading(true);
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: pageNum, limit: 35, status: statusFilter, sortBy, month: selectedMonth, search: rescuerFilter, genre: selectedGenres.join(',') }
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
        if (response.data.uniqueGenres) {
          setUniqueGenres(response.data.uniqueGenres);
        }
      } else {
        setSavedMovies(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMovies = response.data.data.filter((m: any) => !existingIds.has(m.id));
          return [...prev, ...newMovies];
        });
      }
      setHasMore(pageNum < response.data.totalPages);

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
    }, rescuerFilter ? 300 : 0);
    return () => clearTimeout(timer);
  }, [statusFilter, rescuerFilter, sortBy, selectedMonth, selectedGenres]);

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

  const handleResetFilters = useCallback(() => {
    setRescuerFilter('');
    setStatusFilter('ALL');
    setSortBy('DATE');
    setSelectedMonth('ALL');
    setSelectedGenres([]);
  }, []);

  const handleDeleteMovie = useCallback((id: number) => {
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
                window.dispatchEvent(new Event('moviesUpdated'));
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
  }, [token]);

  // Função para atualizar qualquer campo do filme automaticamente
  const handleUpdateMovie = useCallback(async (id: number, updates: any) => {
    // Atualização Otimista: Muda na tela imediatamente para não travar a digitação
    setSavedMovies(prevMovies => prevMovies.map((movie: any) => movie.id === id ? { ...movie, ...updates } : movie));

    try {
      await api.put(`/movies/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (updates.watchDate !== undefined || updates.watched !== undefined) {
        window.dispatchEvent(new Event('moviesUpdated'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar o filme.');
      fetchSavedMovies(currentPage);
    }
  }, [token, currentPage]);

  // Função para buscar os detalhes completos do filme no TMDB
  const handleShowDetails = useCallback(async (tmdbId: number) => {
    if (!tmdbId) return;
    try {
      const response = await api.get(`/movies/tmdb/${tmdbId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMovieDetails(response.data);
    } catch (error) {
      toast.error("Erro ao buscar detalhes do filme.");
    }
  }, [token]);

  const getMonthLabel = useCallback((key: string) => {
    if (key === 'none') return 'Sem data';
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (!draggedId || draggedId === targetId) {
      setDraggedMovieId(null);
      setDragOverMovieId(null);
      return;
    }

    setSavedMovies(prevMovies => {
      const draggedMovie = prevMovies.find((m: any) => m.id === draggedId);
      const targetMovie = prevMovies.find((m: any) => m.id === targetId);
      if (!draggedMovie || !targetMovie) return prevMovies;

      const baseDateString = targetMovie.watchDate
        ? new Date(targetMovie.watchDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const moviesOnSameDay = prevMovies.filter((m: any) => {
        const mDate = m.watchDate ? new Date(m.watchDate).toISOString().split('T')[0] : null;
        return mDate === baseDateString;
      });

      const otherMovies = moviesOnSameDay.filter((m: any) => m.id !== draggedId);
      const targetIndex = otherMovies.findIndex((m: any) => m.id === targetId);
      const originalDraggedIndex = prevMovies.findIndex((m: any) => m.id === draggedId);
      const originalTargetIndex = prevMovies.findIndex((m: any) => m.id === targetId);

      let insertIndex = targetIndex;
      if (targetIndex !== -1) {
        insertIndex = originalDraggedIndex > originalTargetIndex ? targetIndex : targetIndex + 1;
      } else {
        insertIndex = otherMovies.length;
      }

      otherMovies.splice(insertIndex, 0, draggedMovie);

      const changedMovies: any[] = [];
      const newMovies = prevMovies.map((m: any) => {
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

      // Fire API call asynchronously
      if (changedMovies.length > 0) {
        api.put('/movies/reorder', { updates: changedMovies }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(error => {
          console.error('Erro ao reordenar filmes', error);
          toast.error('Erro ao salvar a nova ordem dos filmes.');
        });
      }

      return newMovies;
    });

    setDraggedMovieId(null);
    setDragOverMovieId(null);
  }, [token]);



  return (
    <div className="saved-movies-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px' }}>
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
            color: var(--text-color, #fff);
            outline: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            cursor: pointer;
            width: 100%;
            font-size: 0.95rem;
            font-family: inherit;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }
          .sidebar-premium-select:hover, .sidebar-premium-select:focus {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.15), 0 0 15px rgba(59, 130, 246, 0.25);
            transform: translateY(-2px);
          }
          select.sidebar-premium-select {
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 14px;
            padding-right: 35px !important;
          }
          .filter-tag {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            transition: all 0.2s;
          }
          .filter-tag:hover {
            background: rgba(59, 130, 246, 0.25);
            border-color: rgba(59, 130, 246, 0.5);
          }
          .filter-tag-close {
            cursor: pointer;
            font-weight: bold;
            opacity: 0.7;
          }
          .filter-tag-close:hover {
            opacity: 1;
            color: #fff;
          }
        `}
      </style>
      
      {/* Top Bar e Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--card-bg)', padding: '15px 20px', borderRadius: '12px', border: '1px solid var(--input-border)' }}>
          
          {/* Left Side: Search & Quick Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', flex: '1 1 auto' }}>
            <div className="search-container" style={{ position: 'relative', minWidth: '250px', flex: '1 1 300px', maxWidth: '400px' }}>
              <Search size={18} className="search-icon-wrapper" />
              <input 
                type="text" 
                placeholder={streamerMode ? "Buscar filme ou nick..." : "Buscar filme..."}
                value={rescuerFilter} 
                onChange={e => setRescuerFilter(e.target.value)} 
                className="sidebar-premium-input"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} style={{ margin: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }} onClick={() => setStatusFilter('ALL')}>TODOS</button>
              <button className={statusFilter === 'UNWATCHED' ? 'btn-primary' : 'btn-secondary'} style={{ margin: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }} onClick={() => setStatusFilter('UNWATCHED')}>📌 PARA ASSISTIR</button>
              <button className={statusFilter === 'WATCHED' ? 'btn-primary' : 'btn-secondary'} style={{ margin: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }} onClick={() => setStatusFilter('WATCHED')}>✅ JÁ ASSISTIDOS</button>
            </div>
          </div>

          {/* Right Side: Selects */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            {uniqueGenres.length > 0 && (
              <>
                <div ref={genreDropdownRef} style={{ position: 'relative' }}>
                  <button 
                    className="sidebar-premium-select"
                    style={{ width: 'auto', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontFamily: 'inherit', margin: 0, cursor: 'pointer' }}
                    onClick={() => setIsGenreOpen(!isGenreOpen)}
                  >
                    <span>Gênero: {selectedGenres.length === 0 ? 'Todos' : `${selectedGenres.length} selecionado(s)`}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▼</span>
                  </button>
                  {isGenreOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                      backgroundColor: '#1a1a1a', border: '1px solid #333',
                      borderRadius: '12px', padding: '10px', minWidth: '220px', maxHeight: '300px',
                      overflowY: 'auto', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '5px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.8)', color: '#fff'
                    }}>
                      {uniqueGenres.map(genre => (
                        <label key={genre} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', margin: 0 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedGenres.includes(genre)} 
                            onChange={() => toggleGenre(genre)}
                            style={{ cursor: 'pointer', margin: 0, padding: 0, width: '16px', height: '16px', flexShrink: 0, accentColor: '#3b82f6' }}
                          />
                          <span style={{ lineHeight: '1.2' }}>{genre}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={monthDropdownRef} style={{ position: 'relative' }}>
                  <button 
                    className="sidebar-premium-select"
                    style={{ width: 'auto', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit', margin: 0, cursor: 'pointer' }}
                    onClick={() => { setIsMonthOpen(!isMonthOpen); setIsSortOpen(false); setIsGenreOpen(false); }}
                  >
                    <span>Mês: {selectedMonth === 'ALL' ? 'Todos' : getMonthLabel(selectedMonth)}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▼</span>
                  </button>
                  {isMonthOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                      backgroundColor: '#1a1a1a', border: '1px solid #333',
                      borderRadius: '12px', padding: '10px', minWidth: '200px', maxHeight: '300px',
                      overflowY: 'auto', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '2px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.8)', color: '#fff'
                    }}>
                      <div
                        style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', background: selectedMonth === 'ALL' ? 'rgba(59,130,246,0.2)' : 'transparent' }}
                        onClick={() => { setSelectedMonth('ALL'); setIsMonthOpen(false); }}
                      >Todos</div>
                      {uniqueMonthKeys.map(key => (
                        <div
                          key={key}
                          style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', background: selectedMonth === key ? 'rgba(59,130,246,0.2)' : 'transparent' }}
                          onClick={() => { setSelectedMonth(key); setIsMonthOpen(false); }}
                        >{getMonthLabel(key)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div ref={sortDropdownRef} style={{ position: 'relative' }}>
              <button 
                className="sidebar-premium-select"
                style={{ width: 'auto', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit', margin: 0, cursor: 'pointer' }}
                onClick={() => { setIsSortOpen(!isSortOpen); setIsMonthOpen(false); setIsGenreOpen(false); }}
              >
                <span>Ordenar: {sortBy === 'DATE' ? 'Data' : sortBy === 'RATING_DESC' ? 'Maior Nota' : sortBy === 'RATING_ASC' ? 'Menor Nota' : 'Alfabética'}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▼</span>
              </button>
              {isSortOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                  backgroundColor: '#1a1a1a', border: '1px solid #333',
                  borderRadius: '12px', padding: '10px', minWidth: '180px',
                  zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '2px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)', color: '#fff'
                }}>
                  {([['DATE', 'Data'], ['RATING_DESC', 'Maior Nota'], ['RATING_ASC', 'Menor Nota'], ['ALPHA', 'Alfabética']] as const).map(([value, label]) => (
                    <div
                      key={value}
                      style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', background: sortBy === value ? 'rgba(59,130,246,0.2)' : 'transparent' }}
                      onClick={() => { setSortBy(value as any); setIsSortOpen(false); }}
                    >{label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Filtros Ativos Tags */}
        {(rescuerFilter !== '' || statusFilter !== 'ALL' || sortBy !== 'DATE' || selectedMonth !== 'ALL' || selectedGenres.length > 0) && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#aaa', fontSize: '0.9rem', marginRight: '5px' }}>Filtros Ativos:</span>
            
            {rescuerFilter !== '' && (
              <span className="filter-tag">
                Busca: {rescuerFilter}
                <span className="filter-tag-close" onClick={() => setRescuerFilter('')}>×</span>
              </span>
            )}

            {statusFilter !== 'ALL' && (
              <span className="filter-tag">
                Status: {statusFilter === 'UNWATCHED' ? 'Para Assistir' : 'Já Assistidos'}
                <span className="filter-tag-close" onClick={() => setStatusFilter('ALL')}>×</span>
              </span>
            )}

            {selectedMonth !== 'ALL' && (
              <span className="filter-tag">
                Mês: {getMonthLabel(selectedMonth)}
                <span className="filter-tag-close" onClick={() => setSelectedMonth('ALL')}>×</span>
              </span>
            )}

            {selectedGenres.map(genre => (
              <span key={genre} className="filter-tag">
                {genre}
                <span className="filter-tag-close" onClick={() => toggleGenre(genre)}>×</span>
              </span>
            ))}

            {sortBy !== 'DATE' && (
              <span className="filter-tag">
                Ordem: {sortBy === 'RATING_DESC' ? 'Maior Nota' : sortBy === 'RATING_ASC' ? 'Menor Nota' : 'Alfabética'}
                <span className="filter-tag-close" onClick={() => setSortBy('DATE')}>×</span>
              </span>
            )}

            <button onClick={handleResetFilters} style={{ background: 'transparent', border: 'none', color: 'var(--danger, #dc2626)', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '5px', padding: 0, textDecoration: 'underline' }}>
              Limpar Todos
            </button>
          </div>
        )}


      </div>

      {/* Conteúdo Principal (Grid de Filmes) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

        <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--primary)', width: '100%', borderBottom: '1px solid var(--input-border)', paddingBottom: '10px' }}>
          {selectedMonth === 'ALL' ? 'Todos os Filmes Salvos' : `Meus Filmes - ${getMonthLabel(selectedMonth)}`}
        </h2>

      <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', width: '100%', maxWidth: '100%', gap: '20px', marginTop: '0' }}>
      {savedMovies.length === 0 && !isLoading ? <p style={{ gridColumn: '1 / -1', textAlign: 'center' }}>Nenhum filme encontrado para este filtro.</p> : savedMovies.map((movie: any) => (
        <MovieCardItem 
          key={movie.id} movie={movie} onUpdate={handleUpdateMovie} onDelete={handleDeleteMovie}
          onShowDetails={handleShowDetails} sortBy={sortBy} draggedMovieId={draggedMovieId} dragOverMovieId={dragOverMovieId}
          setDraggedMovieId={setDraggedMovieId} setDragOverMovieId={setDragOverMovieId} onDrop={handleDrop} streamerMode={streamerMode}
          token={token} twitchChannel={user?.twitchChannel || ''}
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