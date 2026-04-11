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
  const [stats, setStats] = useState<{ bestMovies: any[], topRescuer: string | null, topRescuerList?: { name: string, count: number }[] }>({ bestMovies: [], topRescuer: null });
  const [showTieModal, setShowTieModal] = useState(false);
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
          
          let bestMovies: any[] = [];
          let topRescuer = null;

          const watchedWithRatings = monthMovies.filter((m: any) => m.watched && m.streamerRating != null);
          if (watchedWithRatings.length > 0) {
            const maxRating = Math.max(...watchedWithRatings.map((m: any) => m.streamerRating));
            bestMovies = watchedWithRatings.filter((m: any) => m.streamerRating === maxRating);
          }

          const rescuerCounts: Record<string, number> = {};
          monthMovies.forEach((m: any) => {
            const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
            if (name.toLowerCase() !== 'ninguém' && name !== '') {
              rescuerCounts[name] = (rescuerCounts[name] || 0) + 1;
            }
          });
          
          const rescuers = Object.keys(rescuerCounts);
          let topRescuerList: { name: string, count: number }[] = [];
          if (rescuers.length > 0) {
            const maxCount = Math.max(...Object.values(rescuerCounts));
            const tops = rescuers.filter(r => rescuerCounts[r] === maxCount);
            topRescuer = tops.length > 1 ? 'Empate!' : tops[0];
            topRescuerList = tops.map(name => ({ name, count: maxCount }));
          }

          setStats({ bestMovies, topRescuer, topRescuerList });
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

          {(stats.bestMovies.length > 0 || stats.topRescuer) && (
            <div className="sidebar-hall-of-fame">
              <h3>🏆 Destaques do Mês</h3>
              {stats.bestMovies.length > 0 && (
                <div 
                  className="hof-card gold"
                  onClick={() => {
                    if (stats.bestMovies.length === 1) {
                      setChampion(stats.bestMovies[0]);
                    } else {
                      setChampion(null);
                    }
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
              onClick={() => { if (stats.topRescuer === 'Empate!') setShowTieModal(true); }}
              style={{ cursor: stats.topRescuer === 'Empate!' ? 'pointer' : 'default', transition: '0.2s' }}
              title={stats.topRescuer === 'Empate!' ? 'Clique para ver quem empatou' : ''}
            >
                  <span>🚀 Mais Resgates</span>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.topRescuer} {stats.topRescuer !== 'Empate!' && stats.topRescuerList?.[0] ? `(${stats.topRescuerList[0].count})` : ''}
              </strong>
              {stats.topRescuer === 'Empate!' ? (
                <small style={{ textDecoration: 'underline' }}>{stats.topRescuerList?.length} empatados ({stats.topRescuerList?.[0]?.count} resgates)</small>
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
                  Temos {stats.bestMovies.length} filmes empatados com a nota {stats.bestMovies[0]?.streamerRating}! Escolha o grande campeão:
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
                        style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto', whiteSpace: 'nowrap', backgroundColor: '#fbbf24', color: '#000', border: 'none' }}
                        onClick={() => setChampion(movie)}
                      >
                        Coroar 👑
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

      {/* Modal de Empate do Mês na Sidebar */}
      {showTieModal && (
        <div onClick={() => setShowTieModal(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '350px', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowTieModal(false)} className="close-btn">&times;</button>
            <h2 style={{ marginBottom: '10px', color: 'var(--primary)', textAlign: 'center' }}>🤝 Empate do Mês</h2>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa', fontSize: '0.9rem' }}>
              Estes usuários estão empatados em 1º lugar com <strong>{stats.topRescuerList?.[0]?.count}</strong> resgate(s) neste mês:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.topRescuerList?.map((user, index) => (
                <li key={index} style={{ padding: '12px 10px', borderBottom: '1px solid var(--input-border)', fontWeight: 'bold', textAlign: 'center' }}>
                  {user.name}
                </li>
              ))}
            </ul>
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
