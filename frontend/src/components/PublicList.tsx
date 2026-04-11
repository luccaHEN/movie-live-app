import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function PublicList() {
  // Assumindo que a URL seja algo como /lista-publica/:username
  const { username } = useParams();
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
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

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#f59e0b', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Próximos Filmes (Fila)
        </h2>
        {upcomingMovies.length === 0 ? <p>Nenhum filme na fila.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {upcomingMovies.map(movie => (
              <li key={movie.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #222' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{movie.title}</strong>
                  {movie.requestedBy && (
                    <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>
                      Resgatado por: <span style={{ color: 'var(--primary)' }}>{movie.requestedBy}</span>
                    </div>
                  )}
                </div>
                <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                  {new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 style={{ color: '#10b981', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Já Assistidos ✅
        </h2>
        {watchedMovies.length === 0 ? <p>Nenhum filme assistido ainda.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {watchedMovies.map(movie => (
              <li key={movie.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222' }}>
                <span style={{ color: '#ccc' }}>{movie.title}</span>
                <span>
                  {movie.streamerRating ? `Nota: ⭐ ${movie.streamerRating.toFixed(1)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}