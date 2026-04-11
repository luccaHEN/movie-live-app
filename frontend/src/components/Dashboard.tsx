import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface DashboardProps {
  token: string;
}

export default function Dashboard({ token }: DashboardProps) {
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
  const watchedMovies = movies.filter(m => m.watched).length;
  const unwatchedMovies = totalMovies - watchedMovies;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '20px' }}>
      <h2 style={{ color: 'var(--primary)', marginBottom: '10px' }}>Estatísticas da Stream 📊</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', width: '100%', maxWidth: '900px' }}>
        <div className="movie-card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Total de Filmes</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', margin: '10px 0' }}>{totalMovies}</p>
        </div>
        <div className="movie-card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Filmes Assistidos</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', margin: '10px 0' }}>{watchedMovies}</p>
        </div>
        <div className="movie-card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Para Assistir</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b', margin: '10px 0' }}>{unwatchedMovies}</p>
        </div>
        <div className="movie-card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Média do Streamer</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6', margin: '10px 0' }}>⭐ {avgStreamerRating}</p>
        </div>
        <div className="movie-card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Média do Chat</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#8b5cf6', margin: '10px 0' }}>⭐ {avgChatRating}</p>
        </div>
        <div 
          className="movie-card" 
          style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', border: '2px dashed transparent', transition: '0.2s', overflow: 'hidden' }} 
          onClick={() => setShowModal(true)}
          title="Clique para ver o ranking completo"
        >
          <h3>Top Resgatador</h3>
          <p style={{ 
            fontSize: topRescuer.length > 12 ? '1.2rem' : '1.8rem', 
            fontWeight: 'bold', 
            color: '#ec4899', 
            margin: '15px 0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            👑 {topRescuer}
          </p>
          {maxRescues > 0 && <span style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'underline' }}>Ver ranking completo</span>}
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
    </div>
  );
}