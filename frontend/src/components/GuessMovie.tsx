import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, ArrowUp, ArrowDown, Film } from 'lucide-react';

interface GuessMovieProps {
  token: string;
}

export default function GuessMovie({ token }: GuessMovieProps) {
    const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const todayStr = formatter.format(new Date());
    const storageKey = `guess_movie_state_${todayStr}`;
    const storageKeyPoster = `guess_poster_state_${todayStr}`;
    const storageKeySynopsis = `guess_synopsis_state_${todayStr}`;

    const [mode, setMode] = useState<'classic' | 'poster' | 'synopsis'>('classic');

    const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredMovies, setFilteredMovies] = useState<any[]>([]);
    
    // Classic Mode State
    const [guesses, setGuesses] = useState<any[]>(() => {
        const saved = localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : [];
    });

    // Poster Mode State
    const [posterGuesses, setPosterGuesses] = useState<any[]>(() => {
        const saved = localStorage.getItem(storageKeyPoster);
        return saved ? JSON.parse(saved) : [];
    });
    const [dailyPoster, setDailyPoster] = useState<string | null>(null);

    // Synopsis Mode State
    const [synopsisGuesses, setSynopsisGuesses] = useState<any[]>(() => {
        const saved = localStorage.getItem(storageKeySynopsis);
        return saved ? JSON.parse(saved) : [];
    });
    const [dailySynopsis, setDailySynopsis] = useState<string>('');
    const [dailyHints, setDailyHints] = useState<{rating: number | null, requestedBy: string | null} | null>(null);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(guesses));
    }, [guesses, storageKey]);

    useEffect(() => {
        localStorage.setItem(storageKeyPoster, JSON.stringify(posterGuesses));
    }, [posterGuesses, storageKeyPoster]);

    useEffect(() => {
        localStorage.setItem(storageKeySynopsis, JSON.stringify(synopsisGuesses));
    }, [synopsisGuesses, storageKeySynopsis]);

    useEffect(() => {
        api.get('/movies', { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               const watched = res.data.filter((m: any) => m.watched);
               setWatchedMovies(watched);
           })
           .catch(() => {
               toast.error('Erro ao carregar filmes assistidos');
           });
           
        // Fetch daily poster
        api.get('/game/poster', { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               setDailyPoster(res.data.poster);
           })
           .catch(() => console.error("Sem capa hoje"));

        // Fetch daily synopsis
        api.get('/game/synopsis', { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               setDailySynopsis(res.data.synopsis);
           })
           .catch(() => console.error("Sem sinopse hoje"));

        // Fetch daily hints
        api.get('/game/hints', { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               setDailyHints(res.data);
           })
           .catch(() => console.error("Sem dicas hoje"));
    }, [token]);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredMovies([]);
            return;
        }
        const normalizeText = (str: string) => {
            return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
        };

        const searchNormalized = normalizeText(searchTerm);
        
        let results = [];
        const filterFn = (m: any) => normalizeText(m.title).includes(searchNormalized);

        if (mode === 'classic') {
            results = watchedMovies.filter(m => filterFn(m) && !guesses.find(g => g.guess.id === m.id));
        } else if (mode === 'poster') {
            results = watchedMovies.filter(m => filterFn(m) && !posterGuesses.find(g => g.guess.id === m.id));
        } else {
            results = watchedMovies.filter(m => filterFn(m) && !synopsisGuesses.find(g => g.guess.id === m.id));
        }

        results.sort((a, b) => {
            const titleA = normalizeText(a.title);
            const titleB = normalizeText(b.title);
            const startsWithA = titleA.startsWith(searchNormalized);
            const startsWithB = titleB.startsWith(searchNormalized);

            if (startsWithA && !startsWithB) return -1;
            if (!startsWithA && startsWithB) return 1;
            return titleA.localeCompare(titleB);
        });
        
        setFilteredMovies(results.slice(0, 8));
    }, [searchTerm, watchedMovies, guesses, posterGuesses, synopsisGuesses, mode]);

    const handleMovieSelect = async (movie: any) => {
        setSearchTerm('');
        setFilteredMovies([]);

        if (mode === 'classic') {
            try {
                const response = await api.post('/game/guess', { movieId: movie.id }, { headers: { Authorization: `Bearer ${token}` } });
                setGuesses(prev => [response.data, ...prev]);
                if (response.data.isCorrect) toast.success('Parabéns! Você adivinhou o filme de hoje!');
            } catch (error: any) {
                toast.error(error.response?.data?.error || 'Erro ao enviar palpite');
            }
        } else if (mode === 'poster') {
            try {
                const response = await api.post('/game/guess-poster', { movieId: movie.id }, { headers: { Authorization: `Bearer ${token}` } });
                setPosterGuesses(prev => [response.data, ...prev]);
                if (response.data.isCorrect) toast.success('Parabéns! Você acertou a capa!');
            } catch (error: any) {
                toast.error(error.response?.data?.error || 'Erro ao enviar palpite');
            }
        } else {
            try {
                const response = await api.post('/game/guess-synopsis', { movieId: movie.id }, { headers: { Authorization: `Bearer ${token}` } });
                setSynopsisGuesses(prev => [response.data, ...prev]);
                if (response.data.isCorrect) toast.success('Parabéns! Você adivinhou pela sinopse!');
            } catch (error: any) {
                toast.error(error.response?.data?.error || 'Erro ao enviar palpite');
            }
        }
    };

    const renderBox = (data: { value: string | number, status: string } | undefined, delay: number) => {
        if (!data) return <div className="guess-box" style={{ background: 'var(--panel-bg)', borderColor: 'var(--input-border)' }}>?</div>;
        let bg = 'var(--panel-bg)';
        if (data.status === 'match') bg = 'var(--success)';
        else if (data.status === 'partial') bg = 'var(--warning)';
        else if (data.status === 'wrong') bg = 'var(--danger)';
        else if (data.status === 'higher' || data.status === 'lower') bg = 'var(--danger)';
        
        return (
            <div className="guess-box" style={{ background: bg, borderColor: bg, animationDelay: `${delay}s` }}>
                <span className="guess-value">{data.value}</span>
                {data.status === 'higher' && <ArrowUp size={16} className="arrow-icon" />}
                {data.status === 'lower' && <ArrowDown size={16} className="arrow-icon" />}
            </div>
        );
    };

    const isClassicWinner = guesses.length > 0 && guesses[0].isCorrect;
    const isPosterWinner = posterGuesses.length > 0 && posterGuesses[0].isCorrect;
    const isSynopsisWinner = synopsisGuesses.length > 0 && synopsisGuesses[0].isCorrect;
    
    let currentWinner = false;
    if (mode === 'classic') currentWinner = isClassicWinner;
    else if (mode === 'poster') currentWinner = isPosterWinner;
    else currentWinner = isSynopsisWinner;

    return (
        <div className="view-container guess-container">
            <style>
                {`
                .guess-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .mode-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 25px;
                    background: var(--panel-bg);
                    padding: 5px;
                    border-radius: 12px;
                    border: 1px solid var(--input-border);
                }
                .mode-tab {
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                    border: none;
                    background: transparent;
                    color: var(--text-color);
                    opacity: 0.6;
                }
                .mode-tab.active {
                    background: var(--primary);
                    opacity: 1;
                    color: #fff;
                }
                
                .search-wrapper {
                    position: sticky;
                    top: 10px;
                    width: 100%;
                    max-width: 700px;
                    margin-bottom: 20px;
                    z-index: 100;
                }
                .search-input {
                    width: 100%;
                    padding: 15px 20px 15px 45px;
                    font-size: 1.1rem;
                    border-radius: 12px;
                    border: 2px solid var(--input-border);
                    background: var(--bg-color);
                    color: var(--text-color);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    transition: all 0.3s ease;
                }
                .search-input:focus {
                    border-color: var(--primary);
                    outline: none;
                }
                .autocomplete-list {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    background: #1a1a24; /* Solid dark color so it doesn't bleed */
                    border: 1px solid var(--input-border);
                    border-radius: 12px;
                    list-style: none;
                    padding: 0;
                    margin: 8px 0 0 0;
                    max-height: 250px;
                    overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                    z-index: 200;
                }
                .autocomplete-item {
                    padding: 12px 20px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-bottom: 1px solid var(--input-border);
                    transition: background 0.2s;
                }
                .autocomplete-item:hover {
                    background: rgba(255,255,255,0.1);
                }
                .autocomplete-item:last-child {
                    border-bottom: none;
                }
                .guess-grid-header {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                    margin-bottom: 10px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--input-border);
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    color: #aaa;
                    text-align: center;
                }
                .guess-row {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                    margin-bottom: 10px;
                }
                @keyframes flipIn {
                    0% { transform: rotateX(-90deg); opacity: 0; }
                    100% { transform: rotateX(0); opacity: 1; }
                }
                .guess-box {
                    flex: 1;
                    min-width: 80px;
                    padding: 15px 5px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #fff;
                    font-weight: bold;
                    box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
                    animation: flipIn 0.5s ease forwards;
                    opacity: 0;
                    transform-origin: center;
                    border: 2px solid rgba(255,255,255,0.1);
                }
                .guess-title-box {
                    flex: 1.5;
                    background: var(--panel-bg);
                    min-width: 120px;
                    animation-delay: 0s !important;
                }
                .guess-value {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.95rem;
                    word-break: break-word;
                }
                .col-title { flex: 1.5; min-width: 120px; }
                .col-attr { flex: 1; min-width: 80px; }
                
                .poster-blur-container {
                    margin-bottom: 30px;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border: 2px solid var(--input-border);
                    width: 250px;
                    height: 375px;
                    position: relative;
                }
                .poster-blur-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: filter 1s ease;
                }
                `}
            </style>
            
            <div className="mode-tabs">
                <button className={`mode-tab ${mode === 'classic' ? 'active' : ''}`} onClick={() => { setMode('classic'); setSearchTerm(''); }}>Clássico</button>
                <button className={`mode-tab ${mode === 'poster' ? 'active' : ''}`} onClick={() => { setMode('poster'); setSearchTerm(''); }}>Capa Borrada</button>
                <button className={`mode-tab ${mode === 'synopsis' ? 'active' : ''}`} onClick={() => { setMode('synopsis'); setSearchTerm(''); }}>Sinopse</button>
            </div>

            <p style={{ marginBottom: '20px', color: '#aaa', textAlign: 'center' }}>
                {mode === 'classic' && "Adivinhe o filme misterioso pelas dicas."}
                {mode === 'poster' && "Adivinhe o filme misterioso pela capa! A cada erro, ela fica mais nítida."}
                {mode === 'synopsis' && "Adivinhe o filme misterioso pela sinopse censurada!"}
            </p>

            {/* Campo de Busca Fixo no Topo */}
            {!currentWinner && (
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} style={{ position: 'absolute', left: '15px', top: '15px', color: '#888' }} />
                    <input 
                        type="text" 
                        placeholder="Qual é o filme?" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && filteredMovies.length > 0 && (
                        <ul className="autocomplete-list">
                            {filteredMovies.map(m => (
                                <li key={m.id} className="autocomplete-item" onClick={() => handleMovieSelect(m)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 20px', gap: '5px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                                        <Film size={16} /> {m.title}
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: '#aaa', flexWrap: 'wrap' }}>
                                        <span><strong>Gênero:</strong> {m.genre || 'N/A'}</span>
                                        <span><strong>Nota:</strong> {m.streamerRating ? m.streamerRating.toFixed(1) : 'N/A'}</span>
                                        <span><strong>Pedido por:</strong> {m.requestedBy || 'Ninguém'}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {currentWinner && (
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: 'var(--success)' }}>Você acertou!</h3>
                </div>
            )}

            {/* Area da Capa Borrada (agora fica abaixo do search) */}
            {mode === 'poster' && dailyPoster && (
                <div className="poster-blur-container">
                    <img 
                        src={`https://image.tmdb.org/t/p/w500${dailyPoster}`} 
                        alt="Filme Misterioso" 
                        className="poster-blur-image"
                        style={{ filter: isPosterWinner ? 'blur(0px)' : `blur(${Math.max(0, 30 - (posterGuesses.length * 6))}px)` }}
                    />
                </div>
            )}

            {/* Area da Sinopse Censurada */}
            {mode === 'synopsis' && dailySynopsis && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', width: '100%', maxWidth: '700px' }}>
                    <div style={{ 
                        background: 'var(--panel-bg)', 
                        border: '1px solid var(--input-border)', 
                        borderRadius: '12px', 
                        padding: '25px', 
                        lineHeight: '1.8',
                        fontSize: '1.1rem',
                        color: '#eee',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        textAlign: 'justify'
                    }}>
                        {isSynopsisWinner && synopsisGuesses[0]?.fullSynopsis ? (
                            <span style={{ color: 'var(--primary)', transition: 'all 0.5s ease' }}>
                                {synopsisGuesses[0].fullSynopsis}
                            </span>
                        ) : (
                            dailySynopsis.split(/(\[██████\])/g).map((part, i) => {
                                if (part === '[██████]') {
                                    return <span key={i} style={{ 
                                        background: '#000', 
                                        color: 'transparent',
                                        fontWeight: 'bold',
                                        padding: '0 10px',
                                        borderRadius: '4px',
                                        border: '1px solid #333',
                                    }}>
                                        {part}
                                    </span>;
                                }
                                return <span key={i}>{part}</span>;
                            })
                        )}
                    </div>
                </div>
            )}

            {mode === 'classic' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                    {dailyHints && (
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
                            {guesses.length >= 4 && !guesses.some(g => g.guess.streamerRating?.status === 'match') && !currentWinner && (
                                <div style={{ background: 'var(--panel-bg)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--primary)', color: '#fff', fontSize: '0.9rem' }}>
                                    <strong>Dica (Nota):</strong> {dailyHints.rating ? dailyHints.rating.toFixed(1) : 'N/A'}
                                </div>
                            )}
                            {guesses.length >= 7 && !guesses.some(g => g.guess.requestedBy?.status === 'match') && !currentWinner && (
                                <div style={{ background: 'var(--panel-bg)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--primary)', color: '#fff', fontSize: '0.9rem' }}>
                                    <strong>Dica (Resgatado por):</strong> {dailyHints.requestedBy || 'Ninguém'}
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{ minWidth: '700px' }}>
                        <div className="guess-grid-header">
                            <div className="col-title">Filme</div>
                            <div className="col-attr">Gênero</div>
                            <div className="col-attr">Duração</div>
                            <div className="col-attr">Nota</div>
                            <div className="col-attr">Pedido por</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {guesses.length === 0 && (
                                <div className="guess-row">
                                    <div className="guess-box guess-title-box" style={{ background: 'transparent', border: '2px dashed var(--input-border)', opacity: 0.5, animation: 'none' }}></div>
                                    <div className="guess-box" style={{ background: 'transparent', border: '2px dashed var(--input-border)', opacity: 0.5, animation: 'none' }}></div>
                                    <div className="guess-box" style={{ background: 'transparent', border: '2px dashed var(--input-border)', opacity: 0.5, animation: 'none' }}></div>
                                    <div className="guess-box" style={{ background: 'transparent', border: '2px dashed var(--input-border)', opacity: 0.5, animation: 'none' }}></div>
                                    <div className="guess-box" style={{ background: 'transparent', border: '2px dashed var(--input-border)', opacity: 0.5, animation: 'none' }}></div>
                                </div>
                            )}
                            {guesses.map((g, index) => (
                                <div key={index} className="guess-row">
                                    <div className="guess-box guess-title-box">
                                        <span className="guess-value">{g.guess.title}</span>
                                    </div>
                                    {renderBox(g.guess.genre, 0.2)}
                                    {renderBox(g.guess.runtime, 0.4)}
                                    {renderBox(g.guess.streamerRating, 0.6)}
                                    {renderBox(g.guess.requestedBy, 0.8)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {mode === 'poster' && posterGuesses.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '700px' }}>
                    {posterGuesses.map((g, index) => (
                        <div key={index} style={{ padding: '15px', borderRadius: '8px', background: g.isCorrect ? 'var(--success)' : 'var(--danger)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'flipIn 0.5s ease forwards' }}>
                            {g.guess.title}
                        </div>
                    ))}
                </div>
            )}

            {mode === 'synopsis' && synopsisGuesses.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '700px' }}>
                    {synopsisGuesses.map((g, index) => (
                        <div key={index} style={{ padding: '15px', borderRadius: '8px', background: g.isCorrect ? 'var(--success)' : 'var(--danger)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'flipIn 0.5s ease forwards' }}>
                            {g.guess.title}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
