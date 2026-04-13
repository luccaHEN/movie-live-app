import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const tickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
const flipSound = new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3');
tickSound.volume = 0.5;
winSound.volume = 0.6;
flipSound.volume = 0.6;

interface RouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  streamerMode: boolean;
  fetchMovies: (silent?: boolean) => void;
  savedMovies: any[];
}

export default function RouletteModal({ isOpen, onClose, token, streamerMode, fetchMovies, savedMovies }: RouletteModalProps) {
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

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen]);

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
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [rouletteSearchQuery, token]);

  if (!isOpen) return null;

  const playSound = (type: 'TICK' | 'WIN' | 'FLIP') => {
    try {
      let audio: HTMLAudioElement | null = null;
      if (type === 'TICK') audio = tickSound;
      else if (type === 'WIN') audio = winSound;
      else if (type === 'FLIP') audio = flipSound;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) { console.error("Erro ao tocar som", e); }
  };

  const handleSpinRoulette = () => {
    if (rouletteCandidates.length === 0) return toast.error("Adicione pelo menos um filme para sortear!");
    setIsSpinning(true);
    playSound('TICK');

    const winner = rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)];
    const startSlowingTicks = (maxTime: number) => {
      let delay = 50, total = 0;
      const nextTick = () => {
        if (total >= maxTime) return;
        playSound('TICK');
        total += delay;
        delay = delay * 1.15;
        setTimeout(nextTick, delay);
      };
      setTimeout(nextTick, delay);
    };

    if (drawType === 'FAST') {
      const track = [];
      for(let i=0; i<60; i++) track.push(rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)]);
      track[45] = winner;
      setCaseTrack(track);
      setCaseOffset(0);

      setTimeout(() => {
         const randomJitter = Math.floor(Math.random() * 110) - 55;
         setCaseOffset(-(45 * 130) + randomJitter);
      }, 50);
      startSlowingTicks(6000);

      setTimeout(() => {
        setDrawnMovie(winner); setIsSpinning(false); playSound('WIN');
        confetti({ zIndex: 9999, particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b'] });
      }, 6000);
    } else if (drawType === 'WHEEL') {
      const winnerIndex = rouletteCandidates.indexOf(winner);
      const sliceAngle = 360 / rouletteCandidates.length;
      const randomJitter = (Math.random() * sliceAngle * 0.8) - (sliceAngle * 0.4);
      const targetAngle = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2) + randomJitter;
      setWheelRotation(prev => prev + 1800 + targetAngle - (prev % 360));
      startSlowingTicks(4000);

      setTimeout(() => {
        setDrawnMovie(winner); setIsSpinning(false); playSound('WIN');
        confetti({ zIndex: 9999, particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b'] });
      }, 4000);
    }
  };

  const handleCardClick = (index: number) => {
    if (isSpinning || drawnMovie) return;
    const winner = rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)];
    setDrawnMovie(winner); setFlippedCardIndex(index); setIsSpinning(true); playSound('FLIP');
    setTimeout(() => {
      setIsSpinning(false); playSound('WIN');
      confetti({ zIndex: 9999, particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b'] });
    }, 1500);
  };

  const handleSaveDrawnMovie = async () => {
    if (!drawnMovie) return;
    if (streamerMode && !rouletteWatchDate) return toast.error('Por favor, selecione uma data para assistir o filme.');

    try {
      await api.post('/movies', {
        title: drawnMovie.title, tmdbId: drawnMovie.id, poster: drawnMovie.poster_path, genre: "N/A",
        ...(streamerMode ? { requestedBy: 'Chat', watchDate: new Date(rouletteWatchDate).toISOString() } : {})
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Filme "${drawnMovie.title}" salvo!`);
      onClose();
      fetchMovies(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar.');
    }
  };

  return (
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
      <div onClick={e => e.stopPropagation()} className="modal-content" style={{ maxWidth: isDrawScreen && drawType === 'FAST' ? '800px' : '500px', maxHeight: '90vh', textAlign: 'center', overflowX: 'hidden', overflowY: 'auto', transition: 'max-width 0.3s', position: 'relative' }}>
        {!isSpinning && <button onClick={onClose} className="close-btn">&times;</button>}
        
        {!isSpinning && isDrawScreen && (
          <button onClick={() => { setIsDrawScreen(false); setDrawnMovie(null); setCaseTrack([]); setCaseOffset(0); setFlippedCardIndex(null); }} style={{ position: 'absolute', top: '18px', left: '15px', background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: 0 }}>⬅️ Voltar</button>
        )}

        <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>🎲 Roleta de Filmes</h2>
        
        {!isDrawScreen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <input type="text" placeholder="Buscar filme..." value={rouletteSearchQuery} onChange={e => setRouletteSearchQuery(e.target.value)} style={{ flex: 1, paddingRight: '35px' }} />
                {rouletteSearchQuery && <button onClick={() => { setRouletteSearchQuery(''); setRouletteSearchResults([]); }} style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>&times;</button>}
              </div>
              {isSearching && <span style={{ fontSize: '0.85rem', color: '#aaa', width: '50px' }}>Buscando...</span>}
            </div>
            {rouletteSearchResults.filter(m => !rouletteCandidates.some(c => c.id === m.id)).length > 0 && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', textAlign: 'left', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '5px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {rouletteSearchResults.filter(m => !rouletteCandidates.some(c => c.id === m.id)).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 5px', borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt={m.title} style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{m.title}</span>
                        {savedMovies.find(saved => saved.tmdbId === m.id) && <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold' }}>{savedMovies.find(saved => saved.tmdbId === m.id).watched ? '✅ Já assistido' : '📌 Na lista'}</span>}
                      </div>
                    </div>
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => setRouletteCandidates(prev => prev.find(c => c.id === m.id) ? prev : [...prev, m])}>Adicionar</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <p style={{ margin: 0, color: '#ccc' }}>Candidatos ({rouletteCandidates.length}):</p>
              {rouletteCandidates.length > 0 && <button className="btn-danger" style={{ padding: '4px 8px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => setRouletteCandidates([])}>Limpar</button>}
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', textAlign: 'left', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '5px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              {rouletteCandidates.length === 0 ? <p style={{ margin: '10px', fontSize: '0.85rem', color: '#888' }}>Nenhum filme.</p> : rouletteCandidates.map((m, idx) => (
                <div key={`${m.id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 5px', borderBottom: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt={m.title} style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{m.title}</span>
                  </div>
                  <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '0.7rem', width: 'auto', margin: 0 }} onClick={() => setRouletteCandidates(prev => prev.filter((_, i) => i !== idx))}>Remover</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#ccc', textAlign: 'left' }}>Tipo de Animação:</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setDrawType('FAST')} className={`btn-${drawType === 'FAST' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>⚡ Rápida</button>
                <button onClick={() => setDrawType('WHEEL')} className={`btn-${drawType === 'WHEEL' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>🎡 Roleta</button>
                <button onClick={() => setDrawType('CARDS')} className={`btn-${drawType === 'CARDS' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '8px' }}>🃏 Cartas</button>
              </div>
            </div>
            <button onClick={() => { setIsDrawScreen(true); [tickSound, winSound, flipSound].forEach(a => { a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {}); }); }} className="btn-primary" disabled={rouletteCandidates.length === 0} style={{ marginTop: '10px', padding: '12px', fontSize: '1.1rem' }}>Ir para o Sorteio ➡️</button>
          </div>
        ) : (
          <>
            {drawType === 'WHEEL' && (
              <div style={{ position: 'relative', width: '300px', height: '300px', margin: '20px auto' }}>
                <div className="wheel-pointer"></div>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #fff', position: 'relative', overflow: 'hidden', background: `conic-gradient(${rouletteCandidates.map((_, i) => `${['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'][i % 12]} ${(i * 360) / rouletteCandidates.length}deg ${((i + 1) * 360) / rouletteCandidates.length}deg`).join(', ')})`, transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'none', transform: `rotate(${wheelRotation}deg)` }}>
                  {rouletteCandidates.map((m, i) => { const sliceAngle = 360 / rouletteCandidates.length; const rotation = (i * sliceAngle) + (sliceAngle / 2); return ( <div key={i} style={{ position: 'absolute', top: '10px', left: 'calc(50% - 15px)', width: '30px', height: '140px', transformOrigin: '50% 140px', transform: `rotate(${rotation}deg)`, color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', textShadow: '1px 1px 2px #000', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden' }}><span style={{ writingMode: 'vertical-rl', whiteSpace: 'nowrap' }}>{m.title.length > 16 ? m.title.substring(0, 14) + '..' : m.title}</span></div> ) })}
                </div>
              </div>
            )}
            {drawType === 'FAST' && (
              <div className="case-opening-container" style={{ margin: '20px 0' }}>
                 <div className="case-opening-marker"></div>
                 <div className="case-opening-track" style={{ transform: `translateX(${caseOffset}px)`, transition: isSpinning ? 'transform 6s cubic-bezier(0.05, 0.9, 0.1, 1)' : 'none' }}>
                     {caseTrack.length > 0 ? caseTrack.map((m, i) => ( <div key={i} className="case-opening-item">{m.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} /> : <div style={{padding: '10px', color: '#fff'}}>{m.title}</div>}</div> )) : rouletteCandidates.map((m, i) => ( <div key={i} className="case-opening-item" style={{ opacity: 0.5 }}>{m.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} /> : <span style={{padding: '10px'}}>{m.title}</span>}</div> ))}
                 </div>
              </div>
            )}
            {drawType === 'CARDS' && (!drawnMovie || isSpinning) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)' }}>Escolha uma carta!</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', maxWidth: '500px' }}>
                  {rouletteCandidates.map((_, i) => ( <div key={i} className="card-container" onClick={() => handleCardClick(i)}> <div className={`card-inner ${flippedCardIndex === i ? 'flipped' : ''}`}> <div className="card-front">❓</div> <div className="card-back">{flippedCardIndex === i && drawnMovie && ( drawnMovie.poster_path ? <img src={`https://image.tmdb.org/t/p/w200${drawnMovie.poster_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ganhador" /> : <span style={{ color: '#fff', padding: '10px', textAlign: 'center' }}>{drawnMovie.title}</span> )}</div> </div> </div> ))}
                </div>
              </div>
            )}
            {(!isSpinning && !drawnMovie && drawType !== 'CARDS') && <button className="btn-primary" onClick={handleSpinRoulette} style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1.2rem' }}>🎰 Girar!</button>}
            {!isSpinning && drawnMovie && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981' }}>🎉 Vencedor: {drawnMovie.title}</h3>
                {drawnMovie.poster_path && <img src={`https://image.tmdb.org/t/p/w200${drawnMovie.poster_path}`} alt={drawnMovie.title} style={{ width: '120px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }} />}
                {streamerMode && (
                  <div style={{ width: '100%', textAlign: 'left', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ margin: 0, color: '#ec4899', fontWeight: 'bold' }}>👑 Resgatado por: Chat</p>
                    <label className="input-label" style={{ margin: 0 }}>Agendar para:<input type="date" value={rouletteWatchDate} onChange={(e) => setRouletteWatchDate(e.target.value)} style={{ marginTop: '5px' }} /></label>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '10px' }}>
                  <button onClick={handleSaveDrawnMovie} className="btn-success" style={{ width: '100%' }}>Salvar nos Meus Filmes</button>
                  <button onClick={() => { setDrawnMovie(null); setCaseTrack([]); setCaseOffset(0); setFlippedCardIndex(null); }} className="btn-primary" style={{ width: '100%' }}>Girar Novamente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}