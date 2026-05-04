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
import toast, { Toaster } from 'react-hot-toast';
import Modal from './components/Modal';
import Sidebar from './components/Sidebar';
import Podium from './components/Podium';

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

      const fetchStats = () => {
        api.get('/movies/stats', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => {
            const data = res.data;
            const currentMonth = new Date().toISOString().substring(0, 7);
            setChampion(data.champions[currentMonth] || null);
            setStats({ bestMovies: data.bestMovies, topRescuer: data.monthTopRescuer, monthRanking: data.monthRanking });
          })
          .catch(err => console.error('Erro ao carregar estatísticas', err));
      };

      fetchStats();
      window.addEventListener('moviesUpdated', fetchStats);
      return () => window.removeEventListener('moviesUpdated', fetchStats);
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
        <Sidebar 
          view={view} handleNavigation={handleNavigation} user={user} handleLogout={handleLogout}
          streamerMode={streamerMode} stats={stats} setShowBestMoviesModal={setShowBestMoviesModal} setShowTopRescuersModal={setShowTopRescuersModal}
        />
        
        <main className="main-content">
          {view === 'search' && <MovieSearch token={token} streamerMode={streamerMode} />}
          {view === 'saved' && <SavedMovies token={token} streamerMode={streamerMode} />}
          {view === 'dashboard' && <Dashboard token={token} username={user?.name} streamerMode={streamerMode} user={user} />}
          {view === 'settings' && <Settings token={token} user={user} setUser={setUser} streamerMode={streamerMode} setStreamerMode={setStreamerMode} />}
          {view === 'register' && <RegisterUser token={token} />}
        </main>
      </div>
      
      {/* Modal do Melhor Filme do Mês (Desempate / Campeão) */}
      <Modal isOpen={showBestMoviesModal} onClose={() => setShowBestMoviesModal(false)} style={{ textAlign: 'center', transition: 'all 0.5s ease' }}>
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
                  Temos {stats.bestMovies.length} filmes com nota {stats.bestMovies[0]?.streamerRating}! Escolha o grande campeão:
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
                        onClick={async () => {
                          try {
                            if (champion && champion.id !== movie.id) {
                              await api.put(`/movies/${champion.id}`, { isChampion: false }, { headers: { Authorization: `Bearer ${token}` } });
                            }
                            if (champion?.id === movie.id) {
                              await api.put(`/movies/${movie.id}`, { isChampion: false }, { headers: { Authorization: `Bearer ${token}` } });
                              setChampion(null);
                            } else {
                              await api.put(`/movies/${movie.id}`, { isChampion: true }, { headers: { Authorization: `Bearer ${token}` } });
                              setChampion({...movie, isChampion: true});
                            }
                            window.dispatchEvent(new Event('moviesUpdated'));
                          } catch (error) {
                            toast.error('Erro ao atualizar campeão do mês.');
                          }
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
      </Modal>

      {/* Modal do Pódio do Mês na Sidebar */}
      <Modal isOpen={showTopRescuersModal} onClose={() => setShowTopRescuersModal(false)}>
        <h2 style={{ marginBottom: '25px', color: 'var(--primary)', textAlign: 'center' }}>🏆 Pódio do Mês</h2>
        <Podium ranking={stats.monthRanking || []} />
      </Modal>
      </>
      ) : (
        <Login onLoginSuccess={setToken} />
      )
    } />
      </Routes>
    </BrowserRouter>
  );
}
