import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './services/api';
import Login from './components/Login';
import MovieSearch from './components/MovieSearch';
import SavedMovies from './components/SavedMovies';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import RegisterUser from './components/RegisterUser';
import PublicList from './components/PublicList';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [view, setView] = useState<'search' | 'saved' | 'dashboard' | 'settings' | 'register'>('search');
  const [user, setUser] = useState<any>(null);
  const [streamerMode, setStreamerMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('streamerMode');
    return saved !== null ? saved === 'true' : true;
  });
  const [stats, setStats] = useState<{ bestMovies: any[], topRescuer: string | null, monthRanking?: { name: string, count: number }[] }>({ bestMovies: [], topRescuer: null });
  const [showTopRescuersModal, setShowTopRescuersModal] = useState(false);
  const [showBestMoviesModal, setShowBestMoviesModal] = useState(false);
  const [champion, setChampion] = useState<any>(null);

  const handleNavigation = (newView: typeof view) => {
    setView(newView);
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setView('search'); // Volta para a tela padrão (Buscar Filmes) ao deslogar
  };

  useEffect(() => {
    if (token) {
      api.get('/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data))
        .catch(err => console.error('Erro ao carregar perfil', err));

      // Carrega as estatísticas do Mês Atual para o Hall da Fama
      api.get('/movies', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const currentMonth = new Date().toISOString().substring(0, 7); // Ex: "2024-04"
          const monthMovies = res.data.filter((m: any) => (m.watchDate ? String(m.watchDate).substring(0, 7) : 'none') === currentMonth);
          
          // Apenas filmes com nota 10 podem ser escolhidos como o Melhor Filme do Mês
          const bestMovies = monthMovies.filter((m: any) => m.watched && m.streamerRating === 10);

          const rescuerCounts: Record<string, number> = {};
          monthMovies.forEach((m: any) => {
            const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
            if (name.toLowerCase() !== 'ninguém' && name !== '') {
              rescuerCounts[name] = (rescuerCounts[name] || 0) + 1;
            }
          });
          
          const monthRanking = Object.entries(rescuerCounts)
            .filter(([name]) => name.toLowerCase() !== 'chat')
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          let topRescuer = 'N/A';
          if (monthRanking.length > 0) {
            const maxCount = monthRanking[0].count;
            const tops = monthRanking.filter(r => r.count === maxCount);
            topRescuer = tops.length > 1 ? 'Empate!' : tops[0].name;
          }

          setStats({ bestMovies, topRescuer, monthRanking });
        })
        .catch(err => console.error('Erro ao carregar estatísticas', err));
    }
  }, [token, view]); // Atualiza as estatísticas toda vez que você trocar de aba!

  return (
    <BrowserRouter>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--input-border)'
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } },
          error: { iconTheme: { primary: 'var(--danger)', secondary: '#fff' } },
        }} 
      />
      <Routes>
        <Route path="/lista-publica/:username" element={<PublicList />} />
        <Route path="*" element={
          token ? (
          <>
          <div className="app-container">
        <aside className="sidebar">
            <h1 className="sidebar-title" onClick={() => handleNavigation('search')} style={{ cursor: 'pointer' }}>Sumasflix</h1>

          {user && (
            <div className="user-profile">
              <img src={user.avatar || 'https://via.placeholder.com/150?text=Sem+Foto'} alt="Perfil" className="user-avatar" />
              <p className="user-name">{user.name || user.email}</p>
            </div>
          )}

          <nav className="sidebar-nav">
            <button className={`sidebar-btn ${view === 'search' ? 'active' : ''}`} onClick={() => handleNavigation('search')}>🔍 Buscar Filmes</button>
            <button className={`sidebar-btn ${view === 'saved' ? 'active' : ''}`} onClick={() => handleNavigation('saved')}>🎬 Meus Filmes</button>
            <button className={`sidebar-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavigation('dashboard')}>📊 Dashboard</button>
            <button className={`sidebar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => handleNavigation('settings')}>⚙️ Configurações</button>
            {user?.email === 'admin@sumasmovie.com' && (
              <button className={`sidebar-btn ${view === 'register' ? 'active' : ''}`} onClick={() => handleNavigation('register')}>👥 Criar Usuário</button>
            )}
          </nav>

          {streamerMode && (stats.bestMovies.length > 0 || stats.topRescuer) && (
            <div className="sidebar-hall-of-fame">
              <h3>🏆 Destaques do Mês</h3>
              {stats.bestMovies.length > 0 && (
                <div 
                  className="hof-card gold"
                  onClick={() => {
                    const currentMonth = new Date().toISOString().substring(0, 7);
                    const saved = localStorage.getItem('monthlyChampions');
                    const champs = saved ? JSON.parse(saved) : {};
                    setChampion(champs[currentMonth] || null);
                    setShowBestMoviesModal(true);
                  }}
                  style={{ cursor: 'pointer', transition: '0.2s' }}
                  title="Ver filmes com a maior nota"
                >
                  <span>⭐ Melhor Filme</span>
                  <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stats.bestMovies.length === 1 ? stats.bestMovies[0].title : `${stats.bestMovies.length} empatados!`}
                  </strong>
                  <small style={{ textDecoration: 'underline' }}>{stats.bestMovies.length === 1 ? 'Exibir Campeão' : 'Desempatar'}</small>
                </div>
              )}
              {stats.topRescuer && (
            <div 
              className="hof-card silver"
              onClick={() => setShowTopRescuersModal(true)}
              style={{ cursor: 'pointer', transition: '0.2s' }}
              title="Clique para ver o pódio do mês"
            >
                  <span>🚀 Mais Resgates</span>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.topRescuer} {stats.topRescuer !== 'Empate!' && stats.monthRanking?.[0] ? `(${stats.monthRanking[0].count})` : ''}
              </strong>
              {stats.topRescuer === 'Empate!' ? (
                <small style={{ textDecoration: 'underline' }}>{stats.monthRanking?.filter(r => r.count === stats.monthRanking?.[0]?.count).length} empatados ({stats.monthRanking?.[0]?.count} resg.)</small>
              ) : (
                <small>Recompensa: +1 Filme</small>
              )}
                </div>
              )}
            </div>
          )}

          <div className="sidebar-footer">
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>🚪 Sair</button>
          </div>
        </aside>
        
        <main className="main-content">
          {view === 'search' && <MovieSearch token={token} streamerMode={streamerMode} />}
          {view === 'saved' && <SavedMovies token={token} streamerMode={streamerMode} />}
          {view === 'dashboard' && <Dashboard token={token} username={user?.name} streamerMode={streamerMode} />}
          {view === 'settings' && <Settings token={token} user={user} setUser={setUser} streamerMode={streamerMode} setStreamerMode={setStreamerMode} />}
          {view === 'register' && <RegisterUser token={token} />}
        </main>
      </div>
      
      {/* Modal do Melhor Filme do Mês (Desempate / Campeão) */}
      {showBestMoviesModal && (
        <div onClick={() => { setShowBestMoviesModal(false); setChampion(null); }} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', textAlign: 'center', transition: 'all 0.5s ease' }}>
            <button onClick={() => { setShowBestMoviesModal(false); setChampion(null); }} className="close-btn">&times;</button>
            
            <style>
              {`
                @keyframes popIn {
                  0% { transform: scale(0.5); opacity: 0; }
                  70% { transform: scale(1.1); }
                  100% { transform: scale(1); opacity: 1; }
                }
                @keyframes glow {
                  0% { box-shadow: 0 0 10px #fbbf24; }
                  50% { box-shadow: 0 0 30px #fbbf24, 0 0 10px #fbbf24 inset; }
                  100% { box-shadow: 0 0 10px #fbbf24; }
                }
                .champion-card {
                  animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, glow 2s infinite alternate;
                  border: 4px solid #fbbf24;
                  border-radius: 12px;
                  padding: 20px;
                  background: linear-gradient(145deg, #2a2a2a, #111);
                  margin-top: 20px;
                }
              `}
            </style>

            {!champion ? (
              <>
                <h2 style={{ marginBottom: '10px', color: '#fbbf24' }}>⭐ Desempate do Melhor Filme</h2>
                <p style={{ marginBottom: '20px', color: '#aaa', fontSize: '0.9rem' }}>
                  Temos {stats.bestMovies.length} filmes com nota máxima (10)! Escolha o grande campeão:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {stats.bestMovies.map((movie: any) => (
                    <div key={movie.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', border: '1px solid var(--input-border)', borderRadius: '8px' }}>
                      {movie.poster ? (
                        <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '45px', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '45px', height: '68px', backgroundColor: '#333', borderRadius: '4px' }}></div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                        <strong style={{ display: 'block', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movie.title}</strong>
                        <small style={{ color: '#aaa' }}>Resgatado por: {movie.requestedBy || 'Ninguém'}</small>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto', whiteSpace: 'nowrap', backgroundColor: champion?.id === movie.id ? '#dc2626' : '#fbbf24', color: champion?.id === movie.id ? '#fff' : '#000', border: 'none' }}
                        onClick={() => {
                          const currentMonth = new Date().toISOString().substring(0, 7);
                          const saved = localStorage.getItem('monthlyChampions');
                          const champs = saved ? JSON.parse(saved) : {};
                          
                          if (champion?.id === movie.id) {
                            delete champs[currentMonth];
                            setChampion(null);
                          } else {
                            champs[currentMonth] = movie;
                            setChampion(movie);
                          }
                          localStorage.setItem('monthlyChampions', JSON.stringify(champs));
                          window.dispatchEvent(new Event('championsUpdated'));
                        }}
                      >
                        {champion?.id === movie.id ? 'Remover ❌' : 'Coroar 👑'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="champion-card">
                <h1 style={{ color: '#fbbf24', fontSize: '2rem', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '2px' }}>🏆 Campeão do Mês!</h1>
                {champion.poster ? (
                  <img src={`https://image.tmdb.org/t/p/w300${champion.poster}`} alt={champion.title} style={{ width: '200px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }} />
                ) : (
                  <div style={{ width: '200px', height: '300px', backgroundColor: '#333', borderRadius: '8px', margin: '0 auto 15px' }}></div>
                )}
                <h2 style={{ fontSize: '1.8rem', margin: '10px 0' }}>{champion.title}</h2>
                <p style={{ fontSize: '1.2rem', color: '#aaa' }}>Resgatado por: <strong style={{ color: '#fff' }}>{champion.requestedBy || 'Ninguém'}</strong></p>
                <div style={{ marginTop: '15px', display: 'inline-block', background: '#fbbf24', color: '#000', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  Nota: {champion.streamerRating} ⭐
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal do Pódio do Mês na Sidebar */}
      {showTopRescuersModal && (
        <div onClick={() => setShowTopRescuersModal(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowTopRescuersModal(false)} className="close-btn">&times;</button>
            <h2 style={{ marginBottom: '25px', color: 'var(--primary)', textAlign: 'center' }}>🏆 Pódio do Mês</h2>
            
            {stats.monthRanking && stats.monthRanking.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '10px', marginTop: '30px', marginBottom: '30px', height: '160px', padding: '0 20px' }}>
                {/* 2º Lugar */}
                {stats.monthRanking[1] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', textAlign: 'center' }} title={stats.monthRanking[1].name}>{stats.monthRanking[1].name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>{stats.monthRanking[1].count} resg.</span>
                    <div style={{ width: '100%', height: '80px', backgroundColor: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '2rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>2</div>
                  </div>
                )}
                {/* 1º Lugar */}
                {stats.monthRanking[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1.2, position: 'relative', zIndex: 2 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f59e0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textAlign: 'center' }} title={stats.monthRanking[0].name}>{stats.monthRanking[0].name}</span>
                    <span style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '5px' }}>{stats.monthRanking[0].count} resg.</span>
                    <div style={{ width: '100%', height: '110px', backgroundColor: '#f59e0b', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '2.5rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>1</div>
                  </div>
                )}
                {/* 3º Lugar */}
                {stats.monthRanking[2] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', textAlign: 'center' }} title={stats.monthRanking[2].name}>{stats.monthRanking[2].name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>{stats.monthRanking[2].count} resg.</span>
                    <div style={{ width: '100%', height: '60px', backgroundColor: '#b45309', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', color: '#fff', fontWeight: 'bold', fontSize: '1.8rem', borderRadius: '8px 8px 0 0', paddingTop: '10px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }}>3</div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#aaa', marginTop: '20px' }}>Nenhum resgate neste mês ainda.</p>
            )}
          </div>
        </div>
      )}
      </>
      ) : (
        <Login onLoginSuccess={setToken} />
      )
    } />
      </Routes>
    </BrowserRouter>
  );
}
