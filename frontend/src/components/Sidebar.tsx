import { Home, Search, Film, BarChart2, Settings as SettingsIcon, UserPlus, LogOut } from 'lucide-react';

interface SidebarProps {
  view: string;
  handleNavigation: (view: any) => void;
  user: any;
  handleLogout: () => void;
}

export default function Sidebar({ view, handleNavigation, user, handleLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1 className="sidebar-title" onClick={() => handleNavigation('home')} style={{ cursor: 'pointer' }}>Sumasflix</h1>

      {user && (
        <div className="user-profile">
          <img src={user.avatar || 'https://via.placeholder.com/150?text=Sem+Foto'} alt="Perfil" className="user-avatar" />
          <p className="user-name">{user.name || user.email}</p>
        </div>
      )}

      <nav className="sidebar-nav">
        <button className={`sidebar-btn ${view === 'home' ? 'active' : ''}`} onClick={() => handleNavigation('home')}><Home size={18} /> Início</button>
        <button className={`sidebar-btn ${view === 'search' ? 'active' : ''}`} onClick={() => handleNavigation('search')}><Search size={18} /> Buscar Filmes</button>
        <button className={`sidebar-btn ${view === 'saved' ? 'active' : ''}`} onClick={() => handleNavigation('saved')}><Film size={18} /> Meus Filmes</button>
        <button className={`sidebar-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavigation('dashboard')}><BarChart2 size={18} /> Dashboard</button>
        <button className={`sidebar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => handleNavigation('settings')}><SettingsIcon size={18} /> Configurações</button>
        {user?.isAdmin && (
          <button className={`sidebar-btn ${view === 'register' ? 'active' : ''}`} onClick={() => handleNavigation('register')}><UserPlus size={18} /> Criar Usuário</button>
        )}
      </nav>



      <div className="sidebar-footer">
        <button className="sidebar-btn logout-btn" onClick={handleLogout}><LogOut size={18} /> Sair</button>
      </div>
    </aside>
  );
}