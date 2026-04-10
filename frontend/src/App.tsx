import { useState, useEffect } from 'react';
import api from './services/api';
import Login from './components/Login';
import MovieSearch from './components/MovieSearch';
import SavedMovies from './components/SavedMovies';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import RegisterUser from './components/RegisterUser';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [view, setView] = useState<'search' | 'saved' | 'dashboard' | 'settings' | 'register'>('search');
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<{ bestMovie: any, topRescuer: string | null }>({ bestMovie: null, topRescuer: null });

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
          
          let bestMovie = null;
          let topRescuer = null;

          const watchedWithRatings = monthMovies.filter((m: any) => m.watched && m.streamerRating != null);
          if (watchedWithRatings.length > 0) {
            bestMovie = watchedWithRatings.reduce((prev: any, current: any) => (prev.streamerRating > current.streamerRating) ? prev : current);
          }

          const rescuerCounts: Record<string, number> = {};
          monthMovies.forEach((m: any) => {
            if (m.requestedBy) {
              rescuerCounts[m.requestedBy] = (rescuerCounts[m.requestedBy] || 0) + 1;
            }
          });
          
          const rescuers = Object.keys(rescuerCounts);
          if (rescuers.length > 0) {
            const maxCount = Math.max(...Object.values(rescuerCounts));
            const tops = rescuers.filter(r => rescuerCounts[r] === maxCount);
            topRescuer = tops.length > 1 ? `Empate: ${tops.join(', ')}` : tops[0];
          }

          setStats({ bestMovie, topRescuer });
        })
        .catch(err => console.error('Erro ao carregar estatísticas', err));
    }
  }, [token, view]); // Atualiza as estatísticas toda vez que você trocar de aba!

  return (
    <>
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
      {token ? (
      <div className="app-container">
        <aside className="sidebar">
            <h1 className="sidebar-title" onClick={() => setView('search')} style={{ cursor: 'pointer' }}>Sealflix</h1>

          {user && (
            <div className="user-profile">
              <img src={user.avatar || 'https://via.placeholder.com/150?text=Sem+Foto'} alt="Perfil" className="user-avatar" />
              <p className="user-name">{user.name || user.email}</p>
            </div>
          )}

          <nav className="sidebar-nav">
            <button className={`sidebar-btn ${view === 'search' ? 'active' : ''}`} onClick={() => setView('search')}>🔍 Buscar Filmes</button>
            <button className={`sidebar-btn ${view === 'saved' ? 'active' : ''}`} onClick={() => setView('saved')}>🎬 Meus Filmes</button>
            <button className={`sidebar-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>📊 Dashboard</button>
            <button className={`sidebar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>⚙️ Configurações</button>
            {user?.email === 'admin@sumasmovie.com' && (
              <button className={`sidebar-btn ${view === 'register' ? 'active' : ''}`} onClick={() => setView('register')}>👥 Criar Usuário</button>
            )}
          </nav>

          {(stats.bestMovie || stats.topRescuer) && (
            <div className="sidebar-hall-of-fame">
              <h3>🏆 Destaques do Mês</h3>
              {stats.bestMovie && (
                <div className="hof-card gold">
                  <span>Melhor Filme</span>
                  <strong>{stats.bestMovie.title}</strong>
                  <small>por {stats.bestMovie.requestedBy || 'Ninguém'}</small>
                </div>
              )}
              {stats.topRescuer && (
                <div className="hof-card silver">
                  <span>🚀 Mais Resgates</span>
                  <strong>{stats.topRescuer}</strong>
                  <small>Recompensa: +1 Filme</small>
                </div>
              )}
            </div>
          )}

          <div className="sidebar-footer">
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>🚪 Sair</button>
          </div>
        </aside>
        
        <main className="main-content">
          {view === 'search' && <MovieSearch token={token} />}
          {view === 'saved' && <SavedMovies token={token} />}
          {view === 'dashboard' && <Dashboard token={token} />}
          {view === 'settings' && <Settings token={token} user={user} setUser={setUser} />}
          {view === 'register' && <RegisterUser token={token} />}
        </main>
      </div>
      ) : (
        <Login onLoginSuccess={setToken} />
      )}
    </>
  );
}
