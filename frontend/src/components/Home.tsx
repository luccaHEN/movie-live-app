import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';
import Modal from './Modal';

const HomeMovieCardItem = React.memo(({ movie, onUpdate, onShowDetails, draggedMovieId, dragOverMovieId, setDraggedMovieId, setDragOverMovieId, onDrop, streamerMode, viewMode }: any) => {
  const [streamerRating, setStreamerRating] = useState(movie.streamerRating ?? '');
  const [chatRating, setChatRating] = useState(movie.chatRating ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [requestedBy, setRequestedBy] = useState(movie.requestedBy || '');
  const [watchDate, setWatchDate] = useState(movie.watchDate ? new Date(movie.watchDate).toISOString().split('T')[0] : '');

  useEffect(() => setStreamerRating(movie.streamerRating ?? ''), [movie.streamerRating]);
  useEffect(() => setChatRating(movie.chatRating ?? ''), [movie.chatRating]);
  useEffect(() => setRequestedBy(movie.requestedBy || ''), [movie.requestedBy]);
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
        className={`movie-card draggable-card ${draggedMovieId === movie.id ? 'dragging' : ''} ${dragOverMovieId === movie.id ? 'drag-over' : ''}`}
        style={{ display: 'flex', flexDirection: 'row', gap: '15px', padding: '15px', width: '100%', minWidth: 0, boxSizing: 'border-box', border: movie.watched ? '1px solid #10b981' : '1px solid var(--input-border)', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', borderRadius: '12px', backgroundColor: 'var(--bg-color)', transition: 'transform 0.2s, box-shadow 0.2s', alignItems: 'flex-start' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', movie.id.toString());
          setDraggedMovieId(movie.id);
        }}
        onDragOver={(e) => { e.preventDefault(); if (dragOverMovieId !== movie.id) setDragOverMovieId(movie.id); }}
        onDrop={(e) => onDrop(e, movie.id)}
        onDragEnd={() => { setDraggedMovieId(null); setDragOverMovieId(null); }}
      >
      {/* Capa Lateral */}
      <div style={{ flexShrink: 0, cursor: 'pointer', marginTop: '2px' }} onClick={() => onShowDetails(movie.tmdbId)} title="Ver Detalhes">
        {movie.poster ? (
          <img src={`https://image.tmdb.org/t/p/w154${movie.poster}`} alt={movie.title} style={{ width: '90px', height: '135px', objectFit: 'cover', opacity: movie.watched ? 0.6 : 1, borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
        ) : (
          <div style={{ width: '90px', height: '135px', borderRadius: '6px', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.7rem' }}>Sem capa</div>
        )}
      </div>

      {/* Informações e Controles */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'flex-start', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
          <div>
            {viewMode === 'SEMANA' && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>{new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase()}</span>}
            <strong style={{ fontSize: '1.1rem', color: 'var(--text-color)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer', lineHeight: '1.2' }} onClick={() => onShowDetails(movie.tmdbId)} title={movie.title}>{movie.title}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: isEditing ? 'var(--primary)' : '#666', cursor: 'pointer', fontSize: '1.1rem', lineHeight: '1' }} onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)} title="Editar informações">✏️</span>
            <span style={{ color: '#666', cursor: 'grab', fontSize: '1.2rem', lineHeight: '1' }} title="Arraste para trocar com outro filme">⣿</span>
          </div>
        </div>

        {streamerMode && movie.requestedBy && (
          <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Resgate: <strong style={{ color: 'var(--primary)' }}>{movie.requestedBy}</strong>
          </div>
        )}

        <label className="checkbox-label" style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={movie.watched} onChange={(e) => onUpdate(movie.id, { watched: e.target.checked })} />
          <span className="toggle-switch" style={{ transform: 'scale(0.8)', margin: '0 8px 0 0' }}></span>
          Já assisti
        </label>

        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
          <label className="input-label" style={{ flex: 1, margin: 0, fontSize: '0.8rem', color: '#ccc' }}>
            Sua Nota:
            <input type="number" min="0" max="10" step="0.01" value={streamerRating} onChange={(e) => setStreamerRating(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => { if (streamerRating !== (movie.streamerRating ?? '')) { let val = streamerRating ? parseFloat(String(streamerRating).replace(',', '.')) : null; if (val !== null) { val = Math.max(0, Math.min(10, parseFloat(val.toFixed(2)))); } onUpdate(movie.id, { streamerRating: val }); } }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--input-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', marginTop: '4px', outline: 'none', fontSize: '0.9rem' }} />
          </label>
          {streamerMode && (
            <label className="input-label" style={{ flex: 1, margin: 0, fontSize: '0.8rem', color: '#ccc' }}>
              Nota Chat:
              <input type="number" min="0" max="10" step="0.01" value={chatRating} onChange={(e) => setChatRating(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => { if (chatRating !== (movie.chatRating ?? '')) { let val = chatRating ? parseFloat(String(chatRating).replace(',', '.')) : null; if (val !== null) { val = Math.max(0, Math.min(10, parseFloat(val.toFixed(2)))); } onUpdate(movie.id, { chatRating: val }); } }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--input-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', marginTop: '4px', outline: 'none', fontSize: '0.9rem' }} />
            </label>
          )}
        </div>
      </div>
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

interface HomeProps {
  token: string;
  streamerMode: boolean;
  user?: any;
}

export default function Home({ token, streamerMode, user }: HomeProps) {
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [draggedMovieId, setDraggedMovieId] = useState<number | null>(null);
  const [dragOverMovieId, setDragOverMovieId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'HOJE' | 'SEMANA'>('HOJE');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const fetchMovies = useCallback(async () => {
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data);
    } catch (error) {
      toast.error("Erro ao carregar a página inicial.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

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

  // Pega a data de hoje local da máquina do usuário no formato YYYY-MM-DD
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const today = localDate.toISOString().split('T')[0];

  const nextWeekDate = new Date(localDate);
  nextWeekDate.setDate(localDate.getDate() + 6);
  const nextWeek = nextWeekDate.toISOString().split('T')[0];

  // Filtra os filmes do dia ou da semana
  const displayedMovies = movies
    .filter(m => {
      if (!m.watchDate) return false;
      const mDate = String(m.watchDate).split('T')[0];
      return viewMode === 'HOJE' ? mDate === today : (mDate >= today && mDate <= nextWeek);
    })
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());

  // Reseta o carrossel ao trocar a aba "Hoje / Semana"
  useEffect(() => {
    setCarouselIndex(0);
  }, [viewMode]);

  // Garante que o índice não fique fora dos limites caso a lista diminua (ex: filme deletado/movido)
  const currentCarouselIndex = Math.min(carouselIndex, Math.max(0, Math.ceil(displayedMovies.length / 3) - 1) * 3);

  // Destaque: Próximo filme de terror não assistido
  const terrorDaSemana = movies
    .filter(m => m.watchDate && String(m.watchDate).split('T')[0] >= today && !m.watched && m.genre?.toLowerCase().includes('terror') && new Date(m.watchDate).getUTCDay() === 5)
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime())[0];

  const greeting = user?.name ? `Olá, ${user.name}!` : 'Olá!';

  // Função de atualização em tempo real do Card Interativo
  const handleUpdateMovie = async (id: number, updates: any) => {
    setMovies(prevMovies => prevMovies.map(m => m.id === id ? { ...m, ...updates } : m));
    try {
      await api.put(`/movies/${id}`, updates, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      toast.error('Erro ao atualizar o filme.');
      fetchMovies();
    }
  };

  // Função de Drag & Drop (Reordena os filmes)
  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (!draggedId || draggedId === targetId) {
      setDraggedMovieId(null);
      setDragOverMovieId(null);
      return;
    }

    const draggedMovie = movies.find(m => m.id === draggedId);
    const targetMovie = movies.find(m => m.id === targetId);
    if (!draggedMovie || !targetMovie) return;

    const baseDateString = targetMovie.watchDate
      ? String(targetMovie.watchDate).split('T')[0]
      : today;

    const moviesOnSameDay = movies
      .filter(m => m.watchDate && String(m.watchDate).split('T')[0] === baseDateString)
      .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());

    const otherMovies = moviesOnSameDay.filter(m => m.id !== draggedId);
    const targetIndex = otherMovies.findIndex(m => m.id === targetId);
    const originalDraggedIndex = moviesOnSameDay.findIndex(m => m.id === draggedId);
    const originalTargetIndex = moviesOnSameDay.findIndex(m => m.id === targetId);

    let insertIndex = targetIndex;
    if (targetIndex !== -1) {
      insertIndex = originalDraggedIndex > originalTargetIndex ? targetIndex : targetIndex + 1;
    } else {
      insertIndex = otherMovies.length;
    }

    otherMovies.splice(insertIndex, 0, draggedMovie);

    const changedMovies: any[] = [];
    const newMovies = movies.map(m => {
      const dayIndex = otherMovies.findIndex(dayMovie => dayMovie.id === m.id);
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

    setMovies(newMovies);

    setDraggedMovieId(null);
    setDragOverMovieId(null);

    for (const update of changedMovies) {
      try {
        await api.put(`/movies/${update.id}`, { watchDate: update.watchDate }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        console.error('Erro ao reordenar filme', error);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>
      <style>
        {`
          .drag-over {
            border: 2px dashed var(--primary) !important;
            transform: scale(1.02);
            transition: all 0.2s;
          }
          .dragging { opacity: 0.5; }
          .draggable-card { cursor: grab; }
          .draggable-card:active { cursor: grabbing; }
        `}
      </style>

      {/* CABEÇALHO DO PAINEL */}
      <div style={{ textAlign: 'center', padding: '10px 0 20px 0' }}>
        <h1 style={{ color: 'var(--primary)', margin: '0 0 10px 0', fontSize: '2.2rem' }}>{greeting} 🍿</h1>
        <p style={{ color: '#aaa', fontSize: '1.1rem', margin: 0 }}>O que vamos assistir?</p>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Carregando sua agenda... 📅</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <section style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #10b981', paddingBottom: '10px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#10b981', fontSize: '1.4rem' }}>
                  {viewMode === 'HOJE' ? '📅 Filmes de Hoje' : '📆 Filmes da Semana'}
                </h2>
                <div style={{ display: 'flex', gap: '5px', backgroundColor: 'var(--card-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
                  <button onClick={() => setViewMode('HOJE')} className={viewMode === 'HOJE' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '6px 16px', fontSize: '0.85rem', width: 'auto', margin: 0, borderRadius: '6px' }}>
                    Hoje
                  </button>
                  <button onClick={() => setViewMode('SEMANA')} className={viewMode === 'SEMANA' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '6px 16px', fontSize: '0.85rem', width: 'auto', margin: 0, borderRadius: '6px' }}>
                    Semana
                  </button>
                </div>
              </div>
              {displayedMovies.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nenhum filme agendado para {viewMode === 'HOJE' ? 'hoje' : 'esta semana'}.</p>
              ) : (
                <>
                  <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {displayedMovies.slice(currentCarouselIndex, currentCarouselIndex + 3).map(movie => (
                      <HomeMovieCardItem 
                        key={movie.id} 
                        movie={movie}
                        onUpdate={handleUpdateMovie}
                        onShowDetails={handleShowDetails}
                        draggedMovieId={draggedMovieId}
                        dragOverMovieId={dragOverMovieId}
                        setDraggedMovieId={setDraggedMovieId}
                        setDragOverMovieId={setDragOverMovieId}
                        onDrop={handleDrop}
                        streamerMode={streamerMode}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>

                  {displayedMovies.length > 3 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                      <button 
                        className="btn-secondary" 
                        onClick={() => setCarouselIndex(prev => Math.max(0, prev - 3))} 
                        disabled={currentCarouselIndex === 0}
                        style={{ padding: '8px 16px', opacity: currentCarouselIndex === 0 ? 0.5 : 1, width: 'auto', margin: 0 }}
                      >
                        ⬅️ Anterior
                      </button>
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 'bold' }}>Página {Math.floor(currentCarouselIndex / 3) + 1} de {Math.ceil(displayedMovies.length / 3)}</span>
                      <button 
                        className="btn-secondary" 
                        onClick={() => setCarouselIndex(prev => prev + 3)} 
                        disabled={currentCarouselIndex + 3 >= displayedMovies.length}
                        style={{ padding: '8px 16px', opacity: currentCarouselIndex + 3 >= displayedMovies.length ? 0.5 : 1, width: 'auto', margin: 0 }}
                      >
                        Próxima ➡️
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {terrorDaSemana && (
              <section style={{ width: '100%' }}>
                <h2 style={{ borderBottom: '2px solid #ef4444', paddingBottom: '10px', margin: '0 0 20px 0', color: '#ef4444', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>🔪 Sexta do Terror</h2>
                <div 
                  onClick={() => handleShowDetails(terrorDaSemana.tmdbId)}
                  style={{ cursor: 'pointer', background: 'linear-gradient(145deg, #3a0a0a, #111)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'center', transition: 'transform 0.2s, box-shadow 0.2s', boxSizing: 'border-box', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(239, 68, 68, 0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {terrorDaSemana.poster ? (
                    <img src={`https://image.tmdb.org/t/p/w154${terrorDaSemana.poster}`} alt={terrorDaSemana.title} style={{ width: '100px', height: '150px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.6)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '100px', height: '150px', backgroundColor: '#333', borderRadius: '8px', flexShrink: 0 }}></div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '1.3rem', color: '#fff', textShadow: '1px 1px 3px rgba(0,0,0,0.8)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={terrorDaSemana.title}>{terrorDaSemana.title}</strong>
                    <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '12px', fontSize: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '6px', alignSelf: 'flex-start' }}>📅 {new Date(terrorDaSemana.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </>
      )}
      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />
    </div>
  );
}