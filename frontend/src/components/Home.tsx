import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Star, Trophy } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MovieDetailsModal from './MovieDetailsModal';

const HomeMovieCardItem = React.memo(({ movie, onShowDetails, streamerMode }: any) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div 
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', padding: '4px' }}
      >
        {/* Pôster com Overlay Glassmorphism */}
        <div 
          style={{ position: 'relative', width: '100%', aspectRatio: '2/3', borderRadius: '16px', overflow: 'hidden', boxShadow: movie.watched ? '0 0 0 3px #10b981, 0 8px 20px rgba(0,0,0,0.4)' : '0 8px 20px rgba(0,0,0,0.4)', transition: 'transform 0.3s ease-out', transform: isHovered ? 'scale(1.03)' : 'scale(1)', cursor: 'pointer' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onShowDetails(movie.tmdbId)}
        >
          {movie.poster ? (
             <img src={`https://image.tmdb.org/t/p/w342${movie.poster}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
             <div style={{ width: '100%', height: '100%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Sem capa</div>
          )}
          
          {/* Container de Badges (Data e Assistido) */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', zIndex: 2, pointerEvents: 'none' }}>
            {/* Badge de Data sempre visível na Agenda */}
            {movie.watchDate && (
              <div style={{ background: 'rgba(0,0,0,0.8)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase()}
              </div>
            )}

            {movie.watched && (
              <div style={{ background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', backdropFilter: 'blur(4px)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                ✓ Assistido
              </div>
            )}
          </div>
        </div>

        {/* Título e Info Inferior */}
        <div style={{ textAlign: 'center', padding: '0 5px' }}>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-color)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }} title={movie.title}>{movie.title}</strong>
          {streamerMode && movie.requestedBy && (
            <div style={{ fontSize: '0.9rem', color: '#888', marginTop: '5px' }}>
              Por: <strong style={{ color: 'var(--primary)' }}>{movie.requestedBy}</strong>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

interface HomeProps {
  token: string;
  streamerMode: boolean;

  stats?: any;
  setShowBestMoviesModal?: (val: boolean) => void;
  setShowTopRescuersModal?: (val: boolean) => void;
}

export default function Home({ token, streamerMode, stats, setShowBestMoviesModal, setShowTopRescuersModal }: HomeProps) {
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMovieDetails, setSelectedMovieDetails] = useState<any | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const fetchMovies = useCallback(async () => {
    try {
      const response = await api.get('/movies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovies(response.data);
    } catch (error) {
      toast.error("Erro ao carregar a página inicial.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleShowDetails = async (tmdbId: number) => {
    if (!tmdbId) return;
    try {
      const response = await api.get(`/movies/tmdb/${tmdbId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMovieDetails(response.data);
    } catch (error) {
      toast.error("Erro ao buscar detalhes do filme.");
    }
  };

  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const today = localDate.toISOString().split('T')[0];

  const displayedMovies = movies
    .filter(m => {
      if (!m.watchDate) return false;
      const mDate = String(m.watchDate).split('T')[0];
      return mDate >= today;
    })
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime());

  const highlightMovies = movies
    .filter(m => m.watchDate && String(m.watchDate).split('T')[0] >= today && !m.watched && m.poster)
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime())
    .slice(0, 5);

  const terrorDaSemana = movies
    .filter(m => m.watchDate && String(m.watchDate).split('T')[0] >= today && !m.watched && new Date(m.watchDate).getUTCDay() === 5 && (m.genre?.toLowerCase().includes('terror') || m.genre?.toLowerCase().includes('horror')))
    .sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime())[0];

  const bannerSlides: any[] = [...highlightMovies.map(m => ({ type: 'movie', data: m }))];
  if (terrorDaSemana) {
    bannerSlides.unshift({ type: 'terror', data: terrorDaSemana });
  }
  if (streamerMode && stats?.topRescuer && stats.topRescuer !== 'N/A') {
    bannerSlides.unshift({ type: 'rescuer', data: { name: stats.topRescuer, count: stats.monthRanking?.[0]?.count } });
  }
  if (streamerMode && stats?.bestMovies?.length > 0) {
    bannerSlides.unshift({ type: 'best_movie', data: stats.bestMovies });
  }

  useEffect(() => {
    if (bannerSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHighlightIndex(prev => (prev + 1) % bannerSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [bannerSlides.length]);



  // Drag and drop temporariamente removido

  const currentHighlight = bannerSlides[highlightIndex] || null;

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '20px' }}>
      <style>
        {`
          .drag-over {
            border: 2px dashed var(--primary) !important;
            transform: scale(1.02);
            transition: all 0.2s;
          }
          .dragging { opacity: 0.5; }
          .draggable-card { cursor: grab; }
          .draggable-card:active { cursor: grabbing; }
          
          @keyframes pulse-glow {
            0% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 0.8; }
            100% { transform: scale(1); opacity: 0.5; }
          }
          
          .highlight-banner {
            position: relative;
            width: 100%;
            height: 300px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          }
          .highlight-banner .bg-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.4) blur(20px);
            transform: scale(1.15);
          }
          .highlight-banner .gradient-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%);
          }
          .highlight-banner .content {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            padding: 30px 50px;
            gap: 40px;
            z-index: 2;
          }
          .highlight-banner .poster-img {
            width: 160px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            transition: transform 0.4s;
            flex-shrink: 0;
          }
          .highlight-banner .poster-img:hover {
            transform: scale(1.05);
          }
          .highlight-banner .info {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 15px;
            flex: 1;
            min-width: 0;
          }
          .highlight-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 20px;
          }
          .highlight-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgba(255,255,255,0.25);
            border: none;
            cursor: pointer;
            transition: all 0.3s;
            padding: 0;
          }
          .highlight-dot.active {
            background: var(--primary);
            width: 28px;
            border-radius: 5px;
            box-shadow: 0 0 10px var(--primary);
          }
          .empty-state-cinema {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            text-align: center;
            background: rgba(255,255,255,0.03);
            border: 1px dashed rgba(255,255,255,0.1);
            border-radius: 20px;
          }
          .cinema-seat-svg {
            width: 100px;
            height: 100px;
            margin-bottom: 20px;
            opacity: 0.6;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>

      {/* ===== BANNER DESTAQUE ===== */}
      {bannerSlides.length > 0 && currentHighlight ? (
        <section>
          <h2 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>⭐ Destaques</h2>
          <div style={{ position: 'relative' }}>
            <div className="highlight-banner">
            
            {currentHighlight.type === 'movie' && (
              <>
                {/* Background borrado */}
                <img className="bg-img" src={`https://image.tmdb.org/t/p/w780${currentHighlight.data.poster}`} alt="bg" />
                <div className="gradient-overlay"></div>
                
                {/* Conteúdo */}
                <div className="content">
                  <img 
                    className="poster-img" 
                    src={`https://image.tmdb.org/t/p/w342${currentHighlight.data.poster}`} 
                    alt={currentHighlight.data.title}
                    onClick={() => handleShowDetails(currentHighlight.data.tmdbId)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="info">
                    <h2 style={{ 
                      fontSize: '2.8rem', 
                      color: '#fff', 
                      margin: 0, 
                      fontWeight: 'bold', 
                      lineHeight: '1.1',
                      textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {currentHighlight.data.title}
                    </h2>
                    {currentHighlight.data.voteAverage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={20} fill="#fbbf24" color="#fbbf24" />
                        <span style={{ color: '#fbbf24', fontSize: '1.2rem', fontWeight: 'bold' }}>
                          {(currentHighlight.data.voteAverage / 2).toFixed(1)}/5
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
                      <button 
                        onClick={() => handleShowDetails(currentHighlight.data.tmdbId)}
                        style={{ 
                          background: 'var(--primary)', 
                          color: '#fff', 
                          border: 'none', 
                          padding: '12px 30px', 
                          borderRadius: '12px', 
                          fontWeight: 'bold', 
                          fontSize: '1rem', 
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)'; }}
                      >
                        Assistir Agora
                      </button>
                    </div>
                    {streamerMode && currentHighlight.data.requestedBy && (
                      <p style={{ margin: 0, color: '#888', fontSize: '0.95rem' }}>Resgatado por: <strong style={{ color: 'var(--primary)' }}>{currentHighlight.data.requestedBy}</strong></p>
                    )}
                  </div>
                </div>
              </>
            )}

            {currentHighlight.type === 'rescuer' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0f172a', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '100%', height: '200%', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 60%)', animation: 'pulse-glow 8s infinite' }} />
                 <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,23,42,1) 10%, rgba(15,23,42,0.4) 100%)' }} />
                 
                 <div className="content" style={{ display: 'flex', alignItems: 'center', padding: '0 50px', gap: '40px', height: '100%', position: 'relative', zIndex: 2 }}>
                    <div style={{ flexShrink: 0, background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(30,58,138,0.5))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '30px', padding: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 30px rgba(59,130,246,0.2)' }}>
                      <Trophy size={80} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 30px rgba(251,191,36,0.6))' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ backgroundColor: 'rgba(251,191,36,0.15)', border: '1px solid #fbbf24', color: '#fbbf24', padding: '6px 18px', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', alignSelf: 'flex-start' }}>👑 Hall da Fama</span>
                      <h2 style={{ fontSize: '1.4rem', color: '#93c5fd', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Maior Resgatador do Mês</h2>
                      <h1 style={{ fontSize: '2.8rem', color: '#fff', margin: 0, fontWeight: 'bold', textShadow: '0 5px 20px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{currentHighlight.data.name}</h1>
                      <p style={{ fontSize: '1.1rem', color: '#bfdbfe', margin: '0 0 10px 0' }}>Dominando a agenda com <strong style={{ color: '#fff' }}>{currentHighlight.data.count} resgates</strong> no ranking geral!</p>
                      
                      <button onClick={() => setShowTopRescuersModal && setShowTopRescuersModal(true)} style={{ alignSelf: 'flex-start', background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', color: '#fff', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.5)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        Ver Pódio
                      </button>
                    </div>
                 </div>
              </div>
            )}

            {currentHighlight.type === 'best_movie' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#451a03', overflow: 'hidden' }}>
                 {currentHighlight.data.length === 1 && currentHighlight.data[0].poster && (
                   <img src={`https://image.tmdb.org/t/p/w780${currentHighlight.data[0].poster}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3) blur(15px)', transform: 'scale(1.1)' }} alt="bg" />
                 )}
                 <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '100%', height: '200%', background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 60%)', animation: 'pulse-glow 8s infinite reverse' }} />
                 <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(69,26,3,1) 10%, rgba(69,26,3,0.5) 100%)' }} />
                 
                 <div className="content" style={{ display: 'flex', alignItems: 'center', padding: '0 50px', gap: '40px', height: '100%', position: 'relative', zIndex: 2 }}>
                    <div style={{ flexShrink: 0, position: 'relative' }}>
                      {currentHighlight.data.length === 1 && currentHighlight.data[0].poster ? (
                        <>
                          <img src={`https://image.tmdb.org/t/p/w342${currentHighlight.data[0].poster}`} style={{ width: '160px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(245,158,11,0.4)', border: '2px solid rgba(245,158,11,0.5)' }} alt="Poster" />
                          <div style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#fbbf24', borderRadius: '50%', padding: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                            <Star size={30} fill="#78350f" color="#78350f" />
                          </div>
                        </>
                      ) : (
                        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(120,53,15,0.5))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '30px', padding: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 30px rgba(245,158,11,0.2)' }}>
                          <Star size={80} fill="#fbbf24" color="#fbbf24" style={{ filter: 'drop-shadow(0 0 30px rgba(251,191,36,0.6))' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ backgroundColor: 'rgba(251,191,36,0.15)', border: '1px solid #fbbf24', color: '#fbbf24', padding: '6px 18px', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', alignSelf: 'flex-start' }}>⭐ O Queridinho da Galera</span>
                      <h2 style={{ fontSize: '1.4rem', color: '#fcd34d', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Melhor Avaliado do Mês</h2>
                      <h1 style={{ fontSize: '2.8rem', color: '#fff', margin: 0, fontWeight: 'bold', textShadow: '0 5px 20px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {currentHighlight.data.length === 1 ? currentHighlight.data[0].title : `${currentHighlight.data.length} Filmes Empatados!`}
                      </h1>
                      <p style={{ fontSize: '1.1rem', color: '#fde68a', margin: '0 0 10px 0' }}>{currentHighlight.data.length === 1 ? 'A pontuação máxima do chat e do streamer!' : 'A disputa foi acirrada e não tivemos um único vencedor.'}</p>
                      
                      <button onClick={() => setShowBestMoviesModal && setShowBestMoviesModal(true)} style={{ alignSelf: 'flex-start', background: 'rgba(245,158,11,0.2)', border: '1px solid #fbbf24', color: '#fff', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.boxShadow = '0 0 20px rgba(245,158,11,0.5)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        {currentHighlight.data.length === 1 ? 'Ver Vencedor' : 'Ir para o Desempate'}
                      </button>
                    </div>
                 </div>
              </div>
            )}

            {currentHighlight.type === 'terror' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#450a0a', overflow: 'hidden' }}>
                 {currentHighlight.data.poster && (
                   <img src={`https://image.tmdb.org/t/p/w780${currentHighlight.data.poster}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3) blur(15px) grayscale(50%)', transform: 'scale(1.1)' }} alt="bg" />
                 )}
                 <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '100%', height: '200%', background: 'radial-gradient(circle, rgba(220,38,38,0.2) 0%, transparent 60%)', animation: 'pulse-glow 8s infinite reverse' }} />
                 <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(69,10,10,1) 10%, rgba(69,10,10,0.5) 100%)' }} />
                 
                 <div className="content" style={{ display: 'flex', alignItems: 'center', padding: '0 50px', gap: '40px', height: '100%', position: 'relative', zIndex: 2 }}>
                    <div style={{ flexShrink: 0, position: 'relative' }}>
                      <img src={`https://image.tmdb.org/t/p/w342${currentHighlight.data.poster}`} style={{ width: '160px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(220,38,38,0.4)', border: '2px solid rgba(220,38,38,0.5)' }} alt="Poster" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid #dc2626', color: '#f87171', padding: '6px 18px', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', alignSelf: 'flex-start' }}>🩸 Sexta do Terror</span>
                      <h2 style={{ fontSize: '1.4rem', color: '#fca5a5', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Prepare os Nervos</h2>
                      <h1 style={{ fontSize: '2.8rem', color: '#fff', margin: 0, fontWeight: 'bold', textShadow: '0 5px 20px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {currentHighlight.data.title}
                      </h1>
                      <p style={{ fontSize: '1.1rem', color: '#fecaca', margin: '0 0 10px 0' }}>O grande escolhido para assombrar a nossa noite!</p>
                      
                      <button onClick={() => handleShowDetails(currentHighlight.data.tmdbId)} style={{ alignSelf: 'flex-start', background: 'rgba(220,38,38,0.2)', border: '1px solid #dc2626', color: '#fff', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 20px rgba(220,38,38,0.5)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        Ver Detalhes
                      </button>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {bannerSlides.length > 1 && (
            <>
              <button 
                className="btn-secondary"
                onClick={(e) => { e.stopPropagation(); setHighlightIndex(prev => (prev - 1 + bannerSlides.length) % bannerSlides.length); }}
                style={{ position: 'absolute', left: '-20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, margin: 0, padding: '12px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowLeft size={20} />
              </button>
              <button 
                className="btn-secondary"
                onClick={(e) => { e.stopPropagation(); setHighlightIndex(prev => (prev + 1) % bannerSlides.length); }}
                style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, margin: 0, padding: '12px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowRight size={20} />
              </button>
            </>
          )}
        </div>

          {/* Dots de navegação */}
          {bannerSlides.length > 1 && (
            <div className="highlight-dots">
              {bannerSlides.map((_, i) => (
                <button
                  key={i}
                  className={`highlight-dot ${i === highlightIndex ? 'active' : ''}`}
                  onClick={() => setHighlightIndex(i)}
                />
              ))}
            </div>
          )}
        </section>
      ) : isLoading ? (
        <section>
          <h2 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>⭐ Destaques</h2>
          <div style={{ position: 'relative' }}>
            <div className="highlight-banner" style={{ backgroundColor: 'rgba(255,255,255,0.05)', animation: 'pulse-glow 2s infinite' }} />
          </div>
          <div className="highlight-dots">
            <button className="highlight-dot active" style={{ animation: 'pulse-glow 2s infinite', cursor: 'default' }} />
            <button className="highlight-dot" style={{ animation: 'pulse-glow 2s infinite', cursor: 'default' }} />
            <button className="highlight-dot" style={{ animation: 'pulse-glow 2s infinite', cursor: 'default' }} />
          </div>
        </section>
      ) : null}

      {/* ===== FILMES E AGENDA ===== */}
      {isLoading ? (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📅 Filmes e Agenda
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '20px', overflow: 'hidden', paddingBottom: '10px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ width: '100%', aspectRatio: '2/3', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', animation: 'pulse-glow 2s infinite' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '0 5px' }}>
                  <div style={{ width: '90%', height: '18px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse-glow 2s infinite' }} />
                  <div style={{ width: '60%', height: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse-glow 2s infinite' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section>
          {/* Header com título */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📅 Filmes e Agenda
            </h2>
          </div>

          {displayedMovies.length === 0 ? (
            <div className="empty-state-cinema" style={{ padding: '40px 20px' }}>
              {/* Ilustração de poltrona de cinema */}
              <svg className="cinema-seat-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="15" y="55" width="90" height="45" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
                <rect x="20" y="25" width="80" height="35" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
                <rect x="10" y="100" width="20" height="12" rx="4" fill="#334155"/>
                <rect x="90" y="100" width="20" height="12" rx="4" fill="#334155"/>
                <rect x="25" y="60" width="30" height="8" rx="4" fill="#334155"/>
                <rect x="65" y="60" width="30" height="8" rx="4" fill="#334155"/>
              </svg>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', margin: '0 0 8px 0', fontWeight: 'bold' }}>Sua agenda está vazia</h3>
              <p style={{ color: '#8899aa', fontSize: '0.95rem', margin: 0, maxWidth: '400px', lineHeight: '1.4' }}>
                Nenhum filme agendado daqui pra frente. Aproveite para explorar nossas recomendações e buscar novos filmes.
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {displayedMovies.length > 4 && (
                <button className="btn-secondary" onClick={() => document.getElementById('agenda-carousel')?.scrollBy({ left: -600, behavior: 'smooth' })} style={{ position: 'absolute', left: '-20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, margin: 0, padding: '12px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}><ArrowLeft size={20} /></button>
              )}
              
              <div 
                id="agenda-carousel"
                className="hide-scrollbar"
                style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px', scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {displayedMovies.map(movie => (
                  <div key={movie.id} style={{ flex: '0 0 190px' }}>
                  <HomeMovieCardItem 
                    movie={movie}
                    onShowDetails={handleShowDetails}
                    streamerMode={streamerMode}
                  />
                </div>
              ))}
              </div>
              
              {displayedMovies.length > 4 && (
                <button className="btn-secondary" onClick={() => document.getElementById('agenda-carousel')?.scrollBy({ left: 600, behavior: 'smooth' })} style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, margin: 0, padding: '12px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}><ArrowRight size={20} /></button>
              )}
            </div>
          )}
        </section>
      )}



      <MovieDetailsModal movie={selectedMovieDetails} onClose={() => setSelectedMovieDetails(null)} />
    </div>
  );
}