import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Modal from './Modal';

export default function PublicList() {
  // Assumindo que a URL seja algo como /lista-publica/:username
  const { username } = useParams();
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [selectedRescuer, setSelectedRescuer] = useState<string | null>(null);
  const [view, setView] = useState<'CALENDAR' | 'WATCHED' | 'RATINGS'>('CALENDAR');
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<{ date: string, movies: any[] } | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchPublicMovies = async () => {
      try {
        // Requisição para uma rota pública no seu backend
        const response = await api.get(`/movies/public/${username}`);
        setMovies(response.data);
      } catch (err) {
        setError('Não foi possível carregar a lista deste usuário.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPublicMovies();
  }, [username]);

  useEffect(() => {
    // Abre o mês mais recente automaticamente se nenhum estiver aberto
    if (movies.length > 0 && Object.keys(expandedMonths).length === 0) {
      const watched = movies.filter(m => m.watched);
      if (watched.length > 0) {
        const latest = watched.sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime())[0];
        const key = latest.watchDate ? String(latest.watchDate).substring(0, 7) : 'none';
        setExpandedMonths({ [key]: true });
      }
    }
  }, [movies, expandedMonths]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Carregando lista... 🍿</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--danger)' }}>{error}</div>;
  }

  const lowerCaseQuery = searchQuery.toLowerCase();

  const watchedMovies = movies
    .filter(m => m.watched)
    .filter(m => m.title.toLowerCase().includes(lowerCaseQuery) || (m.requestedBy && m.requestedBy.toLowerCase().includes(lowerCaseQuery)))
    .sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime());

  // Agrupa os filmes assistidos por mês (ex: "2024-05")
  const groupedWatchedMovies: Record<string, any[]> = {};
  watchedMovies.forEach(m => {
    const key = m.watchDate ? String(m.watchDate).substring(0, 7) : 'none';
    if (!groupedWatchedMovies[key]) groupedWatchedMovies[key] = [];
    groupedWatchedMovies[key].push(m);
  });

  // Ordena os meses do mais recente para o mais antigo
  const sortedMonthKeys = Object.keys(groupedWatchedMovies).sort((a, b) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    return b.localeCompare(a);
  });

  const getMonthLabel = (key: string) => {
    if (key === 'none') return 'Sem data';
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  // Lógica para agrupar e calcular a média de notas dos resgatadores (mínimo de 3 filmes)
  const rescuerStats: Record<string, { totalRescues: number, ratedCount: number, ratingSum: number }> = {};
  movies.forEach(m => {
    const name = m.requestedBy?.trim();
    if (!name || name.toLowerCase() === 'ninguém') return;

    if (!rescuerStats[name]) {
      rescuerStats[name] = { totalRescues: 0, ratedCount: 0, ratingSum: 0 };
    }
    rescuerStats[name].totalRescues += 1;
    if (m.watched && m.streamerRating != null) {
      rescuerStats[name].ratedCount += 1;
      rescuerStats[name].ratingSum += m.streamerRating;
    }
  });

  const topRescuers = Object.entries(rescuerStats)
    .filter(([name, stats]) => stats.totalRescues >= 3 && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas')
    .map(([name, stats]) => ({
      name,
      totalRescues: stats.totalRescues,
      avgRating: stats.ratedCount > 0 ? (stats.ratingSum / stats.ratedCount).toFixed(1) : 'N/A',
    }))
    .sort((a, b) => b.totalRescues - a.totalRescues);

  const filteredRescuers = topRescuers.filter(r => r.name.toLowerCase().includes(lowerCaseQuery));

  // Filtra e ordena os filmes específicos do usuário clicado
  const rescuerMovies = selectedRescuer
    ? movies.filter(m => m.requestedBy?.trim() === selectedRescuer).sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime())
    : [];

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
      <style>
        {`
          :root {
            --primary-rgb: 245, 158, 11;
            --success-rgb: 16, 185, 129;
          }
          .public-card {
            background-color: var(--card-bg);
            border: 1px solid var(--input-border);
            border-radius: 12px;
            padding: 25px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          .accordion-item { margin-bottom: 10px; }
          .accordion-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; background-color: var(--card-bg); padding: 15px 20px; border-radius: 8px; border: 1px solid var(--input-border); transition: all 0.2s ease-in-out; }
          .accordion-header:hover { background-color: rgba(var(--primary-rgb), 0.1); border-color: var(--primary); transform: translateY(-2px); }
          .accordion-header.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; background-color: rgba(var(--success-rgb), 0.08); border-color: var(--success); }
          .accordion-content { list-style: none; padding: 0px 20px; margin: 0; background-color: var(--bg-color); border: 1px solid var(--input-border); border-top: none; border-radius: 0 0 8px 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.5s ease-in-out, opacity 0.3s ease-out, padding 0.5s ease-in-out; }
          .accordion-content.expanded { max-height: 2000px; opacity: 1; padding-top: 20px; padding-bottom: 20px; }
          .watched-movie-card { display: flex; align-items: center; gap: 15px; padding: 12px; background-color: var(--card-bg); border-radius: 8px; border: 1px solid var(--input-border); transition: transform 0.2s, box-shadow 0.2s; min-width: 0; }
          .watched-movie-card:hover { transform: scale(1.03); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
          .rating-card { background-color: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--input-border); text-align: center; cursor: pointer; transition: all 0.2s ease-in-out; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          .rating-card:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.15); border-color: var(--primary); }

          .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 5px; flex: 1; min-height: 0; }
          .calendar-header { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--input-border); color: #aaa; font-size: 0.9rem; }
          .calendar-cell { background-color: var(--bg-color); border: 1px solid var(--input-border); border-radius: 8px; padding: 4px; display: flex; flex-direction: column; transition: all 0.2s ease-in-out; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
          .calendar-cell:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); border-color: var(--primary); }
          .calendar-cell.empty { background-color: transparent; border: 1px solid #222; }
          .calendar-cell.today { background-color: rgba(245, 158, 11, 0.05); border: 2px solid var(--primary); }
          .calendar-day-number { font-size: 0.85rem; color: #888; font-weight: bold; margin-bottom: 5px; align-self: flex-end; }
          .calendar-cell.today .calendar-day-number { color: var(--primary); font-weight: bold; }
          .calendar-movie-list { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
          .calendar-movie-list::-webkit-scrollbar { width: 4px; }
          .calendar-movie-list::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
          .calendar-movie { font-size: 0.8rem; padding: 5px 8px; border-radius: 4px; text-align: left; line-height: 1.3; overflow: hidden; cursor: pointer; min-width: 0; }
          .calendar-movie:hover { filter: brightness(1.2); }
          .calendar-movie.upcoming { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border-left: 3px solid #f59e0b; }
          .calendar-movie.watched { background-color: rgba(16, 185, 129, 0.1); color: #10b981; border-left: 3px solid #10b981; text-decoration: line-through; opacity: 0.8; }
          .calendar-movie strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          @media (max-width: 768px) {
            .calendar-grid { gap: 4px; }
            .calendar-header { font-size: 0.8rem; margin-bottom: 10px; }
            .calendar-cell { min-height: 100px; padding: 5px; }
            .calendar-movie { font-size: 0.7rem; padding: 4px 6px; }
          }
        `}
      </style>

      {/* Todo conteúdo rolável centralizado no Main, com header sticky */}
      <main style={{ flex: 1, overflowY: 'auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingTop: '20px' }}>
        
        {/* Cabeçalho Sticky Unificado (Título e Filtros no mesmo nível) */}
        <header className="public-card" style={{ position: 'sticky', top: '20px', zIndex: 10, flexShrink: 0, margin: '0 auto 40px auto', width: 'calc(100% - 40px)', maxWidth: '1400px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '15px 20px', boxSizing: 'border-box' }}>
          <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>
            Lista de Filmes - {username} 🎬
          </h1>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={view === 'CALENDAR' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('CALENDAR')} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>📅 Calendário</button>
              <button className={view === 'WATCHED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('WATCHED')} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>✅ Já Assistidos</button>
              <button className={view === 'RATINGS' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('RATINGS')} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>🏆 Notas</button>
            </div>
            
            <input
              type="text"
              placeholder="🔍 Buscar filme ou nick..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: '1 1 200px', maxWidth: '300px', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-color)', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem' }}
            />
          </div>
        </header>

          {view === 'CALENDAR' && (
            <div className="public-card" style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="btn-secondary" style={{ width: 'auto', margin: 0, padding: '8px 15px' }}>⬅️ Anterior</button>
                <h2 style={{ textTransform: 'capitalize', margin: 0, color: 'var(--primary)', textAlign: 'center', flex: 1 }}>
                  {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="btn-secondary" style={{ width: 'auto', margin: 0, padding: '8px 15px' }}>Próximo ➡️</button>
              </div>
              <div className="calendar-header">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div className="calendar-grid" style={{ flex: 1, minHeight: 0 }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="calendar-cell empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === todayDate && month === todayMonth && year === todayYear;
                  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayMovies = movies.filter(m => m.watchDate && String(m.watchDate).startsWith(dateString) && (m.title.toLowerCase().includes(lowerCaseQuery) || (m.requestedBy && m.requestedBy.toLowerCase().includes(lowerCaseQuery))));

                  return (
                    <div 
                      key={day} 
                      className={`calendar-cell ${isToday ? 'today' : ''}`}
                      style={{ cursor: dayMovies.length > 0 ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (dayMovies.length > 0) {
                          setSelectedDay({
                            date: new Date(year, month, day).toLocaleDateString('pt-BR'),
                            movies: dayMovies
                          });
                        }
                      }}
                    >
                      <span className="calendar-day-number">{day}</span>
                      <div className="calendar-movie-list">
                        {dayMovies.map(m => (
                          <div 
                            key={m.id} 
                            className={`calendar-movie ${m.watched ? 'watched' : 'upcoming'}`} 
                            title={`${m.title}${m.requestedBy ? ` - ${m.requestedBy}` : ''}`}
                          >
                            <strong>{m.title}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'RATINGS' && (
            <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
              {filteredRescuers.length === 0 ? <p style={{ textAlign: 'center' }}>Nenhum resgatador encontrado.</p> : (
                <h2 style={{ color: '#8b5cf6', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🏆 Média de Notas
                </h2>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '20px', alignContent: 'start' }}>
                  {filteredRescuers.map(rescuer => (
                    <div 
                      key={rescuer.name} 
                      onClick={() => setSelectedRescuer(rescuer.name)}
                      className="rating-card"
                      title={`Ver filmes resgatados por ${rescuer.name}`}
                    >
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rescuer.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '10px' }}>{rescuer.totalRescues} filmes resgatados</div>
                      <div style={{ display: 'inline-block', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.95rem' }}>
                        Média Streamer: {rescuer.avgRating !== 'N/A' ? `⭐ ${rescuer.avgRating}` : 'Sem notas'}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {view === 'WATCHED' && (
            <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
              <h2 style={{ color: '#10b981', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                Já Assistidos ✅
              </h2>
              {watchedMovies.length === 0 ? <p>Nenhum filme assistido ainda.</p> : (
                <div>
                  {sortedMonthKeys.map((monthKey) => {
                    const isExpanded = expandedMonths[monthKey];
                    return (
                    <div key={monthKey} className="accordion-item">
                      <div 
                        onClick={() => toggleMonth(monthKey)}
                        className={`accordion-header ${isExpanded ? 'expanded' : ''}`}
                      >
                        <h3 style={{ color: isExpanded ? 'var(--success)' : 'var(--primary)', margin: 0, fontSize: '1.2rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {getMonthLabel(monthKey)}
                          <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 'normal' }}>
                            ({groupedWatchedMovies[monthKey].length} filme{groupedWatchedMovies[monthKey].length > 1 ? 's' : ''})
                          </span>
                        </h3>
                        <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: isExpanded ? 'var(--success)' : 'var(--primary)' }}>
                          🔽
                        </span>
                      </div>
                      
                        <ul className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                          {groupedWatchedMovies[monthKey].map(movie => (
                            <li 
                              key={movie.id} 
                              className="watched-movie-card"
                            >
                              <div>
                                {movie.poster ? (
                                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: 0.7 }} />
                                ) : (
                                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: 0.7 }}>Sem capa</div>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '0.9rem', display: 'block', color: '#aaa', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={movie.title}>{movie.title}</strong>
                                {movie.requestedBy && (
                                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    De: <span style={{ color: 'var(--text-color)' }}>{movie.requestedBy}</span>
                                  </div>
                                )}
                                {movie.watchDate && (
                                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                    {new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ color: '#f59e0b', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '5px 10px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.9rem' }}>
                                {movie.streamerRating != null ? `⭐ ${movie.streamerRating.toFixed(1)}` : 'S/N'}
                              </div>
                            </li>
                          ))}
                        </ul>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
      </main>

      {/* Modal de Detalhes dos Resgates */}
      <Modal isOpen={!!selectedRescuer} onClose={() => setSelectedRescuer(null)} maxWidth="600px">
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>
          🍿 Resgates de {selectedRescuer}
        </h2>
        {rescuerMovies.length === 0 ? (
          <p style={{ textAlign: 'center' }}>Nenhum filme encontrado.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {rescuerMovies.map(movie => (
              <li 
                key={movie.id} 
                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', backgroundColor: 'var(--card-bg)', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--input-border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div>
                  {movie.poster ? (
                    <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: movie.watched ? 0.7 : 1 }} />
                  ) : (
                    <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: movie.watched ? 0.7 : 1 }}>Sem capa</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '1rem', display: 'block', color: movie.watched ? '#aaa' : 'var(--text-color)', textDecoration: movie.watched ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={movie.title}>{movie.title}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                    {movie.watched ? (movie.watchDate ? `Assistido em ${new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Assistido') : (movie.watchDate ? `Na fila para ${new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Sem data')}
                  </div>
                </div>
                <div style={{ color: movie.watched ? '#f59e0b' : '#10b981', fontWeight: 'bold', backgroundColor: movie.watched ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '5px 10px', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                  {movie.watched ? (movie.streamerRating != null ? `⭐ ${movie.streamerRating.toFixed(1)}` : 'Sem nota') : 'Agendado'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Modal de Filmes do Dia (Calendário) */}
      <Modal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} maxWidth="550px">
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>
          📅 Filmes de {selectedDay?.date}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedDay?.movies.map(movie => (
            <li 
              key={movie.id} 
              style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--input-border)' }}
            >
              <div style={{ flexShrink: 0 }}>
                {movie.poster ? (
                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: movie.watched ? 0.7 : 1 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: movie.watched ? 0.7 : 1 }}>Sem capa</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.05rem', display: 'block', color: movie.watched ? '#aaa' : 'var(--text-color)', textDecoration: movie.watched ? 'line-through' : 'none' }}>{movie.title}</strong>
                {movie.requestedBy && (
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                    Resgatado por: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{movie.requestedBy}</span>
                  </div>
                )}
              </div>
              <div style={{ color: movie.watched ? '#10b981' : '#f59e0b', fontWeight: 'bold', backgroundColor: movie.watched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '5px 10px', borderRadius: '6px', textAlign: 'center', minWidth: '80px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{movie.watched ? 'Assistido' : 'Na fila'}</span>
                {movie.watched && movie.streamerRating != null && (
                   <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>⭐ {movie.streamerRating}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}