import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import Modal from './Modal';
import { io, Socket } from 'socket.io-client';

interface TwitchVotePanelProps {
  movieId: number;
  movieTitle: string;
  token: string;
  twitchChannel: string;
  isOpen: boolean;
  onClose: () => void;
  onRatingUpdated: (movieId: number, chatRating: number) => void;
}

export default function TwitchVotePanel({ movieId, movieTitle, token, twitchChannel, isOpen, onClose, onRatingUpdated }: TwitchVotePanelProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [liveVotes, setLiveVotes] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ average: number; totalVotes: number; votes: Record<string, number> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Injeta a animação de pulse no documento
  useEffect(() => {
    const styleId = 'twitch-vote-pulse-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsVoting(false);
      setResult(null);
      setElapsedSeconds(0);
      setVoteCount(0);
      setLiveVotes({});

      const checkStatus = async () => {
        try {
          const res = await api.get('/votes/status', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.active && res.data.movieId === movieId) {
            setIsVoting(true);
            setVoteCount(res.data.totalVotes || 0);
            if (res.data.startedAt) {
               const started = new Date(res.data.startedAt).getTime();
               startTimeRef.current = started;
               setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
            }
            if (res.data.durationMinutes) {
               setDurationMinutes(res.data.durationMinutes);
            }
            if (res.data.votes) {
               setLiveVotes(res.data.votes);
            }
           }
         } catch (error) {
            console.error('Error fetching vote status', error);
         }
      };
      checkStatus();
    }
  }, [isOpen, movieId, token]);

  useEffect(() => {
    let socket: Socket | null = null;
    if (isVoting) {
      socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3333', {
        auth: { token }
      });

      socket.on('voteUpdate', (data) => {
        setVoteCount(data.totalVotes);
        if (data.votes) {
          setLiveVotes(data.votes);
        }
      });

      socket.on('voteClosed', (res) => {
        setIsVoting(false);
        
        if (res.totalVotes === 0) {
          toast('Votação cancelada: nenhum voto recebido.', { icon: 'ℹ️' });
          onClose();
          return;
        }

        setResult({
          average: res.average,
          totalVotes: res.totalVotes,
          votes: res.votes
        });
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#9146ff', '#10b981', '#fbbf24']
        });

        onRatingUpdated(movieId, res.average);
        toast.success('Votação encerrada automaticamente pelo servidor!');
      });

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        } else {
          setElapsedSeconds(prev => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (socket) socket.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVoting, movieId, token, onRatingUpdated]);

  const handleStartVote = async () => {
    if (!twitchChannel) {
      toast.error('Configure seu canal da Twitch nas Configurações!');
      return;
    }
    try {
      await api.post('/votes/start', { movieId, twitchChannel, durationMinutes }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsVoting(true);
      setElapsedSeconds(0);
      setVoteCount(0);
      setLiveVotes({});
      setResult(null);
      startTimeRef.current = Date.now();
      toast.success('Votação iniciada no chat!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao iniciar votação');
    }
  };

  const handleStopVote = async () => {
    try {
      const res = await api.post('/votes/stop', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsVoting(false);

      if (res.data.totalVotes === 0) {
        toast('Votação cancelada: nenhum voto recebido.', { icon: 'ℹ️' });
        onClose();
        return;
      }

      setResult({
        average: res.data.average,
        totalVotes: res.data.totalVotes,
        votes: res.data.votes
      });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#9146ff', '#10b981', '#fbbf24']
      });

      onRatingUpdated(movieId, res.data.average);
      toast.success('Votação encerrada!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao encerrar votação');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="450px" closeOnOutsideClick={false}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <h2 style={{ color: '#9146ff', marginTop: 0, marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          🗳️ Votação Twitch
        </h2>
        <p style={{ margin: '0 0 20px 0', color: '#aaa', fontSize: '0.9rem' }}>{movieTitle}</p>

        {!isVoting && !result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!twitchChannel ? (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p style={{ color: '#aaa', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Você precisa vincular seu canal da Twitch nas <strong style={{ color: 'var(--primary)' }}>Configurações</strong> antes de usar a votação.</p>
                <button
                  onClick={onClose}
                  style={{
                    background: '#333', color: 'white', border: 'none', padding: '10px',
                    borderRadius: '8px', cursor: 'pointer', width: '100%'
                  }}
                >
                  Entendi
                </button>
              </div>
            ) : (
              <>
                <div style={{ padding: '12px', background: 'rgba(145, 70, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(145, 70, 255, 0.2)' }}>
                  <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Canal: </span>
                  <strong style={{ color: '#9146ff' }}>{twitchChannel}</strong>
                </div>
                <p style={{ margin: 0, color: '#888', fontSize: '0.8rem', lineHeight: '1.4' }}>O chat poderá votar digitando <strong style={{ color: '#ccc' }}>!nota X (valores de 0 a 10).</strong></p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: '#ccc' }}>Duração:</label>
                  <select 
                    value={durationMinutes} 
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    style={{ background: '#333', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px' }}
                  >
                    <option value={1}>1 Minuto</option>
                    <option value={2}>2 Minutos</option>
                    <option value={3}>3 Minutos</option>
                    <option value={5}>5 Minutos</option>
                  </select>
                </div>
                <button
                  onClick={handleStartVote}
                  style={{
                    background: 'linear-gradient(135deg, #9146ff, #6441a5)',
                    color: 'white', border: 'none', padding: '12px', borderRadius: '8px',
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', width: '100%'
                  }}
                >
                  Iniciar Votação
                </button>
              </>
            )}
          </div>
        )}

        {isVoting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}></div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444' }}>VOTAÇÃO AO VIVO</span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '5px' }}>
              <div style={{ 
                height: '100%', 
                background: 'linear-gradient(90deg, #ef4444, #9146ff)', 
                width: `${Math.max(0, ((durationMinutes * 60) - elapsedSeconds) / (durationMinutes * 60) * 100)}%`,
                transition: 'width 1s linear'
              }}></div>
            </div>

            <div style={{ width: '100%', textAlign: 'left', marginTop: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Votos em tempo real:</span>
                <span style={{ fontSize: '0.9rem', color: '#9146ff', fontWeight: 'bold' }}>{voteCount} total</span>
              </div>
              <div style={{
                height: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {Object.keys(liveVotes || {}).length > 0 ? (
                  Object.entries(liveVotes).reverse().map(([user, nota]) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#aaa' }}>{user}</span>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{nota}</strong>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#666', textAlign: 'center', padding: '20px 0', fontSize: '0.9rem' }}>Nenhum voto ainda...<br/>Digite !nota X no chat!</div>
                )}
              </div>
            </div>

            <button
              onClick={handleStopVote}
              className="btn-danger"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>Encerrar Manualmente</span>
              <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(Math.max(0, (durationMinutes * 60) - elapsedSeconds))}</span>
            </button>
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
            <div style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: 'bold' }}>Resultado Final</div>
            
            <div style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '20px', width: '100%', boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: '1' }}>
                {result.average.toFixed(2)}
              </div>
              <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '5px' }}>
                Nota mais votada (de {result.totalVotes} votos)
              </div>
            </div>

            <div style={{ width: '100%', textAlign: 'left', marginTop: '10px' }}>
              <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '8px' }}>Votos Individuais:</div>
              <div style={{
                maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {Object.keys(result.votes || {}).length > 0 ? (
                  Object.entries(result.votes).map(([user, nota]) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#aaa' }}>{user}</span>
                      <strong style={{ color: '#fff' }}>{nota}</strong>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#666', textAlign: 'center', padding: '10px 0' }}>Nenhum voto recebido.</div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: '#333', color: 'white', border: 'none', padding: '10px',
                borderRadius: '8px', cursor: 'pointer', width: '100%', marginTop: '10px'
              }}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
