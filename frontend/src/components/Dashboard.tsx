import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

 // Instancia os áudios globalmente para carregar com a página e não ter atraso
 const tickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
 const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
 const flipSound = new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3');
 tickSound.volume = 0.5;
 winSound.volume = 0.6;
 flipSound.volume = 0.6;

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
  const [drawnMovie, setDrawnMovie] = useState<any | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteSearchQuery, setRouletteSearchQuery] = useState('');
  const [rouletteSearchResults, setRouletteSearchResults] = useState<any[]>([]);
  const [rouletteCandidates, setRouletteCandidates] = useState<any[]>([]);
  const [rouletteWatchDate, setRouletteWatchDate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [drawType, setDrawType] = useState<'FAST' | 'WHEEL' | 'CARDS'>('FAST');
  const [wheelRotation, setWheelRotation] = useState(0);
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
  const [isDrawScreen, setIsDrawScreen] = useState(false);
  const [caseTrack, setCaseTrack] = useState<any[]>([]);
  const [caseOffset, setCaseOffset] = useState(0);
  const [genreRanking, setGenreRanking] = useState<{genre: string, hours: string}[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(false);

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

  // Efeito de Debounce para buscar filmes automaticamente enquanto digita
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (rouletteSearchQuery.trim()) {
        setIsSearching(true);
        try {
          const response = await api.get(`/movies/search?query=${rouletteSearchQuery}&page=1`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRouletteSearchResults(response.data.filter((m: any) => m.poster_path));
        } catch (error) {
          toast.error("Erro ao buscar filmes.");
        } finally {
          setIsSearching(false);
        }
      } else {
        setRouletteSearchResults([]);
      }
    }, 500); // Aguarda 500ms após o usuário parar de digitar

    return () => clearTimeout(delayDebounceFn);
  }, [rouletteSearchQuery, token]);

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

  // Sistema de Efeitos Sonoros (SFX)
  const playSound = (type: 'TICK' | 'WIN' | 'FLIP') => {
    try {
      let audio: HTMLAudioElement | null = null;
      if (type === 'TICK') audio = tickSound;
      else if (type === 'WIN') audio = winSound;
      else if (type === 'FLIP') audio = flipSound;

      if (audio) {
        audio.currentTime = 0; // Volta para o começo instantaneamente (permite cliques rápidos)
        const playPromise = audio.play();
        if (playPromise !== undefined) {
           playPromise.catch(() => {}); // Previne erros se o navegador bloquear autoplay
        }
      }
    } catch (e) { console.error("Erro ao tocar som", e); }
  };

  // Abre a roleta no modo de seleção
  const handleOpenRoulette = () => {
    setRouletteCandidates([]);
    setRouletteSearchResults([]);
    setRouletteSearchQuery('');
    setRouletteWatchDate('');
    setDrawnMovie(null);
    setWheelRotation(0);
    setFlippedCardIndex(null);
    setIsSpinning(false);
    setIsDrawScreen(false);
    setCaseTrack([]);
    setShowRoulette(true);
  };

  // Lógica do Sorteio (Roleta)
  const handleSpinRoulette = () => {
    if (rouletteCandidates.length === 0) {
      toast.error("Adicione pelo menos um filme para sortear!");
      return;
    }

    setIsSpinning(true);
    playSound('TICK'); // Toca o som instantaneamente para o navegador liberar o Áudio na live!

    const winner = rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)];

    // Função que cria o som da catraca desacelerando suavemente!
    const startSlowingTicks = (maxTime: number) => {
      let delay = 50;
      let total = 0;
      const nextTick = () => {
        if (total >= maxTime) return;
        playSound('TICK');
        total += delay;
        delay = delay * 1.15; // Aumenta o tempo do próximo tick em 15% (desacelerando)
        setTimeout(nextTick, delay);
      };
      setTimeout(nextTick, delay);
    };

    if (drawType === 'FAST') {
      const track = [];
      for(let i=0; i<60; i++) track.push(rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)]);
      track[45] = winner; // Vencedor fica na posição 45
      setCaseTrack(track);
      setCaseOffset(0); // Reseta a posição antes de girar

      setTimeout(() => {
         const itemWidth = 130; // 120px do card + 10px de margin/gap
         const randomJitter = Math.floor(Math.random() * 110) - 55; // Emoção: Varia a parada raspando na borda esquerda ou direita!
         setCaseOffset(-(45 * itemWidth) + randomJitter);
      }, 50);

      startSlowingTicks(6000);

      setTimeout(() => {
        setDrawnMovie(winner);
        setIsSpinning(false);
        playSound('WIN');
        confetti({ 
          zIndex: 9999, 
          particleCount: 150, 
          spread: 90, 
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']
        });
      }, 6000); // 6 segundos de animação
    } else if (drawType === 'WHEEL') {
      const winnerIndex = rouletteCandidates.indexOf(winner);
      const sliceAngle = 360 / rouletteCandidates.length;
      const randomJitter = (Math.random() * sliceAngle * 0.8) - (sliceAngle * 0.4); // Emoção: não para exatamente no centro da fatia
      const targetAngle = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2) + randomJitter;
      // Adiciona 5 voltas completas (1800 graus) para dar o efeito de girar bastante
      setWheelRotation(prev => prev + 1800 + targetAngle - (prev % 360));
      
      startSlowingTicks(4000);

      setTimeout(() => {
        setDrawnMovie(winner);
        setIsSpinning(false);
        playSound('WIN');
        confetti({ 
          zIndex: 9999, 
          particleCount: 150, 
          spread: 90, 
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']
        });
      }, 4000); // 4s é a duração da animação CSS
    }
  };

  // Clique manual na carta
  const handleCardClick = (index: number) => {
    if (isSpinning || drawnMovie) return;
    const winner = rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)];
    setDrawnMovie(winner);
    setFlippedCardIndex(index);
    setIsSpinning(true);
    playSound('FLIP');
    setTimeout(() => {
      setIsSpinning(false);
      playSound('WIN');
      confetti({ 
        zIndex: 9999, 
        particleCount: 150, 
        spread: 90, 
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']
      });
    }, 1500); // 1.5s pra carta virar
  };

  // Limpa o ganhador pra jogar de novo
  const handleResetDraw = () => {
    setDrawnMovie(null);
    setCaseTrack([]);
    setCaseOffset(0);
    setFlippedCardIndex(null);
  };

  // Salvar o filme vencedor
  const handleSaveDrawnMovie = async () => {
    if (!drawnMovie) return;
    if (streamerMode && !rouletteWatchDate) {
      toast.error('Por favor, selecione uma data para assistir o filme.');
      return;
    }

    const payload: any = {
      title: drawnMovie.title,
      tmdbId: drawnMovie.id,
      poster: drawnMovie.poster_path,
      genre: "N/A",
    };
    if (streamerMode) {
      payload.requestedBy = 'Chat';
      payload.watchDate = new Date(rouletteWatchDate).toISOString();
    }
    try {
      await api.post('/movies', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Filme "${drawnMovie.title}" salvo com sucesso!`);
      setShowRoulette(false);
      setIsDrawScreen(false);
      fetchMovies(true); // Recarrega as estatísticas de forma silenciosa
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar o filme.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
        <h2 style={{ color: 'var(--primary)', margin: '0' }}>Estatísticas da Stream 📊</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleOpenRoulette} className="btn-secondary" style={{ padding: '8px 15px', fontSize: '0.9rem', width: 'auto', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' }}>🎲 Sortear Filme</button>
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
            <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#ccc' }}>Média Streamer</h3>
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

      {/* Modal de Tempo por Gênero */}
      {showGenreModal && (
        <div onClick={() => setShowGenreModal(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowGenreModal(false)} className="close-btn">&times;</button>
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
          </div>
        </div>
      )}

      {/* Modal da Roleta de Filmes */}
      {showRoulette && (
        <div className="modal-overlay">
          <style>
            {`
              .case-opening-container { width: 100%; height: 200px; overflow: hidden; position: relative; background: #1a1a1a; border-radius: 8px; border: 2px solid var(--primary); box-shadow: inset 0 0 20px rgba(0,0,0,0.8); }
              .case-opening-track { display: flex; height: 100%; align-items: center; gap: 10px; padding-left: calc(50% - 60px); }
              .case-opening-item { width: 120px; height: 170px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #333; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #444; box-sizing: border-box; }
              .case-opening-item img { width: 100%; height: 100%; object-fit: cover; }
              .case-opening-marker { position: absolute; top: 0; bottom: 0; left: 50%; width: 4px; background: #ec4899; transform: translateX(-50%); z-index: 10; box-shadow: 0 0 15px #ec4899; }
              .card-container { perspective: 1000px; cursor: pointer; width: 120px; height: 180px; }
              .card-inner { width: 100%; height: 100%; transition: transform 0.6s; transform-style: preserve-3d; position: relative; }
              .card-inner.flipped { transform: rotateY(180deg); }
              .card-front, .card-back { width: 100%; height: 100%; position: absolute; backface-visibility: hidden; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .card-front { background: repeating-linear-gradient(45deg, #3b82f6, #3b82f6 10px, #1e3a8a 10px, #1e3a8a 20px); border: 2px solid #fff; font-size: 3rem; color: #fff; }
              .card-back { background-color: #222; transform: rotateY(180deg); overflow: hidden; border: 2px solid var(--primary); }
              .wheel-pointer { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-top: 25px solid #fff; z-index: 10; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); }
            `}
          </style>
          <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth: isDrawScreen && drawType === 'FAST' ? '800px' : '500px', maxHeight: '90vh', textAlign: 'center', overflowX: 'hidden', overflowY: 'auto', transition: 'max-width 0.3s', position: 'relative' }}>
            {!isSpinning && <button onClick={() => setShowRoulette(false)} className="close-btn">&times;</button>}
            
            {!isSpinning && isDrawScreen && (
              <button 
                onClick={() => { setIsDrawScreen(false); handleResetDraw(); }} 
                style={{ position: 'absolute', top: '18px', left: '15px', background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: 0 }}
                title="Voltar para seleção"
              >
                ⬅️ Voltar
              </button>
            )}

            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>🎲 Roleta de Filmes</h2>
            
            {!isDrawScreen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Buscar filme no TMDB..."
                      value={rouletteSearchQuery}
                      onChange={e => setRouletteSearchQuery(e.target.value)}
                      style={{ flex: 1, paddingRight: '35px' }}
                    />
                    {rouletteSearchQuery && (
                      <button 
                        onClick={() => { setRouletteSearchQuery(''); setRouletteSearchResults([]); }}
                        style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.5rem', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Limpar busca"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {isSearching && <span style={{ fontSize: '0.85rem', color: '#aaa', width: '50px' }}>Buscando...</span>}
                </div>

                {rouletteSearchResults.filter(m => !rouletteCandidates.some(c => c.id === m.id)).length > 0 && (
                  <div style={{ maxHeight: '150px', overflowY: 'auto', textAlign: 'left', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '5px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    {rouletteSearchResults.filter(m => !rouletteCandidates.some(c => c.id === m.id)).map(m => {
                      const existingMovie = movies.find(saved => saved.tmdbId === m.id);
                      return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 5px', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt={m.title} style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{m.title}</span>
                            {existingMovie && (
                              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>
                                {existingMovie.watched ? '✅ Já assistido' : '📌 Na lista'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => {
                          setRouletteCandidates(prev => {
                            if (prev.find(c => c.id === m.id)) return prev; // Evita duplicatas
                            return [...prev, m];
                          });
                        }}>Adicionar</button>
                      </div>
                    )})}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <p style={{ margin: 0, color: '#ccc', textAlign: 'left' }}>Candidatos ({rouletteCandidates.length}):</p>
                  {rouletteCandidates.length > 0 && (
                    <button className="btn-danger" style={{ padding: '4px 8px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => setRouletteCandidates([])}>Limpar Lista</button>
                  )}
                </div>
                <div style={{ maxHeight: '150px', overflowY: 'auto', textAlign: 'left', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '5px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  {rouletteCandidates.length === 0 ? (
                    <p style={{ margin: '10px', fontSize: '0.85rem', color: '#888' }}>Nenhum filme adicionado para o sorteio.</p>
                  ) : rouletteCandidates.map((m, idx) => {
                    const existingMovie = movies.find(saved => saved.tmdbId === m.id);
                    return (
                    <div key={`${m.id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 5px', borderBottom: '1px solid #333' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt={m.title} style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{m.title}</span>
                          {existingMovie && (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>
                              {existingMovie.watched ? '✅ Já assistido' : '📌 Na lista'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => setRouletteCandidates(prev => prev.filter((_, i) => i !== idx))}>Remover</button>
                    </div>
                  )})}
                </div>

                <div style={{ marginTop: '10px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#ccc', textAlign: 'left' }}>Tipo de Animação:</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setDrawType('FAST')} className={`btn-${drawType === 'FAST' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>⚡ Rápida</button>
                    <button onClick={() => setDrawType('WHEEL')} className={`btn-${drawType === 'WHEEL' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>🎡 Roleta</button>
                    <button onClick={() => setDrawType('CARDS')} className={`btn-${drawType === 'CARDS' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>🃏 Cartas</button>
                  </div>
                </div>

                <button onClick={() => {
                  setIsDrawScreen(true);
                  // "Destrava" o áudio (necessário no Safari e Chrome) forçando um play silencioso no clique do usuário
                  [tickSound, winSound, flipSound].forEach(a => {
                    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
                  });
                }} className="btn-primary" disabled={rouletteCandidates.length === 0} style={{ marginTop: '10px', padding: '12px', fontSize: '1.1rem' }}>
                  Ir para o Sorteio ➡️
                </button>
              </div>
            ) : (
              <>
                {drawType === 'WHEEL' && (
                  <div style={{ position: 'relative', width: '300px', height: '300px', margin: '20px auto' }}>
                    <div className="wheel-pointer"></div>
                    <div style={{ 
                      width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #fff', position: 'relative', overflow: 'hidden',
                      background: `conic-gradient(${rouletteCandidates.map((_, i) => `${['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'][i % 12]} ${(i * 360) / rouletteCandidates.length}deg ${((i + 1) * 360) / rouletteCandidates.length}deg`).join(', ')})`,
                      transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'none', 
                      transform: `rotate(${wheelRotation}deg)`
                    }}>
                      {rouletteCandidates.map((m, i) => {
                        const sliceAngle = 360 / rouletteCandidates.length;
                        const rotation = (i * sliceAngle) + (sliceAngle / 2);
                        return (
                          <div key={i} style={{ position: 'absolute', top: '10px', left: 'calc(50% - 15px)', width: '30px', height: '140px', transformOrigin: '50% 140px', transform: `rotate(${rotation}deg)`, color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', textShadow: '1px 1px 2px #000', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden' }}>
                            <span style={{ writingMode: 'vertical-rl', whiteSpace: 'nowrap' }}>
                              {m.title.length > 16 ? m.title.substring(0, 14) + '..' : m.title}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {drawType === 'FAST' && (
                  <div className="case-opening-container" style={{ margin: '20px 0' }}>
                     <div className="case-opening-marker"></div>
                     <div className="case-opening-track" style={{ transform: `translateX(${caseOffset}px)`, transition: isSpinning ? 'transform 6s cubic-bezier(0.05, 0.9, 0.1, 1)' : 'none' }}>
                         {caseTrack.length > 0 ? caseTrack.map((m, i) => (
                             <div key={i} className="case-opening-item">
                                {m.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} /> : <div style={{padding: '10px', color: '#fff'}}>{m.title}</div>}
                             </div>
                         )) : rouletteCandidates.map((m, i) => (
                             <div key={i} className="case-opening-item" style={{ opacity: 0.5 }}>
                                {m.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} /> : <span style={{padding: '10px'}}>{m.title}</span>}
                             </div>
                         ))}
                     </div>
                  </div>
                )}

                {drawType === 'CARDS' && (!drawnMovie || isSpinning) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Escolha uma carta!</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', maxWidth: '500px' }}>
                      {rouletteCandidates.map((_, i) => (
                        <div key={i} className="card-container" onClick={() => handleCardClick(i)}>
                          <div className={`card-inner ${flippedCardIndex === i ? 'flipped' : ''}`}>
                            <div className="card-front">❓</div>
                            <div className="card-back">
                              {flippedCardIndex === i && drawnMovie && (
                                 drawnMovie.poster_path ? 
                                   <img src={`https://image.tmdb.org/t/p/w200${drawnMovie.poster_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ganhador" />
                                 : <span style={{ color: '#fff', padding: '10px', textAlign: 'center' }}>{drawnMovie.title}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!isSpinning && !drawnMovie && drawType !== 'CARDS') && (
                  <button className="btn-primary" onClick={handleSpinRoulette} style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1.2rem' }}>
                      🎰 Girar!
                  </button>
                )}

                {!isSpinning && drawnMovie && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981' }}>🎉 Vencedor: {drawnMovie.title}</h3>
                    {drawnMovie.poster_path && (
                        <img src={`https://image.tmdb.org/t/p/w200${drawnMovie.poster_path}`} alt={drawnMovie.title} style={{ width: '120px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }} />
                    )}
                    
                    {streamerMode && (
                      <div style={{ width: '100%', textAlign: 'left', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <p style={{ margin: 0, color: '#ec4899', fontWeight: 'bold' }}>👑 Resgatado por: Chat</p>
                        <label className="input-label" style={{ margin: 0 }}>
                          Agendar para:
                          <input type="date" value={rouletteWatchDate} onChange={(e) => setRouletteWatchDate(e.target.value)} style={{ marginTop: '5px' }} />
                        </label>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '10px' }}>
                      <button onClick={handleSaveDrawnMovie} className="btn-success" style={{ width: '100%' }}>
                        Salvar nos Meus Filmes
                      </button>
                      <button onClick={handleResetDraw} className="btn-primary" style={{ width: '100%' }}>
                        Girar Novamente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}