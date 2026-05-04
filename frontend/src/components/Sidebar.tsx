interface SidebarProps {
  view: string;
  handleNavigation: (view: any) => void;
  user: any;
  handleLogout: () => void;
  streamerMode: boolean;
  stats: any;
  setShowBestMoviesModal: (val: boolean) => void;
  setShowTopRescuersModal: (val: boolean) => void;
}

export default function Sidebar({ view, handleNavigation, user, handleLogout, streamerMode, stats, setShowBestMoviesModal, setShowTopRescuersModal }: SidebarProps) {
  return (
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
        {user?.isAdmin && (
          <button className={`sidebar-btn ${view === 'register' ? 'active' : ''}`} onClick={() => handleNavigation('register')}>👥 Criar Usuário</button>
        )}
      </nav>

      {streamerMode && (stats.bestMovies.length > 0 || (stats.topRescuer && stats.topRescuer !== 'N/A')) && (
        <div className="sidebar-hall-of-fame">
          <h3>🏆 Destaques do Mês</h3>
          {stats.bestMovies.length > 0 && (
            <div className="hof-card gold" onClick={() => setShowBestMoviesModal(true)} style={{ cursor: 'pointer', transition: '0.2s' }} title="Ver filmes com a maior nota">
              <span>⭐ Melhor Filme</span>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.bestMovies.length === 1 ? stats.bestMovies[0].title : `${stats.bestMovies.length} empatados!`}
              </strong>
              <small style={{ textDecoration: 'underline' }}>{stats.bestMovies.length === 1 ? 'Exibir Campeão' : 'Desempatar'}</small>
            </div>
          )}
          {stats.topRescuer && stats.topRescuer !== 'N/A' && (
            <div className="hof-card silver" onClick={() => setShowTopRescuersModal(true)} style={{ cursor: 'pointer', transition: '0.2s' }} title="Clique para ver o pódio do mês">
              <span>🚀 Mais Resgates</span>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.topRescuer} {stats.topRescuer !== 'Empate!' && stats.monthRanking?.[0] ? `(${stats.monthRanking[0].count})` : ''}
              </strong>
              {stats.topRescuer === 'Empate!' ? (
                <small style={{ textDecoration: 'underline' }}>{stats.monthRanking?.filter((r: any) => r.count === stats.monthRanking?.[0]?.count).length} empatados ({stats.monthRanking?.[0]?.count} resg.)</small>
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
  );
}