import { useMemo, useEffect, useState, useRef } from 'react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface HallOfFameProps {
  isOpen: boolean;
  onClose: () => void;
  movies: any[];
  champions: Record<string, any>;
  token: string;
  onUpdate: () => void;
}

export default function HallOfFame({ isOpen, onClose, movies, champions, token, onUpdate }: HallOfFameProps) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Impede rolagem do body quando o modal de tela cheia estiver aberto
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else {
      document.body.style.overflow = 'auto';
      setShowScrollTop(false);
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  // Agrupa os filmes assistidos (nota >= 8 ou campeões) por mês
  const groupedMovies = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    // Primeiro, agrupa TODOS os filmes assistidos por mês
    movies.forEach(m => {
      if (m.watched && m.watchDate) {
        const month = String(m.watchDate).substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push({ ...m, isChampion: champions[month]?.id === m.id });
      }
    });
    
    const finalGroups: Record<string, any[]> = {};

    Object.keys(groups).forEach(month => {
      const monthMovies = groups[month];
      
      // Verifica se há algum filme com nota 10. Se não, o alvo vira 9.
      const has10 = monthMovies.some(m => m.streamerRating === 10);
      const targetRating = has10 ? 10 : 9;
      
      // Filtra para manter apenas os filmes com a nota alvo OU se for o campeão daquele mês
      const bestMovies = monthMovies.filter(m => m.streamerRating === targetRating || m.isChampion);
      
      if (bestMovies.length > 0) {
        bestMovies.sort((a, b) => {
          if (a.isChampion) return -1;
          if (b.isChampion) return 1;
          return (b.streamerRating || 0) - (a.streamerRating || 0);
        });
        finalGroups[month] = bestMovies;
      }
    });

    return finalGroups;
  }, [movies, champions]);

  const sortedMonths = Object.keys(groupedMovies).sort((a, b) => b.localeCompare(a));
  
  const filteredMonths = sortedMonths.filter(month => selectedMonthFilter === 'ALL' || month === selectedMonthFilter);

  if (!isOpen) return null;

  const getMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const handleSetChampion = async (movie: any, month: string) => {
    if (movie.isChampion) return; // Já é o campeão atual
    
    toast(
      (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>👑</span>
          <span style={{ fontSize: '1.1rem', color: '#fbbf24' }}>Deseja coroar <strong>"{movie.title}"</strong> como o Melhor do Mês?</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
            <button className="btn-primary" style={{ backgroundColor: '#fbbf24', color: '#000', flex: 1, border: 'none' }} onClick={async () => {
              toast.dismiss(t.id);
              try {
                const currentChampion = champions[month];
                if (currentChampion) {
                  await api.put(`/movies/${currentChampion.id}`, { isChampion: false }, { headers: { Authorization: `Bearer ${token}` } });
                }
                await api.put(`/movies/${movie.id}`, { isChampion: true }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success(`"${movie.title}" coroado com sucesso!`);
                onUpdate(); // Atualiza os dados no Dashboard
              } catch (e) {
                toast.error("Erro ao coroar o filme.");
              }
            }}>Coroar</button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>Cancelar</button>
          </div>
        </div>
      ),
      { duration: 10000, position: 'top-center', style: { marginTop: '40vh', minWidth: '320px', padding: '20px', background: '#2a2005', border: '1px solid #fbbf24', color: '#fff' } }
    );
  };

  const handleScroll = () => {
    if (containerRef.current) {
      setShowScrollTop(containerRef.current.scrollTop > 300);
    }
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, backgroundImage: 'linear-gradient(135deg, rgba(17, 17, 17, 0.85) 0%, rgba(42, 32, 5, 0.95) 100%), url("/ouro.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', scrollBehavior: 'smooth' }}>
      <style>
        {`
          .fame-champion-aura {
            box-shadow: 0 0 25px rgba(251, 191, 36, 0.6), inset 0 0 10px rgba(251, 191, 36, 0.2);
            border: 2px solid #fbbf24 !important;
            transform: scale(1.05);
            z-index: 10;
            background: linear-gradient(180deg, rgba(251,191,36,0.15) 0%, rgba(0,0,0,0) 100%);
          }
        `}
      </style>

      <div style={{ width: '100%', maxWidth: '1200px', padding: '40px 20px', boxSizing: 'border-box', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '30px', right: '30px', background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={16} /> Voltar ao Dashboard</span>
        </button>
        
        <h1 style={{ color: '#fbbf24', textAlign: 'center', fontSize: '3rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '3px', textShadow: '0 4px 15px rgba(251,191,36,0.4)' }}>🏆 Hall da Fama</h1>
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '1.1rem', marginBottom: '50px' }}>Os melhores filmes de cada mês.</p>

        {sortedMonths.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <select value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#1a1a1a', color: '#fbbf24', border: '1px solid #fbbf24', outline: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <option value="ALL">Todos os Meses</option>
              {sortedMonths.map(month => <option key={month} value={month}>{getMonthLabel(month)}</option>)}
            </select>
          </div>
        )}

        {filteredMonths.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Nenhum filme memorável registrado ainda.</p>
        ) : (
          filteredMonths.map(month => (
            <div key={month} style={{ marginBottom: '60px' }}>
              <h2 style={{ color: '#fbbf24', borderBottom: '1px solid #fbbf24', paddingBottom: '10px', marginBottom: '20px' }}>{getMonthLabel(month)}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '25px', alignItems: 'start' }}>
                {groupedMovies[month].map(movie => (
                  <div key={movie.id} onClick={() => handleSetChampion(movie, month)} className={`movie-card ${movie.isChampion ? 'fame-champion-aura' : ''}`} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s', position: 'relative', cursor: movie.isChampion ? 'default' : 'pointer' }} title={movie.isChampion ? 'Atual Campeão' : 'Clique para coroar como o melhor do mês'}>
                    {movie.isChampion && (
                      <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5rem', zIndex: 20, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>👑</div>
                    )}
                    {movie.poster ? (
                      <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} style={{ width: '100%', height: 'auto', aspectRatio: '2/3', borderRadius: '6px', opacity: movie.isChampion ? 1 : 0.8 }} />
                    ) : (
                      <div style={{ width: '100%', height: 'auto', aspectRatio: '2/3', backgroundColor: '#222', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sem capa</div>
                    )}
                    <div style={{ padding: '10px 5px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: movie.isChampion ? '1.1rem' : '1rem', color: movie.isChampion ? '#fbbf24' : '#fff', textAlign: 'center', margin: '10px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{movie.title}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center', marginBottom: '5px' }}>De: <strong style={{ color: '#fbbf24' }}>{movie.requestedBy || 'Ninguém'}</strong></span>
                      <span style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>⭐ {movie.streamerRating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {showScrollTop && (
        <button 
          onClick={scrollToTop} 
          className="btn-primary"
          style={{ 
            position: 'fixed', 
            bottom: '40px', 
            right: '40px', 
            borderRadius: '50%', 
            width: '55px', 
            height: '55px', 
            fontSize: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            zIndex: 1000,
            backgroundColor: '#fbbf24',
            border: 'none'
          }}
          title="Voltar ao Topo"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}