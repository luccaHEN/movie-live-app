import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Modal from './Modal';

export const ALL_BADGES = [
  { icon: '🥉', title: 'Primeiro Passo', desc: 'Resgatou o seu primeiro filme', condition: (s: any) => s.totalRescues >= 1, progress: (s: any) => [Math.min(s.totalRescues, 1), 1] },
  { icon: '🏅', title: 'Cinéfilo Fiel', desc: 'Resgatou 10 ou mais filmes', condition: (s: any) => s.totalRescues >= 10, progress: (s: any) => [Math.min(s.totalRescues, 10), 10] },
  { icon: '👑', title: 'VIP da Live', desc: 'Resgatou incríveis 25 filmes', condition: (s: any) => s.totalRescues >= 25, progress: (s: any) => [Math.min(s.totalRescues, 25), 25] },
  { icon: '👻', title: 'Tríplice Coroa', desc: 'Acertou 3 filmes com Nota 10', condition: (s: any) => s.masterpieceCount >= 3, progress: (s: any) => [Math.min(s.masterpieceCount, 3), 3] },
  { icon: '🤣', title: 'Rindo à Toa', desc: 'Resgatou 3+ filmes de Comédia', condition: (s: any) => s.comedyCount >= 3, progress: (s: any) => [Math.min(s.comedyCount, 3), 3] },
  { icon: '💥', title: 'Adrenalina Pura', desc: 'Resgatou 3+ filmes de Ação', condition: (s: any) => s.actionCount >= 3, progress: (s: any) => [Math.min(s.actionCount, 3), 3] },
  { icon: '👽', title: 'Viajante Espacial', desc: 'Resgatou 3+ filmes de Ficção Científica', condition: (s: any) => s.scifiCount >= 3, progress: (s: any) => [Math.min(s.scifiCount, 3), 3] },
  { icon: '🕵️', title: 'Detetive', desc: 'Resgatou 3+ filmes de Suspense/Mistério', condition: (s: any) => s.mysteryCount >= 3, progress: (s: any) => [Math.min(s.mysteryCount, 3), 3] },
  { icon: '🎨', title: 'Alma de Criança', desc: 'Resgatou 3+ filmes de Animação', condition: (s: any) => s.animationCount >= 3, progress: (s: any) => [Math.min(s.animationCount, 3), 3] },
  { icon: '🐉', title: 'Aventureiro Nato', desc: 'Resgatou 3+ filmes de Aventura', condition: (s: any) => s.adventureCount >= 3, progress: (s: any) => [Math.min(s.adventureCount, 3), 3] },
  { icon: '💖', title: 'Coração Apaixonado', desc: 'Resgatou 2+ filmes de Romance', condition: (s: any) => s.romanceCount >= 2, progress: (s: any) => [Math.min(s.romanceCount, 2), 2] },
  { icon: '🧙‍♂️', title: 'Mundo da Fantasia', desc: 'Resgatou 3+ filmes de Fantasia', condition: (s: any) => s.fantasyCount >= 3, progress: (s: any) => [Math.min(s.fantasyCount, 3), 3] },
  { icon: '⚔️', title: 'Historiador', desc: 'Resgatou 2+ filmes Históricos ou Guerra', condition: (s: any) => s.historyCount >= 2, progress: (s: any) => [Math.min(s.historyCount, 2), 2] },
  { icon: '😭', title: 'Mar de Lágrimas', desc: 'Resgatou 3+ filmes de Drama', condition: (s: any) => s.dramaCount >= 3, progress: (s: any) => [Math.min(s.dramaCount, 3), 3] },
  { icon: '🚔', title: 'Casca Grossa', desc: 'Resgatou 2+ filmes de Crime ou Policial', condition: (s: any) => s.crimeCount >= 2, progress: (s: any) => [Math.min(s.crimeCount, 2), 2] },
  { icon: '👪', title: 'Sessão da Tarde', desc: 'Resgatou 3+ filmes para Família', condition: (s: any) => s.familyCount >= 3, progress: (s: any) => [Math.min(s.familyCount, 3), 3] },
  { icon: '🎸', title: 'Estrela do Rock', desc: 'Resgatou 2+ filmes Musicais', condition: (s: any) => s.musicCount >= 2, progress: (s: any) => [Math.min(s.musicCount, 2), 2] },
  { icon: '🗑️', title: 'Gosto Duvidoso', desc: 'Mandou 2+ filmes pro Hall do Lixo', condition: (s: any) => s.trashCount >= 2, progress: (s: any) => [Math.min(s.trashCount, 2), 2] },
  { icon: '👼', title: 'Anjo da Guarda', desc: 'Acertou em cheio! Um filme seu recebeu Nota 10', condition: (s: any) => s.hasMasterpiece, progress: (s: any) => [s.hasMasterpiece ? 1 : 0, 1] },
  { icon: '💔', title: 'Decepção', desc: 'Errou feio! Um filme seu recebeu nota 3 ou menos', condition: (s: any) => s.hasDisaster, progress: (s: any) => [s.hasDisaster ? 1 : 0, 1] },
];

export default function PublicList() {
  // Assumindo que a URL seja algo como /lista-publica/:username
  const { username } = useParams();
  
  // Função para remover acentos
  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const [movies, setMovies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [selectedRescuer, setSelectedRescuer] = useState<string | null>(null);
  const [view, setView] = useState<'CALENDAR' | 'WATCHED' | 'RATINGS' | 'BADGES'>('CALENDAR');
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none');
  const [selectedDay, setSelectedDay] = useState<{ date: string, movies: any[] } | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    // Abre o mês mais recente automaticamente se nenhum estiver aberto
    if (movies.length > 0 && Object.keys(expandedMonths).length === 0) {
      const watched = movies.filter(m => m.watched);
      if (watched.length > 0) {
        const latest = watched.sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime())[0];
        const key = latest.watchDate ? String(latest.watchDate).substring(0, 7) : 'none';
        setExpandedMonths({ [key]: true });
      }
    }
  }, [movies, expandedMonths]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const lowerQuery = removeAccents(searchQuery.toLowerCase());
      
      // Encontra todos os filmes que correspondem à pesquisa
      const matches = movies.filter(m => 
        m.watchDate && 
        (removeAccents(m.title.toLowerCase()).includes(lowerQuery) || (m.requestedBy && removeAccents(m.requestedBy.toLowerCase()).includes(lowerQuery)))
      );

      // Pega o filme mais antigo (primeiro em ordem cronológica)
      const firstMatch = matches.sort((a, b) => new Date(a.watchDate).getTime() - new Date(b.watchDate).getTime())[0];

      if (firstMatch && firstMatch.watchDate) {
        const [year, month] = String(firstMatch.watchDate).split('-');
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        
        setCalendarMonth(prev => {
          // Só atualiza se o mês for diferente para evitar re-renders desnecessários
          if (prev.getFullYear() === targetDate.getFullYear() && prev.getMonth() === targetDate.getMonth()) {
            return prev;
          }
          setSlideDirection(targetDate > prev ? 'left' : 'right');
          return targetDate;
        });
      }
    } else if (searchQuery.length === 0) {
      // Quando apaga a busca, volta para o mês atual
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setCalendarMonth(prev => {
        if (prev.getFullYear() === targetDate.getFullYear() && prev.getMonth() === targetDate.getMonth()) {
          return prev;
        }
        setSlideDirection(targetDate > prev ? 'left' : 'right');
        return targetDate;
      });
    }
  }, [searchQuery, movies]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Carregando lista... 🍿</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--danger)' }}>{error}</div>;
  }

  const lowerCaseQuery = removeAccents(searchQuery.toLowerCase());

  const watchedMovies = movies
    .filter(m => m.watched)
    .filter(m => removeAccents(m.title.toLowerCase()).includes(lowerCaseQuery) || (m.requestedBy && removeAccents(m.requestedBy.toLowerCase()).includes(lowerCaseQuery)))
    .sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime());

  // Agrupa os filmes assistidos por mês (ex: "2024-05")
  const groupedWatchedMovies: Record<string, any[]> = {};
  watchedMovies.forEach(m => {
    const key = m.watchDate ? String(m.watchDate).substring(0, 7) : 'none';
    if (!groupedWatchedMovies[key]) groupedWatchedMovies[key] = [];
    groupedWatchedMovies[key].push(m);
  });

  // Ordena os meses do mais recente para o mais antigo
  const sortedMonthKeys = Object.keys(groupedWatchedMovies).sort((a, b) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    return b.localeCompare(a);
  });

  const getMonthLabel = (key: string) => {
    if (key === 'none') return 'Sem data';
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  // Lógica para agrupar e calcular a média de notas dos resgatadores (mínimo de 3 filmes)
  const rescuerStats: Record<string, { totalRescues: number, ratedCount: number, ratingSum: number, masterpieceCount: number, trashCount: number, comedyCount: number, actionCount: number, scifiCount: number, mysteryCount: number, animationCount: number, adventureCount: number, romanceCount: number, fantasyCount: number, historyCount: number, dramaCount: number, crimeCount: number, familyCount: number, musicCount: number, hasMasterpiece: boolean, hasDisaster: boolean }> = {};
  movies.forEach(m => {
    const name = m.requestedBy?.trim();
    if (!name || name.toLowerCase() === 'ninguém') return;

    if (!rescuerStats[name]) {
      rescuerStats[name] = { 
        totalRescues: 0, ratedCount: 0, ratingSum: 0, 
        masterpieceCount: 0, trashCount: 0, comedyCount: 0, actionCount: 0, scifiCount: 0, mysteryCount: 0, animationCount: 0,
        adventureCount: 0, romanceCount: 0, fantasyCount: 0, historyCount: 0, dramaCount: 0, crimeCount: 0, familyCount: 0, musicCount: 0,
        hasMasterpiece: false, hasDisaster: false
      };
    }
    const s = rescuerStats[name];
    s.totalRescues += 1;
    if (m.watched && m.streamerRating != null) {
      s.ratedCount += 1;
      s.ratingSum += m.streamerRating;
      if (m.streamerRating === 10) {
        s.hasMasterpiece = true;
        s.masterpieceCount += 1;
      }
      if (m.streamerRating <= 3) {
        s.trashCount += 1;
        s.hasDisaster = true;
      }
    }
    if (m.genre) {
      const g = m.genre.toLowerCase();
      if (g.includes('comédia') || g.includes('comedy')) s.comedyCount += 1;
      if (g.includes('ação') || g.includes('action')) s.actionCount += 1;
      if (g.includes('ficção') || g.includes('sci-fi')) s.scifiCount += 1;
      if (g.includes('mistério') || g.includes('suspense') || g.includes('thriller')) s.mysteryCount += 1;
      if (g.includes('animação') || g.includes('animation')) s.animationCount += 1;
      if (g.includes('aventura') || g.includes('adventure')) s.adventureCount += 1;
      if (g.includes('romance')) s.romanceCount += 1;
      if (g.includes('fantasia') || g.includes('fantasy')) s.fantasyCount += 1;
      if (g.includes('história') || g.includes('history') || g.includes('guerra') || g.includes('war')) s.historyCount += 1;
      if (g.includes('drama')) s.dramaCount += 1;
      if (g.includes('crime') || g.includes('policial')) s.crimeCount += 1;
      if (g.includes('família') || g.includes('family')) s.familyCount += 1;
      if (g.includes('música') || g.includes('musical')) s.musicCount += 1;
    }
  });

  const topRescuers = Object.entries(rescuerStats)
    .filter(([name, _stats]) => name.toLowerCase() !== 'chat' && name.toLowerCase() !== 'sumas')
    .map(([name, stats]) => ({
      name,
      totalRescues: stats.totalRescues,
      avgRating: stats.ratedCount > 0 ? (stats.ratingSum / stats.ratedCount).toFixed(1) : 'N/A',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredRescuers = topRescuers.filter(r => removeAccents(r.name.toLowerCase()).includes(lowerCaseQuery));

  // Filtra e ordena os filmes específicos do usuário clicado
  const rescuerMovies = selectedRescuer
    ? movies.filter(m => m.requestedBy?.trim() === selectedRescuer).sort((a, b) => new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime())
    : [];

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
      <style>
        {`
          :root {
            --primary-rgb: 245, 158, 11;
            --success-rgb: 16, 185, 129;
          }
          .public-card {
            background-color: var(--card-bg);
            border: 1px solid var(--input-border);
            border-radius: 12px;
            padding: 25px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          .accordion-item { margin-bottom: 10px; }
          .accordion-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; background-color: var(--card-bg); padding: 15px 20px; border-radius: 8px; border: 1px solid var(--input-border); transition: all 0.2s ease-in-out; }
          .accordion-header:hover { background-color: rgba(var(--primary-rgb), 0.1); border-color: var(--primary); transform: translateY(-2px); }
          .accordion-header.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; background-color: rgba(var(--success-rgb), 0.08); border-color: var(--success); }
          .accordion-content { list-style: none; padding: 0px 20px; margin: 0; background-color: var(--bg-color); border: 1px solid var(--input-border); border-top: none; border-radius: 0 0 8px 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.5s ease-in-out, opacity 0.3s ease-out, padding 0.5s ease-in-out; }
          .accordion-content.expanded { max-height: 2000px; opacity: 1; padding-top: 20px; padding-bottom: 20px; }
          .watched-movie-card { display: flex; align-items: center; gap: 15px; padding: 12px; background-color: var(--card-bg); border-radius: 8px; border: 1px solid var(--input-border); transition: transform 0.2s, box-shadow 0.2s; min-width: 0; }
          .watched-movie-card:hover { transform: scale(1.03); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
          .rating-card { background-color: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--input-border); text-align: center; cursor: pointer; transition: all 0.2s ease-in-out; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          .rating-card:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.15); border-color: var(--primary); }
          
          .badge-card:hover { transform: translateY(-5px) scale(1.02) !important; box-shadow: 0 8px 25px rgba(245, 158, 11, 0.2) !important; border-color: var(--primary) !important; }
          
          .profile-stat-card { transition: all 0.3s ease; }
          .profile-stat-card:hover { transform: translateY(-5px) scale(1.05); box-shadow: 0 8px 25px rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.2) !important; }
          
          .profile-badge { position: relative; transition: all 0.3s ease; cursor: default; }
          .profile-badge:hover { transform: scale(1.05) rotate(2deg); border-color: var(--primary) !important; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2); }
          .profile-badge .tooltip-text { visibility: hidden; opacity: 0; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background-color: #111; color: #fff; text-align: center; padding: 8px 12px; border-radius: 8px; z-index: 100; font-size: 0.9rem; font-weight: normal; white-space: nowrap; transition: opacity 0.2s, bottom 0.2s; pointer-events: none; border: 1px solid var(--primary); box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
          .profile-badge:hover .tooltip-text { visibility: visible; opacity: 1; bottom: 120%; }
          
          .badges-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; }
          @media (max-width: 1200px) { .badges-grid { grid-template-columns: repeat(4, 1fr); } }
          @media (max-width: 900px) { .badges-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (max-width: 600px) { .badges-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 400px) { .badges-grid { grid-template-columns: 1fr; } }
          
          .profile-movie-card { transition: transform 0.2s, box-shadow 0.2s; }
          .profile-movie-card:hover { transform: scale(1.02); box-shadow: 0 5px 15px rgba(0,0,0,0.3); border-color: var(--primary) !important; }

          .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 5px; flex: 1; min-height: 0; }
          .calendar-header { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; text-align: center; font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--input-border); color: #aaa; font-size: 0.9rem; }
          .calendar-cell { background-color: var(--bg-color); border: 1px solid var(--input-border); border-radius: 8px; padding: 4px; display: flex; flex-direction: column; transition: all 0.2s ease-in-out; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
          .calendar-cell:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); border-color: var(--primary); }
          .calendar-cell.empty { background-color: transparent; border: 1px solid #222; }
          .calendar-cell.today { background-color: rgba(245, 158, 11, 0.05); border: 2px solid var(--primary); }
          .calendar-day-number { font-size: 0.85rem; color: #888; font-weight: bold; margin-bottom: 5px; align-self: flex-end; }
          .calendar-cell.today .calendar-day-number { color: var(--primary); font-weight: bold; }
          .calendar-movie-list { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
          .calendar-movie-list::-webkit-scrollbar { width: 4px; }
          .calendar-movie-list::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
          .calendar-movie { font-size: 0.8rem; padding: 5px 8px; border-radius: 4px; text-align: left; line-height: 1.3; overflow: hidden; cursor: pointer; min-width: 0; }
          .calendar-movie:hover { filter: brightness(1.2); }
          .calendar-movie.upcoming { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border-left: 3px solid #f59e0b; }
          .calendar-movie.watched { background-color: rgba(16, 185, 129, 0.1); color: #10b981; border-left: 3px solid #10b981; text-decoration: line-through; opacity: 0.8; }
          .calendar-movie strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          
          @keyframes slide-in-from-right { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slide-in-from-left { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slide-in-fade { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 0px var(--primary); } 50% { box-shadow: 0 0 15px var(--primary); transform: scale(1.03); } 100% { box-shadow: 0 0 0px var(--primary); } }
          
          .slide-left { animation: slide-in-from-right 0.35s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
          .slide-right { animation: slide-in-from-left 0.35s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
          .slide-fade { animation: slide-in-fade 0.35s ease-out forwards; }
          
          .calendar-movie.highlight { animation: pulse-glow 1.5s infinite ease-in-out; border-left-color: var(--primary); z-index: 2; position: relative; }

          @media (max-width: 768px) {
            .calendar-grid { gap: 4px; }
            .calendar-header { font-size: 0.8rem; margin-bottom: 10px; }
            .calendar-cell { min-height: 100px; padding: 5px; }
            .calendar-movie { font-size: 0.7rem; padding: 4px 6px; }
          }
        `}
      </style>

      {/* Cabeçalho Fixo (Título e Filtros no mesmo nível) */}
      <header className="public-card" style={{ zIndex: 10, flexShrink: 0, margin: '20px auto', width: 'calc(100% - 40px)', maxWidth: '1400px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '15px 20px', boxSizing: 'border-box' }}>
        <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>
          Lista de Filmes - {username} 🎬
        </h1>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className={view === 'CALENDAR' && !selectedRescuer ? 'btn-primary' : 'btn-secondary'} onClick={() => { setView('CALENDAR'); setSelectedRescuer(null); }} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>📅 Calendário</button>
            <button className={view === 'WATCHED' && !selectedRescuer ? 'btn-primary' : 'btn-secondary'} onClick={() => { setView('WATCHED'); setSelectedRescuer(null); }} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>✅ Já Assistidos</button>
            <button className={view === 'RATINGS' && !selectedRescuer ? 'btn-primary' : 'btn-secondary'} onClick={() => { setView('RATINGS'); setSelectedRescuer(null); }} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>🏆 Viewers</button>
            <button className={view === 'BADGES' && !selectedRescuer ? 'btn-primary' : 'btn-secondary'} onClick={() => { setView('BADGES'); setSelectedRescuer(null); }} style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '0.9rem' }}>🎖️ Conquistas</button>
          </div>
          
          <input
            type="text"
            placeholder="🔍 Buscar filme ou nick..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: '1 1 200px', maxWidth: '300px', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-color)', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem' }}
          />
        </div>
      </header>

      {/* Todo conteúdo rolável centralizado no Main */}
      <main style={{ flex: 1, overflowY: 'auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>

        {selectedRescuer ? (
          (() => {
            let favoriteGenre = 'Nenhum';
            let avgRating = 'S/N';
            const badges: any[] = [];
            const s = { 
              totalRescues: rescuerMovies.length,
              masterpieceCount: 0, trashCount: 0, comedyCount: 0, actionCount: 0, scifiCount: 0, mysteryCount: 0, animationCount: 0,
              adventureCount: 0, romanceCount: 0, fantasyCount: 0, historyCount: 0, dramaCount: 0, crimeCount: 0, familyCount: 0, musicCount: 0,
              hasMasterpiece: false, hasDisaster: false
            };

            if (rescuerMovies.length > 0) {
              const genreCounts: Record<string, number> = {};
              let ratingSum = 0;
              let ratedCount = 0;

              rescuerMovies.forEach(m => {
                if (m.genre) {
                  const genres = m.genre.split(',').map((g: string) => g.trim());
                  genres.forEach((g: string) => {
                    if (g) {
                      genreCounts[g] = (genreCounts[g] || 0) + 1;
                      const gl = g.toLowerCase();
                      if (gl.includes('comédia') || gl.includes('comedy')) s.comedyCount++;
                      if (gl.includes('ação') || gl.includes('action')) s.actionCount++;
                      if (gl.includes('ficção') || gl.includes('sci-fi')) s.scifiCount++;
                      if (gl.includes('mistério') || gl.includes('suspense') || gl.includes('thriller')) s.mysteryCount++;
                      if (gl.includes('animação') || gl.includes('animation')) s.animationCount++;
                      if (gl.includes('aventura') || gl.includes('adventure')) s.adventureCount++;
                      if (gl.includes('romance')) s.romanceCount++;
                      if (gl.includes('fantasia') || gl.includes('fantasy')) s.fantasyCount++;
                      if (gl.includes('história') || gl.includes('history') || gl.includes('guerra') || gl.includes('war')) s.historyCount++;
                      if (gl.includes('drama')) s.dramaCount++;
                      if (gl.includes('crime') || gl.includes('policial')) s.crimeCount++;
                      if (gl.includes('família') || gl.includes('family')) s.familyCount++;
                      if (gl.includes('música') || gl.includes('musical')) s.musicCount++;
                    }
                  });
                }
                if (m.watched && m.streamerRating != null) {
                  ratingSum += m.streamerRating;
                  ratedCount++;
                  if (m.streamerRating === 10) {
                    s.hasMasterpiece = true;
                    s.masterpieceCount++;
                  }
                  if (m.streamerRating <= 3) {
                    s.hasDisaster = true;
                    s.trashCount++;
                  }
                }
              });

              if (Object.keys(genreCounts).length > 0) {
                favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0][0];
              }

              const calculatedAvg = ratedCount > 0 ? (ratingSum / ratedCount) : null;
              if (calculatedAvg !== null) { avgRating = calculatedAvg.toFixed(1); }

              ALL_BADGES.forEach(badge => {
                if (badge.condition(s)) badges.push(badge);
              });
            }

              const displayedRescuerMovies = rescuerMovies.filter(m => 
                searchQuery.trim() === '' || 
                removeAccents(m.title.toLowerCase()).includes(lowerCaseQuery)
              );

            return (
              <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
                <button onClick={() => setSelectedRescuer(null)} className="btn-secondary" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px' }}>
                  <ArrowLeft size={18} /> Voltar para listas
                </button>
                <div className="public-card" style={{ padding: '30px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                    <h2 style={{ margin: '0 0 15px 0', color: 'var(--primary)', fontSize: '2.2rem' }}>Perfil de {selectedRescuer}</h2>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '30px' }}>
                      <div className="profile-stat-card" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 25px', borderRadius: '12px', minWidth: '120px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{rescuerMovies.length}</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Resgates</div>
                      </div>
                      <div className="profile-stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px 25px', borderRadius: '12px', minWidth: '120px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{avgRating}</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Média de Nota</div>
                      </div>
                      <div className="profile-stat-card" style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '15px 25px', borderRadius: '12px', minWidth: '120px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#8b5cf6', marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px', margin: '8px auto 0 auto' }}>{favoriteGenre}</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>Gênero Favorito</div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '2px' }}>Progresso das Conquistas</h3>
                        <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>{badges.length} / {ALL_BADGES.length} ({Math.round((badges.length / ALL_BADGES.length) * 100)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
                        <div style={{ width: `${(badges.length / ALL_BADGES.length) * 100}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 1s ease-out' }}></div>
                      </div>
                        <div className="badges-grid">
                          {ALL_BADGES.map((b: any) => {
                            const isUnlocked = badges.some(unlockedBadge => unlockedBadge.title === b.title);
                            const [current, total] = b.progress ? b.progress(s) : [0, 1];
                            const tooltipContent = isUnlocked ? b.desc : `Bloqueado: ${b.desc} (${current}/${total})`;
                            return (
                              <div key={b.title} className="profile-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: isUnlocked ? 'var(--card-bg)' : 'rgba(255,255,255,0.05)', border: isUnlocked ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.15)', padding: '12px', borderRadius: '30px', opacity: isUnlocked ? 1 : 0.7 }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isUnlocked ? '#fff' : '#aaa', textAlign: 'center' }}>{b.title}</span>
                                <div className="tooltip-text">{tooltipContent}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '20px', borderBottom: '1px solid var(--input-border)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>🎬 Histórico de Filmes</h3>
                  {displayedRescuerMovies.length === 0 ? <p style={{ textAlign: 'center', color: '#666' }}>Nenhum filme encontrado na busca.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                      {displayedRescuerMovies.map(movie => (
                        <li key={movie.id} className="profile-movie-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: 'var(--bg-color)', borderRadius: '10px', border: '1px solid var(--input-border)' }}>
                          <div>{movie.poster ? <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: '6px', opacity: movie.watched ? 0.6 : 1 }} /> : <div style={{ width: '50px', height: '75px', backgroundColor: '#2a2a35', borderRadius: '6px' }} />}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: '1.1rem', display: 'block', color: movie.watched ? '#999' : '#fff', textDecoration: movie.watched ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movie.title}</strong>
                            <div style={{ fontSize: '0.85rem', color: '#777', marginTop: '4px' }}>{movie.watched ? (movie.watchDate ? `Assistido em ${new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Assistido') : (movie.watchDate ? `Fila: ${new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Sem data')}</div>
                          </div>
                          <div style={{ color: movie.watched ? '#f59e0b' : '#10b981', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${movie.watched ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}` }}>
                            {movie.watched ? (movie.streamerRating != null ? `⭐ ${movie.streamerRating.toFixed(1)}` : 'S/N') : 'Agendado'}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <>
            {view === 'CALENDAR' && (
            <div className="public-card" style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => { setSlideDirection('right'); setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); }} className="btn-secondary" style={{ width: 'auto', margin: 0, padding: '8px 15px' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={16} /> Anterior</span></button>
                <h2 style={{ textTransform: 'capitalize', margin: 0, color: 'var(--primary)', textAlign: 'center', flex: 1 }}>
                  {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => { setSlideDirection('left'); setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); }} className="btn-secondary" style={{ width: 'auto', margin: 0, padding: '8px 15px' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Próximo <ArrowRight size={16} /></span></button>
              </div>
              <div className="calendar-header">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div key={calendarMonth.getTime()} className={`calendar-grid ${slideDirection === 'left' ? 'slide-left' : slideDirection === 'right' ? 'slide-right' : 'slide-fade'}`} style={{ flex: 1, minHeight: 0 }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="calendar-cell empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === todayDate && month === todayMonth && year === todayYear;
                  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayMovies = movies.filter(m => m.watchDate && String(m.watchDate).startsWith(dateString) && (removeAccents(m.title.toLowerCase()).includes(lowerCaseQuery) || (m.requestedBy && removeAccents(m.requestedBy.toLowerCase()).includes(lowerCaseQuery))));

                  return (
                    <div 
                      key={day} 
                      className={`calendar-cell ${isToday ? 'today' : ''}`}
                      style={{ cursor: dayMovies.length > 0 ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (dayMovies.length > 0) {
                          setSelectedDay({
                            date: new Date(year, month, day).toLocaleDateString('pt-BR'),
                            movies: dayMovies
                          });
                        }
                      }}
                    >
                      <span className="calendar-day-number">{day}</span>
                      <div className="calendar-movie-list">
                        {dayMovies.map(m => (
                          <div 
                            key={m.id} 
                            className={`calendar-movie ${m.watched ? 'watched' : 'upcoming'} ${searchQuery.trim().length > 0 ? 'highlight' : ''}`} 
                            title={`${m.title}${m.requestedBy ? ` - ${m.requestedBy}` : ''}`}
                          >
                            <strong>{m.title}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'RATINGS' && (
            <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
              {filteredRescuers.length === 0 ? <p style={{ textAlign: 'center' }}>Nenhum resgatador encontrado.</p> : (
                <h2 style={{ color: '#8b5cf6', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🏆 Viewers
                </h2>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '20px', alignContent: 'start' }}>
                  {filteredRescuers.map(rescuer => (
                    <div 
                      key={rescuer.name} 
                      onClick={() => setSelectedRescuer(rescuer.name)}
                      className="rating-card"
                      title={`Ver filmes resgatados por ${rescuer.name}`}
                    >
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rescuer.name}</div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {view === 'WATCHED' && (
            <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
              <h2 style={{ color: '#10b981', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                Já Assistidos ✅
              </h2>
              {watchedMovies.length === 0 ? <p>Nenhum filme assistido ainda.</p> : (
                <div>
                  {sortedMonthKeys.map((monthKey) => {
                    const isExpanded = expandedMonths[monthKey];
                    return (
                    <div key={monthKey} className="accordion-item">
                      <div 
                        onClick={() => toggleMonth(monthKey)}
                        className={`accordion-header ${isExpanded ? 'expanded' : ''}`}
                      >
                        <h3 style={{ color: isExpanded ? 'var(--success)' : 'var(--primary)', margin: 0, fontSize: '1.2rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {getMonthLabel(monthKey)}
                          <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 'normal' }}>
                            ({groupedWatchedMovies[monthKey].length} filme{groupedWatchedMovies[monthKey].length > 1 ? 's' : ''})
                          </span>
                        </h3>
                        <span style={{ transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: isExpanded ? 'var(--success)' : 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                          <ChevronDown size={20} />
                        </span>
                      </div>
                      
                        <ul className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                          {groupedWatchedMovies[monthKey].map(movie => (
                            <li 
                              key={movie.id} 
                              className="watched-movie-card"
                            >
                              <div>
                                {movie.poster ? (
                                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: 0.7 }} />
                                ) : (
                                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: 0.7 }}>Sem capa</div>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '0.9rem', display: 'block', color: '#aaa', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={movie.title}>{movie.title}</strong>
                                {movie.requestedBy && (
                                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    De: <span style={{ color: 'var(--text-color)' }}>{movie.requestedBy}</span>
                                  </div>
                                )}
                                {movie.watchDate && (
                                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                    {new Date(movie.watchDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ color: '#f59e0b', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '5px 10px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.9rem' }}>
                                {movie.streamerRating != null ? `⭐ ${movie.streamerRating.toFixed(1)}` : 'S/N'}
                              </div>
                            </li>
                          ))}
                        </ul>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {view === 'BADGES' && (
            <div style={{ width: 'calc(100% - 40px)', maxWidth: '1400px', margin: '0 auto 20px auto', boxSizing: 'border-box' }}>
                <h2 style={{ color: '#facc15', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🎖️ Mural de Conquistas
                </h2>
                <p style={{ color: '#aaa', marginBottom: '20px' }}>Confira todas as conquistas possíveis e o que é necessário para desbloqueá-las!</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {ALL_BADGES.map(badge => {
                    return (
                      <div key={badge.title} className="public-card badge-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', borderTop: '4px solid var(--primary)', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div>
                            <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.3rem' }}>{badge.title}</h3>
                            <span style={{ fontSize: '0.9rem', color: '#888' }}>{badge.desc}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>



      {/* Modal de Filmes do Dia (Calendário) */}
      <Modal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} maxWidth="550px">
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', textAlign: 'center' }}>
          📅 Filmes de {selectedDay?.date}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedDay?.movies.map(movie => (
            <li 
              key={movie.id} 
              style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--input-border)' }}
            >
              <div style={{ flexShrink: 0 }}>
                {movie.poster ? (
                  <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px', opacity: movie.watched ? 0.7 : 1 }} />
                ) : (
                  <div style={{ width: '40px', height: '60px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', opacity: movie.watched ? 0.7 : 1 }}>Sem capa</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.05rem', display: 'block', color: movie.watched ? '#aaa' : 'var(--text-color)', textDecoration: movie.watched ? 'line-through' : 'none' }}>{movie.title}</strong>
                {movie.requestedBy && (
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                    Resgatado por: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{movie.requestedBy}</span>
                  </div>
                )}
              </div>
              <div style={{ color: movie.watched ? '#10b981' : '#f59e0b', fontWeight: 'bold', backgroundColor: movie.watched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '5px 10px', borderRadius: '6px', textAlign: 'center', minWidth: '80px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{movie.watched ? 'Assistido' : 'Na fila'}</span>
                {movie.watched && movie.streamerRating != null && (
                   <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>⭐ {movie.streamerRating}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}