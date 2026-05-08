import { useMemo, useEffect, useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface HallOfTrashProps {
  isOpen: boolean;
  onClose: () => void;
  movies: any[];
  token: string;
  onUpdate: () => void;
}

export default function HallOfTrash({ isOpen, onClose, movies, token, onUpdate }: HallOfTrashProps) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else {
      document.body.style.overflow = 'auto';
      setShowScrollTop(false);
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  const allTrash = useMemo(() => {
    return movies.filter(m => m.watched && m.streamerRating != null && m.streamerRating <= 3)
      .sort((a, b) => (a.streamerRating || 0) - (b.streamerRating || 0)); // Menor nota primeiro
  }, [movies]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allTrash.forEach(m => {
      if (m.watchDate) months.add(String(m.watchDate).substring(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [allTrash]);

  const isAbsoluteWorst = (movie: any, group: any) => {
    if (movie.isTrash) return true; // Se já estiver salvo no banco
    if (group.tiedForLowest.length === 1 && movie.streamerRating === group.minRating) return true; // É o único com a pior nota
    return false;
  };

  const { groupedTrash, overallTopCulprit } = useMemo(() => {
    const groups: Record<string, any> = {};
    const culprits: Record<string, number> = {};

    allTrash.forEach(m => {
      const month = m.watchDate ? String(m.watchDate).substring(0, 7) : 'Sem data';
      
      if (selectedMonthFilter === 'ALL' || month === selectedMonthFilter) {
        if (!groups[month]) {
          groups[month] = {
            movies: [],
            minRating: Infinity,
            tiedForLowest: [],
            hasChosenTrashInTies: false
          };
        }
        
        groups[month].movies.push(m);
        
        const name = m.requestedBy?.trim();
        if (name && name.toLowerCase() !== 'ninguém' && name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas') {
          culprits[name] = (culprits[name] || 0) + 1;
        }
      }
    });

    // Calcula as estatísticas de notas para cada mês
    Object.keys(groups).forEach(month => {
      const group = groups[month];
      group.movies.forEach((m: any) => {
        if (m.streamerRating !== null && m.streamerRating < group.minRating) {
          group.minRating = m.streamerRating;
        }
      });
      group.tiedForLowest = group.movies.filter((m: any) => m.streamerRating === group.minRating);
      group.hasChosenTrashInTies = group.tiedForLowest.some((m: any) => m.isTrash);

      // Ordena para que o pior filme (eleito ou único) fique em primeiro
      group.movies.sort((a: any, b: any) => {
        const aIsWorst = isAbsoluteWorst(a, group);
        const bIsWorst = isAbsoluteWorst(b, group);
        if (aIsWorst && !bIsWorst) return -1;
        if (bIsWorst && !aIsWorst) return 1;
        return (a.streamerRating || 0) - (b.streamerRating || 0);
      });
    });

    let tops: string[] = [];
    let max = 0;
    for (const [name, count] of Object.entries(culprits)) {
      if (count > max) {
        max = count;
        tops = [name];
      } else if (count === max && max > 0) {
        tops.push(name);
      }
    }
    const top = max > 0 ? { names: tops, count: max } : null;

    return { groupedTrash: groups, overallTopCulprit: top };
  }, [allTrash, selectedMonthFilter]);

  if (!isOpen) return null;

  const getMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const handleSetTrash = async (movie: any) => {
    if (movie.isTrash) {
      toast(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem', color: '#fca5a5' }}>Deseja remover a coroa de 💩 de <strong>"{movie.title}"</strong>?</span>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
              <button className="btn-danger" style={{ flex: 1 }} onClick={async () => {
                toast.dismiss(t.id);
                await api.put(`/movies/${movie.id}`, { isTrash: false }, { headers: { Authorization: `Bearer ${token}` } });
                onUpdate();
              }}>Remover</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>Cancelar</button>
            </div>
          </div>
        ),
        { duration: 10000, position: 'top-center', style: { marginTop: '40vh', minWidth: '320px', padding: '20px', background: '#2f3822', border: '1px solid #4d7c0f', color: '#fff' } }
      );
      return;
    }
    
    toast(
      (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>💩</span>
          <span style={{ fontSize: '1.1rem', color: '#a3e635' }}>Deseja eleger <strong>"{movie.title}"</strong> como a PIOR experiência?</span>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
            <button className="btn-primary" style={{ backgroundColor: '#4d7c0f', color: '#fff', flex: 1, border: 'none' }} onClick={async () => {
              toast.dismiss(t.id);
              try {
                const month = movie.watchDate ? String(movie.watchDate).substring(0, 7) : null;
                const currentTrash = movies.find(m => m.isTrash && m.watchDate && String(m.watchDate).substring(0, 7) === month);
                if (currentTrash) await api.put(`/movies/${currentTrash.id}`, { isTrash: false }, { headers: { Authorization: `Bearer ${token}` } });
                await api.put(`/movies/${movie.id}`, { isTrash: true }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success(`A coroa de chorume foi para "${movie.title}"! 💩`);
                onUpdate();
              } catch (e) {
                toast.error("Erro ao eleger o pior filme.");
              }
            }}>Eleger Pior</button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>Cancelar</button>
          </div>
        </div>
      ),
      { duration: 10000, position: 'top-center', style: { marginTop: '40vh', minWidth: '320px', padding: '20px', background: '#1c1511', border: '1px solid #8b4513', color: '#fff' } }
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
    <div ref={containerRef} onScroll={handleScroll} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, backgroundImage: 'linear-gradient(135deg, rgba(26, 28, 24, 0.85) 0%, rgba(47, 56, 34, 0.85) 50%, rgba(28, 21, 17, 0.95) 100%), url("/lixo.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', scrollBehavior: 'smooth' }}>
      <style>
        {`
          @keyframes buzz {
            0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
            20% { transform: translate(30px, -40px) scale(0.8) rotate(45deg); }
            40% { transform: translate(-20px, -60px) scale(1.1) rotate(-30deg); }
            60% { transform: translate(-50px, 10px) scale(0.9) rotate(60deg); }
            80% { transform: translate(10px, 30px) scale(1.2) rotate(-15deg); }
            100% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          }
          .fly {
            position: absolute;
            width: 5px; height: 5px; 
            background: #111; 
            border-radius: 50%;
            box-shadow: 0 0 3px #000;
            pointer-events: none;
            z-index: 100;
          }
          .fly::before, .fly::after {
            content: ''; position: absolute; top: -2px; width: 6px; height: 3px; background: rgba(255,255,255,0.4); border-radius: 50%;
          }
          .fly::before { left: -4px; transform: rotate(-30deg); }
          .fly::after { right: -4px; transform: rotate(30deg); }
          
          .trash-card {
            background: #25231e !important;
            border: 2px solid #4a4031 !important;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.6) !important;
          }
          .worst-aura {
            box-shadow: 0 0 25px rgba(139, 69, 19, 0.8), inset 0 0 15px rgba(139, 69, 19, 0.5) !important;
            border: 2px solid #8b4513 !important;
            transform: scale(1.05);
            z-index: 10;
          }
        `}
      </style>

      <div style={{ width: '100%', maxWidth: '1200px', padding: '40px 20px', boxSizing: 'border-box', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '30px', right: '30px', background: 'transparent', border: 'none', color: '#a3e635', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⬅️ Voltar ao Dashboard
        </button>
        
        <h1 style={{ color: '#84cc16', textAlign: 'center', fontSize: '3rem', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 4px 10px rgba(0,0,0,0.8)' }}>🗑️ Hall do Lixo</h1>
        <p style={{ textAlign: 'center', color: '#a1a1aa', fontSize: '1.1rem', marginBottom: '20px' }}>As piores experiências cinematográficas já vistas por aqui (Notas de 0 a 3).</p>

        {availableMonths.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <select value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#1c1511', color: '#a3e635', border: '1px solid #4d7c0f', outline: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <option value="ALL">Todos os Meses</option>
              {availableMonths.map(month => <option key={month} value={month}>{getMonthLabel(month)}</option>)}
            </select>
          </div>
        )}

        {overallTopCulprit && (
          <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', padding: '15px', borderRadius: '8px', textAlign: 'center', maxWidth: '500px', margin: '0 auto 40px auto' }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 5px 0' }}>⚠️ Fornecedor de Chorume</h3>
            {overallTopCulprit.names.length > 1 ? (
              <p style={{ margin: 0, color: '#fca5a5' }}><strong>Empate!</strong> Os viewers <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{overallTopCulprit.names.join(', ')}</strong> resgataram {overallTopCulprit.count} {overallTopCulprit.count === 1 ? 'atrocidade' : 'atrocidades'} cada.</p>
            ) : (
              <p style={{ margin: 0, color: '#fca5a5' }}>O viewer <strong style={{ color: '#fff', fontSize: '1.2rem' }}>{overallTopCulprit.names[0]}</strong> resgatou {overallTopCulprit.count} {overallTopCulprit.count === 1 ? 'atrocidade' : 'atrocidades'}.</p>
            )}
          </div>
        )}

        {Object.keys(groupedTrash).length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Por incrível que pareça, o porão está vazio.</p>
        ) : (
          Object.keys(groupedTrash).sort((a, b) => b.localeCompare(a)).map(month => {
            const group = groupedTrash[month];
            return (
              <div key={month} style={{ marginBottom: '60px', width: '100%' }}>
                <h2 style={{ color: '#84cc16', borderBottom: '1px solid #4d7c0f', paddingBottom: '10px', marginBottom: '20px', width: '100%', textAlign: 'left' }}>
                  {month === 'Sem data' ? 'Sem data' : getMonthLabel(month)}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '25px', alignItems: 'start' }}>
                  {group.movies.map((movie: any, idx: number) => {
                    const isWorst = isAbsoluteWorst(movie, group);
                    const isTied = group.tiedForLowest.length > 1 && movie.streamerRating === group.minRating;
                    
                    return (
                      <div key={movie.id} onClick={() => handleSetTrash(movie)} className={`movie-card trash-card ${isWorst ? 'worst-aura' : ''}`} title={isWorst ? 'Atual Pior do Mês' : 'Clique para coroar como o Pior'} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', cursor: 'pointer', opacity: (group.hasChosenTrashInTies && !isWorst && isTied) ? 0.6 : 1 }}>
                        {isWorst && <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5rem', zIndex: 20 }}>💩</div>}
                        {/* Moscas falsas animadas aleatoriamente em volta de cada card */}
                        <div className="fly" style={{ top: '10%', left: '20%', animation: `buzz ${2 + (idx % 3)}s infinite alternate ease-in-out` }}></div>
                        <div className="fly" style={{ bottom: '20%', right: '30%', animation: `buzz ${3 + (idx % 2)}s infinite alternate-reverse ease-in-out` }}></div>
                        
                        {movie.poster ? (
                          <img src={`https://image.tmdb.org/t/p/w200${movie.poster}`} alt={movie.title} style={{ width: '100%', height: 'auto', aspectRatio: '2/3', borderRadius: '4px', filter: 'sepia(0.4) brightness(0.7) contrast(1.2)' }} />
                        ) : (
                          <div style={{ width: '100%', height: 'auto', aspectRatio: '2/3', backgroundColor: '#111', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Lixo</div>
                        )}
                        <div style={{ padding: '10px 5px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: isWorst ? '1.1rem' : '1rem', color: isWorst ? '#8b4513' : '#d4d4d8', textAlign: 'center', margin: '5px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{movie.title}</strong>
                          <span style={{ fontSize: '0.85rem', color: '#a1a1aa', textAlign: 'center', marginBottom: '5px' }}>De: <strong style={{ color: isWorst ? '#8b4513' : '#fca5a5' }}>{movie.requestedBy || 'Ninguém'}</strong></span>
                          <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 'bold', color: '#ef4444', textAlign: 'center' }}>⭐ {movie.streamerRating}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
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
            backgroundColor: '#4d7c0f',
            border: 'none'
          }}
          title="Voltar ao Topo"
        >
          ⬆️
        </button>
      )}
    </div>
  );
}