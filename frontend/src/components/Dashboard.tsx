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
  user?: any; // Recebe o usuário atual para verificação de permissões
}

export default function Dashboard({ token, username, streamerMode, user }: DashboardProps) {
  const [statsData, setStatsData] = useState<any>(null);
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
      const response = await api.get('/movies/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatsData(response.data);
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
  }, [statsData]);

  useEffect(() => {
    const handleUpdate = () => fetchMovies(true);
    window.addEventListener('moviesUpdated', handleUpdate);
    return () => window.removeEventListener('moviesUpdated', handleUpdate);
  }, [fetchMovies]);

  if (isLoading || !statsData) {
    return <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem' }}>Calculando estatísticas... 📊</p>;
  }

  // Extração rápida de todos os cálculos que agora o Backend fornece!
  const { totalMovies, watchedMovies, unwatchedMovies, totalWatchHours, totalWatchDays, avgStreamerRating, avgChatRating, rankingForTop, topRescuer, sumasData, chatData, filteredRanking, champions, allUpcomingMovies, upcomingMovies, moviesPerMonth, topRescuerByMonth, rawMoviesForGenre } = statsData;
  
  const chartData = Object.entries(moviesPerMonth as Record<string, number>).sort(([a], [b]) => a.localeCompare(b)).slice(expandedChart ? -12 : -6) as [string, number][];
  const maxMoviesInMonth = chartData.length > 0 ? Math.max(...chartData.map(d => d[1])) : 1;

  const handleOpenGenreModal = async () => {
    setShowGenreModal(true);
    
    if (genreRanking.length > 0 || isLoadingGenres) return;

    setIsLoadingGenres(true);
    try {
      const genreTime: Record<string, number> = {};
      
      const chunkSize = 5;
      const watchedList = rawMoviesForGenre.filter((m: any) => m.watched);
      for (let i = 0; i < watchedList.length; i += chunkSize) {
        const chunk = watchedList.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (m: any) => {
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
                  <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
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
                    {topRescuerByMonth[month] && (
                      <span 
                        style={{ marginTop: '4px', fontSize: '0.7rem', color: '#ec4899', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}
                        title={`${topRescuerByMonth[month].tooltip} com ${topRescuerByMonth[month].count} resgates`}
                      >
                        🏅 {topRescuerByMonth[month].name}
                      </span>
                    )}
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
              {sumasData && (
                <div style={{ fontSize: '1.1rem', marginBottom: '5px', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/seal.png" alt="Sumas" style={{ width: '24px', height: '24px', marginRight: '8px', objectFit: 'contain' }} />
                  Sumas: <span style={{ color: '#10b981', marginLeft: '5px' }}>{sumasData.count}</span>
                </div>
              )}
              {chatData && (
                <div style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  💬 Chat: <span style={{ color: '#10b981', marginLeft: '5px' }}>{chatData.count}</span>
                </div>
              )}
              {filteredRanking.length > 0 && <span style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'underline' }}>Ver ranking completo</span>}
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
                  {upcomingMovies.map((m: any) => (
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
              <Podium ranking={rankingForTop} />
            ) : (
              <p style={{ textAlign: 'center', margin: '20px 0' }}>Nenhum resgate de viewers registrado ainda.</p>
            )}

            {/* Linha divisória */}
            {(sumasData || chatData || rankingForTop.length > 0) && (
              <div style={{ borderTop: '1px solid var(--input-border)', margin: '20px -20px' }}></div>
            )}

            {/* Exibe o Sumas e o Chat destacados abaixo do pódio */}
            {sumasData && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '10px', fontWeight: 'bold' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <img src="/seal.png" alt="Sumas" style={{ width: '24px', height: '24px', marginRight: '8px', objectFit: 'contain' }} />
                  Sumas
                </span>
                <span style={{ color: '#10b981' }}>{sumasData.count} filme(s)</span>
              </div>
            )}
            {chatData && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  💬 Chat
                </span>
                <span style={{ color: '#10b981' }}>{chatData.count} filme(s)</span>
              </div>
            )}

            {/* Restante do Ranking (Abaixo do Top 3) */}
            {rankingForTop.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredRanking
                  .filter((user: { name: string; count: number }) => {
                    const position = rankingForTop.findIndex((r: any) => r.name === user.name) + 1;
                    return position > 3; // Remove o Top 3 da lista de baixo
                  })
                  .map((user: { name: string; count: number }, index: number) => {
                    const position = rankingForTop.findIndex((r: any) => r.name === user.name) + 1;
                    return (
                      <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid var(--input-border)' }}>
                        <span>
                          {`${position}º `}
                          {user.name}
                        </span>
                        <span>{user.count} filme(s)</span>
                      </li>
                    );
                })}
              </ul>
        )}
      </Modal>

      {/* Modal de Fila Completa */}
      <Modal isOpen={showUpcomingModal} onClose={() => setShowUpcomingModal(false)}>
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>🍿 Fila Completa de Filmes</h2>
            {allUpcomingMovies.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {allUpcomingMovies.map((m: any, index: number) => (
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
            {genreRanking.map((item: any, index: number) => (
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
                const monthMovies = rawMoviesForGenre.filter((m: any) => m.watched && m.watchDate && String(m.watchDate).startsWith(championModalMonth!));
                let candidates = monthMovies.filter((m: any) => m.streamerRating === 10);
                if (candidates.length === 0) {
                  candidates = monthMovies.filter((m: any) => m.streamerRating === 9);
                }
                
                if (candidates.length === 0) {
                  return <p style={{ textAlign: 'center', color: '#aaa' }}>Nenhum filme avaliado com nota 9 ou 10 neste mês.</p>;
                }

            return candidates.sort((a: any, b: any) => (b.streamerRating || 0) - (a.streamerRating || 0)).map((m: any) => (
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
                      style={{ display: 'flex', gap: '15px', padding: '10px', backgroundColor: champions[championModalMonth!]?.id === m.id ? 'rgba(236, 72, 153, 0.2)' : 'var(--card-bg)', border: champions[championModalMonth!]?.id === m.id ? '1px solid #ec4899' : '1px solid var(--input-border)', borderRadius: '8px', cursor: 'pointer', alignItems: 'center', transition: '0.2s' }}
                    >
                      {m.poster ? (
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster}`} alt={m.title} style={{ width: '40px', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px' }}></div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontWeight: 'bold' }}>{m.title}</span>
                        <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Minha Nota: ⭐ {m.streamerRating != null ? m.streamerRating : 'N/A'}</span>
                      </div>
                      {champions[championModalMonth!]?.id === m.id && <span style={{ fontSize: '1.5rem' }}>👑</span>}
                    </div>
                ));
              })()}
        </div>
      </Modal>

      <RouletteModal isOpen={showRoulette} onClose={() => setShowRoulette(false)} token={token} streamerMode={streamerMode} fetchMovies={fetchMovies} savedMovies={rawMoviesForGenre} />
    </div>
  );
}