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

  if (isLoading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Carregando lista... 🍿</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--danger)' }}>{error}</div>;
  }

  const lowerCaseQuery = searchQuery.toLowerCase();

  const upcomingMovies = movies
    .filter(m => !m.watched && m.watchDate)
    .filter(m => m.title.toLowerCase().includes(lowerCaseQuery) || (m.requestedBy && m.requestedBy.toLowerCase().includes(lowerCaseQuery)))
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());

  const watchedMovies = movies
    .filter(m => m.watched)
    .filter(m => m.title.toLowerCase().includes(lowerCaseQuery) || (m.requestedBy && m.requestedBy.toLowerCase().includes(lowerCaseQuery)))
    .sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime());

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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '40px' }}>
        Lista de Filmes - {username} 🎬
      </h1>

      <input
        type="text"
        placeholder="🔍 Buscar filme ou nick de quem resgatou..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '15px', marginBottom: '30px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '1rem' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginBottom: '40px', alignItems: 'flex-start' }}>
        
        {/* Coluna 1: Hall da Fama */}
        {filteredRescuers.length > 0 && (
          <div style={{ flex: '1 1 300px' }}>
            <h2 style={{ color: '#8b5cf6', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🏆 Média de Notas
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', marginTop: '15px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px', alignContent: 'start' }}>
              {filteredRescuers.map(rescuer => (
                <div 
                  key={rescuer.name} 
                  onClick={() => setSelectedRescuer(rescuer.name)}
                  style={{ backgroundColor: 'var(--card-bg)', padding: '15px', borderRadius: '8px', border: '1px solid var(--input-border)', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                  title={`Ver filmes resgatados por ${rescuer.name}`}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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

        {/* Coluna 2: Agenda */}
        <div style={{ flex: '1 1 400px' }}>
          <h2 style={{ color: '#f59e0b', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            Próximos Filmes (Agenda) 📅
          </h2>
          {upcomingMovies.length === 0 ? <p>Nenhum filme na fila.</p> : (
            <ul style={{ listStyle: 'none', padding: '0 5px 0 0', margin: 0, maxHeight: '500px', overflowY: 'auto' }}>
              {upcomingMovies.map(movie => (
                <li 
                  key={movie.id} 
                  style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: 'var(--card-bg)', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--input-border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {movie.poster ? (
                    <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '50px', height: '75px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center' }}>Sem capa</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1.1rem', display: 'block', color: 'var(--text-color)' }}>{movie.title}</strong>
                    {movie.requestedBy && (
                      <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>
                        Resgatado por: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{movie.requestedBy}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#10b981', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                    {new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 style={{ color: '#10b981', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Já Assistidos ✅
        </h2>
        {watchedMovies.length === 0 ? <p>Nenhum filme assistido ainda.</p> : (
          <ul style={{ listStyle: 'none', padding: '0 5px 0 0', margin: 0, maxHeight: '600px', overflowY: 'auto' }}>
            {watchedMovies.map(movie => (
              <li 
                key={movie.id} 
                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', backgroundColor: 'var(--card-bg)', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--input-border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {movie.poster ? (
                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: 0.7 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: 0.7 }}>Sem capa</div>
                )}
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '1rem', display: 'block', color: '#aaa', textDecoration: 'line-through' }}>{movie.title}</strong>
                  {movie.requestedBy && (
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                      Resgatado por: <span>{movie.requestedBy}</span>
                    </div>
                  )}
                </div>
                <div style={{ color: '#f59e0b', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '5px 10px', borderRadius: '6px' }}>
                  {movie.streamerRating != null ? `Nota Streamer: ⭐ ${movie.streamerRating.toFixed(1)}` : 'Sem nota'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
                {movie.poster ? (
                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: movie.watched ? 0.7 : 1 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: movie.watched ? 0.7 : 1 }}>Sem capa</div>
                )}
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '1rem', display: 'block', color: movie.watched ? '#aaa' : 'var(--text-color)', textDecoration: movie.watched ? 'line-through' : 'none' }}>{movie.title}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                    {movie.watched ? 'Assistido' : (movie.watchDate ? `Na fila para ${new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Sem data')}
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
    </div>
  );
}