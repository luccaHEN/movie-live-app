import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Podium from './Podium';
import RouletteModal from './RouletteModal';

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
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [genreRanking, setGenreRanking] = useState<{genre: string, hours: string}[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(false);
  const [championModalMonth, setChampionModalMonth] = useState<string | null>(null);
  const [expandedChart, setExpandedChart] = useState(false);

  const fetchMovies = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data);
    } catch (error) {
      toast.error("Erro ao carregar estatísticas.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  useEffect(() => {
    setGenreRanking([]);
  }, [movies]);

  useEffect(() => {
    const handleUpdate = () => fetchMovies(true);
    window.addEventListener('moviesUpdated', handleUpdate);
    return () => window.removeEventListener('moviesUpdated', handleUpdate);
  }, [fetchMovies]);

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
    .sort((a, b) => {
      if (a.name.toLowerCase() === 'chat') return 1; // Joga o Chat para o final
      if (b.name.toLowerCase() === 'chat') return -1; // Mantém o Chat no final
      return b.count - a.count; // Ordena os demais normalmente do maior pro menor
    });

  const rankingForTop = ranking.filter(r => r.name.toLowerCase() !== 'chat');
  let topRescuer = 'N/A';
  let maxRescues = 0;
  if (rankingForTop.length > 0) {
    maxRescues = rankingForTop[0].count;
    const tiedUsers = rankingForTop.filter(r => r.count === maxRescues);
    topRescuer = tiedUsers.length === 1 ? tiedUsers[0].name : 'Empate!';
  }

  // Campeões salvos no banco de dados
  const champions = movies.reduce((acc, m) => {
    if (m.isChampion && m.watchDate) {
      acc[String(m.watchDate).substring(0, 7)] = m;
    }
    return acc;
  }, {} as Record<string, any>);

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
  
  const chartData = Object.entries(moviesPerMonth).sort(([a], [b]) => a.localeCompare(b)).slice(expandedChart ? -12 : -6) as [string, number][]; // Pega 6 ou 12 meses
  const maxMoviesInMonth = chartData.length > 0 ? Math.max(...chartData.map(d => d[1])) : 1;

  const handleOpenGenreModal = async () => {
    setShowGenreModal(true);
    
    if (genreRanking.length > 0 || isLoadingGenres) return;

    setIsLoadingGenres(true);
    try {
      const genreTime: Record<string, number> = {};
      
      const chunkSize = 5;
      for (let i = 0; i < watchedMoviesList.length; i += chunkSize) {
        const chunk = watchedMoviesList.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (m) => {
          let runtime = m.runtime || 105;
          let genres = ['Desconhecido'];

          // Se o backend tiver retornado o gênero salvo
          if (m.genre && m.genre !== 'N/A' && m.genre !== 'Desconhecido') {
            genres = m.genre.split(', ');
          } else if (m.tmdbId) {
            // Filmes antigos não têm gênero salvo, busca no TMDB
            try {
              const res = await api.get(`/movies/tmdb/${m.tmdbId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.data.runtime) runtime = res.data.runtime;
              if (res.data.genres && res.data.genres.length > 0) {
                genres = res.data.genres.map((g: any) => g.name);
              }
            } catch (e) {
              console.error(`Erro ao buscar detalhes do filme ${m.tmdbId}`);
            }
          }

          // Divide o tempo do filme pelo número de gêneros para a conta fechar exatamente com o Tempo de Tela
          const timePerGenre = runtime / genres.length;
          genres.forEach((g: string) => {
            genreTime[g] = (genreTime[g] || 0) + timePerGenre;
          });
        }));
      }

      const ranking = Object.entries(genreTime)
        .map(([genre, minutes]) => ({ genre, hours: (minutes / 60).toFixed(1) }))
        .sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours));

      setGenreRanking(ranking);
    } catch (error) {
      toast.error('Erro ao calcular horas por gênero.');
    } finally {
      setIsLoadingGenres(false);
    }
  };

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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowRoulette(true)} className="btn-secondary" style={{ padding: '8px 15px', fontSize: '0.9rem', width: 'auto', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' }}>🎲 Sortear Filme</button>
          {streamerMode && (
            <button onClick={handleCopyPublicLink} className="btn-primary" style={{ padding: '8px 15px', fontSize: '0.9rem', width: 'auto' }}>🔗 Copiar Link Agenda</button>
          )}
        </div>
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
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>{streamerMode ? 'Média Streamer' : 'Minha Média'}</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6', margin: '0' }}>⭐ {avgStreamerRating}</p>
          </div>
          {streamerMode && (
            <div className="movie-card" style={{ padding: '15px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Média Chat</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6', margin: '0' }}>⭐ {avgChatRating}</p>
            </div>
          )}
          <div 
            className="movie-card" 
            style={{ padding: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', border: '2px dashed transparent', transition: '0.2s' }}
            onClick={handleOpenGenreModal}
            title="Clique para ver horas por gênero"
          >
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Tempo de Tela</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: '0' }}>{totalWatchHours}h</p>
            <span style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '3px' }}>≈ {totalWatchDays} dias</span>
          </div>
        </div>

        {/* Coluna Direita: Gráfico e Top Resgatador */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: '2 1 500px', minWidth: '300px' }}>
          
          {/* Gráfico de Barras: Filmes Assistidos por Mês */}
          {chartData.length > 0 && (
            <div 
              className="movie-card" 
              style={{ width: '100%', padding: '25px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', cursor: 'pointer', transition: '0.3s' }}
              onClick={() => setExpandedChart(!expandedChart)}
              title={expandedChart ? "Clique para recolher o gráfico" : "Clique para ver o ano todo"}
            >
              <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', color: 'var(--primary)' }}>📈 Filmes Assistidos ({expandedChart ? 'Últimos 12 Meses' : 'Últimos 6 Meses'})</h3>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: '150px', gap: '10px' }}>
                {chartData.map(([month, count]) => (
                  <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <span 
                      style={{ cursor: 'pointer', fontSize: '1.2rem', marginBottom: '5px', opacity: champions[month] ? 1 : 0.3, transition: '0.2s' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChampionModalMonth(month);
                      }}
                      title={champions[month] ? `Campeão: ${champions[month].title}` : "Escolher Melhor do Mês"}
                    >
                      👑
                    </span>
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
                {topRescuer}
              </p>
              {ranking.length > 0 && <span style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'underline' }}>Ver ranking completo</span>}
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <h2 style={{ marginBottom: '25px', color: 'var(--primary)', textAlign: 'center' }}>🏆 Ranking de Resgates</h2>
            {rankingForTop.length > 0 ? (
              <>
                <Podium ranking={rankingForTop} />
                <div style={{ borderTop: '1px solid var(--input-border)', margin: '0 -20px' }}></div>
                
                <ul style={{ listStyle: 'none', padding: '10px 0 0 0', margin: 0 }}>
                  {ranking
                    .filter(user => {
                      const isChat = user.name.toLowerCase() === 'chat';
                      const position = rankingForTop.findIndex(r => r.name === user.name) + 1;
                      return isChat || position > 3; // Remove o Top 3 da lista de baixo
                    })
                    .map((user, index) => {
                      const isChat = user.name.toLowerCase() === 'chat';
                      const position = rankingForTop.findIndex(r => r.name === user.name) + 1;
                      return (
                        <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid var(--input-border)' }}>
                          <span>
                            {isChat ? '💬 ' : `${position}º `}
                            {user.name}
                          </span>
                          <span>{user.count} filme(s)</span>
                        </li>
                      );
                  })}
                </ul>
              </>
            ) : (
              <p style={{ textAlign: 'center', marginTop: '20px' }}>Nenhum resgate registrado ainda.</p>
        )}
      </Modal>

      {/* Modal de Fila Completa */}
      <Modal isOpen={showUpcomingModal} onClose={() => setShowUpcomingModal(false)}>
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
      </Modal>

      {/* Modal de Tempo por Gênero */}
      <Modal isOpen={showGenreModal} onClose={() => setShowGenreModal(false)} maxWidth="400px">
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>⏱️ Tempo por Gênero</h2>
            {isLoadingGenres ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <p style={{ fontSize: '1.1rem', margin: '0 0 10px 0' }}>Analisando seus filmes... 🍿</p>
                <span style={{ fontSize: '0.85rem', color: '#aaa' }}>(Isso pode levar alguns segundos para buscar informações de filmes antigos)</span>
              </div>
            ) : genreRanking.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {genreRanking.map((item, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid var(--input-border)' }}>
                    <span style={{ fontWeight: index === 0 ? 'bold' : 'normal', color: index === 0 ? '#10b981' : 'inherit' }}>
                      {index + 1}º {item.genre}
                    </span>
                    <span>{item.hours}h</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: 'center' }}>Nenhum dado disponível.</p>
        )}
      </Modal>

      {/* Modal de Escolha do Campeão do Mês */}
      <Modal isOpen={!!championModalMonth} onClose={() => setChampionModalMonth(null)}>
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>
          👑 Melhor do Mês ({championModalMonth?.split('-')[1]}/{championModalMonth?.split('-')[0]})
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                const monthMovies = movies.filter(m => m.watched && m.watchDate && m.watchDate.startsWith(championModalMonth!));
                let candidates = monthMovies.filter(m => m.streamerRating === 10);
                if (candidates.length === 0) {
                  candidates = monthMovies.filter(m => m.streamerRating === 9);
                }
                
                if (candidates.length === 0) {
                  return <p style={{ textAlign: 'center', color: '#aaa' }}>Nenhum filme avaliado com nota 9 ou 10 neste mês.</p>;
                }

                return candidates.sort((a, b) => (b.streamerRating || 0) - (a.streamerRating || 0)).map(m => (
                    <div 
                      key={m.id} 
                      onClick={async () => {
                        try {
                          if (champions[championModalMonth!]?.id === m.id) {
                            await api.put(`/movies/${m.id}`, { isChampion: false }, { headers: { Authorization: `Bearer ${token}` } });
                            toast.success("Campeão do mês removido!");
                          } else {
                            if (champions[championModalMonth!]) {
                              await api.put(`/movies/${champions[championModalMonth!].id}`, { isChampion: false }, { headers: { Authorization: `Bearer ${token}` } });
                            }
                            await api.put(`/movies/${m.id}`, { isChampion: true }, { headers: { Authorization: `Bearer ${token}` } });
                            toast.success(`"${m.title}" definido como campeão do mês!`);
                          }
                          setChampionModalMonth(null);
                          fetchMovies(true);
                          window.dispatchEvent(new Event('moviesUpdated'));
                        } catch (e) {
                          toast.error("Erro ao atualizar o campeão.");
                        }
                      }}
                      style={{ display: 'flex', gap: '15px', padding: '10px', backgroundColor: champions[championModalMonth!]?.id === m.id ? 'rgba(236, 72, 153, 0.2)' : 'var(--card-bg)', border: champions[championModalMonth!]?.id === m.id ? '1px solid #ec4899' : '1px solid var(--input-border)', borderRadius: '8px', cursor: 'pointer', alignItems: 'center' }}
                    >
                      {m.poster ? (
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster}`} alt={m.title} style={{ width: '40px', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px' }}></div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontWeight: 'bold' }}>{m.title}</span>
                        <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Minha Nota: ⭐ {m.streamerRating || 'N/A'}</span>
                      </div>
                      {champions[championModalMonth!]?.id === m.id && <span style={{ fontSize: '1.5rem' }}>👑</span>}
                    </div>
                ));
              })()}
        </div>
      </Modal>

      <RouletteModal isOpen={showRoulette} onClose={() => setShowRoulette(false)} token={token} streamerMode={streamerMode} fetchMovies={fetchMovies} savedMovies={movies} />
    </div>
  );
}