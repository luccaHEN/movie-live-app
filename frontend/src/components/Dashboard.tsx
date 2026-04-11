import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface DashboardProps {
  token: string;
  username?: string;
  streamerMode: boolean;
}

export default function Dashboard({ token, username, streamerMode }: DashboardProps) {
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);

  useEffect(() => {
    const fetchMovies = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/movies', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMovies(response.data);
      } catch (error) {
        toast.error("Erro ao carregar estatísticas.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMovies();
  }, [token]);

  if (isLoading) {
    return <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Calculando estatísticas... 📊</p>;
  }

  // Cálculos Estatísticos
  const totalMovies = movies.length;
  const watchedMoviesList = movies.filter(m => m.watched);
  const watchedMovies = watchedMoviesList.length;
  const unwatchedMovies = totalMovies - watchedMovies;
  
  // Cálculo do Tempo Total de Tela
  const totalWatchMinutes = watchedMoviesList.reduce((acc, m) => acc + (m.runtime || 105), 0);
  const totalWatchHours = Math.floor(totalWatchMinutes / 60);
  const totalWatchDays = (totalWatchHours / 24).toFixed(1);

  const streamerRatings = movies.filter(m => m.streamerRating && m.streamerRating > 0).map(m => m.streamerRating);
  const avgStreamerRating = streamerRatings.length ? (streamerRatings.reduce((a, b) => a + b, 0) / streamerRatings.length).toFixed(1) : 'N/A';

  const chatRatings = movies.filter(m => m.chatRating && m.chatRating > 0).map(m => m.chatRating);
  const avgChatRating = chatRatings.length ? (chatRatings.reduce((a, b) => a + b, 0) / chatRatings.length).toFixed(1) : 'N/A';

  const rescuerCounts = movies.reduce((acc, m) => {
    const name = m.requestedBy ? m.requestedBy.trim() : 'Ninguém';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Transforma o objeto em um Array ordenado (do maior para o menor)
  const ranking = Object.entries(rescuerCounts)
    .filter(([name]) => name.toLowerCase() !== 'ninguém' && name !== '')
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count);

  let topRescuer = 'N/A';
  let maxRescues = 0;
  if (ranking.length > 0) {
    maxRescues = ranking[0].count;
    const tiedUsers = ranking.filter(r => r.count === maxRescues);
    topRescuer = tiedUsers.length === 1 ? tiedUsers[0].name : 'Empate!';
  }

  // Próximos filmes agendados (Fila)
  const allUpcomingMovies = movies
    .filter(m => !m.watched && m.watchDate)
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());
  const upcomingMovies = allUpcomingMovies.slice(0, 3);

  // Dados para o Gráfico de Barras (Filmes assistidos nos últimos meses)
  const moviesPerMonth = movies.reduce((acc, m) => {
    if (m.watched && m.watchDate) {
      const month = new Date(m.watchDate).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const chartData = Object.entries(moviesPerMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6) as [string, number][]; // Pega no máximo os últimos 6 meses
  const maxMoviesInMonth = chartData.length > 0 ? Math.max(...chartData.map(d => d[1])) : 1;

  const handleCopyPublicLink = () => {
    // Pega o username do usuário dinamicamente e remove espaços indesejados
    const publicUrl = `${window.location.origin}/lista-publica/${username ? encodeURIComponent(username) : 'meu-canal'}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link público copiado para a área de transferência! 🔗');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
        <h2 style={{ color: 'var(--primary)', margin: '0' }}>Estatísticas da Stream 📊</h2>
        {streamerMode && (
          <button onClick={handleCopyPublicLink} className="btn-primary" style={{ padding: '8px 15px', fontSize: '0.9rem', width: 'auto' }}>🔗 Copiar Link Agenda</button>
        )}
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', width: '100%', alignItems: 'flex-start', justifyContent: 'center' }}>
        
        {/* Coluna Esquerda: 6 Métricas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: '1 1 250px', maxWidth: '300px' }}>
          <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Total de Filmes</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', margin: '0' }}>{totalMovies}</p>
          </div>
          <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Assistidos</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: '0' }}>{watchedMovies}</p>
          </div>
          <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Para Assistir</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', margin: '0' }}>{unwatchedMovies}</p>
          </div>
          <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Média Streamer</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6', margin: '0' }}>⭐ {avgStreamerRating}</p>
          </div>
          {streamerMode && (
            <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Média Chat</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6', margin: '0' }}>⭐ {avgChatRating}</p>
            </div>
          )}
          <div className="movie-card" style={{ padding: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Tempo de Tela</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: '0' }}>{totalWatchHours}h</p>
            <span style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '3px' }}>≈ {totalWatchDays} dias</span>
          </div>
        </div>

        {/* Coluna Direita: Gráfico e Top Resgatador */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '2 1 500px', minWidth: '300px' }}>
          
          {/* Gráfico de Barras: Filmes Assistidos por Mês */}
          {chartData.length > 0 && (
            <div className="movie-card" style={{ width: '100%', padding: '25px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', color: 'var(--primary)' }}>📈 Filmes Assistidos (Últimos Meses)</h3>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: '150px', gap: '10px' }}>
                {chartData.map(([month, count]) => (
                  <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <span style={{ marginBottom: '5px', fontWeight: 'bold' }}>{count}</span>
                    <div style={{ 
                      width: '100%', maxWidth: '50px', height: `${(count / maxMoviesInMonth) * 130}px`, 
                      backgroundColor: 'var(--primary)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease'
                    }}></div>
                    <span style={{ marginTop: '10px', fontSize: '0.8rem', color: '#aaa' }}>
                      {month.split('-')[1]}/{month.split('-')[0].substring(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row para dividir o espaço abaixo do gráfico */}
          {streamerMode && (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
            
            {/* Top Resgatador */}
            <div 
              className="movie-card" 
              style={{ flex: '1 1 200px', padding: '25px', textAlign: 'center', cursor: 'pointer', border: '2px dashed transparent', transition: '0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }} 
              onClick={() => setShowModal(true)}
              title="Clique para ver o ranking completo"
            >
              <h3 style={{ margin: '0 0 15px 0' }}>Top Resgatador</h3>
              <p style={{ 
                fontSize: topRescuer.length > 12 ? '1.5rem' : '2rem', 
                fontWeight: 'bold', 
                color: '#ec4899', 
                margin: '0 0 15px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                👑 {topRescuer}
              </p>
              {maxRescues > 0 && <span style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'underline' }}>Ver ranking completo</span>}
            </div>

            {/* Próximos da Fila */}
            <div 
              className="movie-card" 
              style={{ flex: '1 1 200px', padding: '25px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', cursor: 'pointer', border: '2px dashed transparent', transition: '0.2s' }}
              onClick={() => setShowUpcomingModal(true)}
              title="Clique para ver toda a fila"
            >
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center' }}>Fila de Filmes 🍿</h3>
              {upcomingMovies.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
                  {upcomingMovies.map(m => (
                    <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--input-border)', paddingBottom: '5px', fontSize: '0.95rem' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', fontWeight: 'bold' }} title={m.title}>{m.title}</span>
                      <span style={{ color: '#aaa' }}>{new Date(m.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }).substring(0,5)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#aaa', margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>Nenhum filme agendado.</p>
                </div>
              )}
              {allUpcomingMovies.length > 3 && <span style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'underline', textAlign: 'center', marginTop: '10px' }}>Ver todos ({allUpcomingMovies.length})</span>}
            </div>

            </div>
          )}
        </div>
      </div>

      {/* Modal de Ranking de Resgatadores */}
      {showModal && (
        <div onClick={() => setShowModal(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowModal(false)} className="close-btn">&times;</button>
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>🏆 Ranking de Resgates</h2>
            {ranking.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {ranking.map((user, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid var(--input-border)', fontWeight: user.count === maxRescues ? 'bold' : 'normal', color: user.count === maxRescues ? '#ec4899' : 'inherit' }}>
                    <span>{index + 1}º {user.name}</span>
                    <span>{user.count} filme(s)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: 'center' }}>Nenhum resgate registrado ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Fila Completa */}
      {showUpcomingModal && (
        <div onClick={() => setShowUpcomingModal(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowUpcomingModal(false)} className="close-btn">&times;</button>
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>🍿 Fila Completa de Filmes</h2>
            {allUpcomingMovies.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {allUpcomingMovies.map((m, index) => (
                  <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid var(--input-border)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflow: 'hidden', marginRight: '10px' }}>
                      <span style={{ color: '#aaa', fontWeight: 'bold', width: '25px', flexShrink: 0 }}>{index + 1}º</span>
                      <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.title}>{m.title}</span>
                    </div>
                    <span style={{ color: '#10b981', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(m.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: 'center' }}>Nenhum filme agendado no momento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}