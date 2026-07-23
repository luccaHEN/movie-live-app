import { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import api from '../services/api';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  token: string;
  disabled?: boolean;
}

interface MovieInfo {
  title: string;
  poster: string | null;
  watched: boolean;
  requestedBy?: string;
}

// Cache global compartilhado entre todas as instâncias
let globalMoviesByDate: Map<string, MovieInfo[]> = new Map();
let globalVersion = 0;
let fetchPromise: Promise<void> | null = null;

const listeners: Set<() => void> = new Set();

function refreshDates(token: string) {
  if (fetchPromise) return fetchPromise;
  fetchPromise = api.get('/movies', { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      const moviesByDate = new Map<string, MovieInfo[]>();
      const movies = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      movies.forEach((m: any) => {
        if (m.watchDate) {
          const d = new Date(m.watchDate);
          const dateKey =
            d.getUTCFullYear() + '-' +
            String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(d.getUTCDate()).padStart(2, '0');

          const existing = moviesByDate.get(dateKey) || [];
          existing.push({
            title: m.title || 'Sem título',
            poster: m.poster || null,
            watched: !!m.watched,
            requestedBy: m.requestedBy || undefined,
          });
          moviesByDate.set(dateKey, existing);
        }
      });
      globalMoviesByDate = moviesByDate;
      globalVersion++;
      listeners.forEach(fn => fn());
    })
    .catch(() => {})
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

if (typeof window !== 'undefined') {
  let registeredToken: string | null = null;
  window.addEventListener('moviesUpdated', () => {
    if (registeredToken) {
      refreshDates(registeredToken);
    }
  });
  (window as any).__cdpSetToken = (t: string) => { registeredToken = t; };
}

function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function DayTooltip({ movies, tileEl }: { movies: MovieInfo[]; tileEl: HTMLElement | null }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!tileEl || !tooltipRef.current) return;
    const tileRect = tileEl.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const pad = 8;

    let top = tileRect.top - tooltipRect.height - pad;
    let left = tileRect.left + tileRect.width / 2 - tooltipRect.width / 2;

    if (top < pad) {
      top = tileRect.bottom + pad;
    }
    if (left + tooltipRect.width > window.innerWidth - pad) {
      left = window.innerWidth - tooltipRect.width - pad;
    }
    if (left < pad) {
      left = pad;
    }

    setPos({ top, left });
  }, [tileEl]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="cdp-tooltip"
      style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { top: -9999, left: -9999, opacity: 0 }}
    >
      <div className="cdp-tooltip-header">
        🎬 {movies.length} filme{movies.length > 1 ? 's' : ''} neste dia
      </div>
      <div className="cdp-tooltip-list">
        {movies.map((movie, i) => (
          <div key={i} className="cdp-tooltip-movie">
            {movie.poster ? (
              <img src={`https://image.tmdb.org/t/p/w92${movie.poster}`} alt={movie.title} className="cdp-tooltip-poster" />
            ) : (
              <div className="cdp-tooltip-poster-placeholder">🎬</div>
            )}
            <div className="cdp-tooltip-info">
              <span className="cdp-tooltip-title">{movie.title}</span>
              {movie.requestedBy && (
                <span className="cdp-tooltip-requested">Resgatado por {movie.requestedBy}</span>
              )}
            </div>
            <span className={`cdp-tooltip-status ${movie.watched ? 'cdp-tooltip-status--watched' : 'cdp-tooltip-status--pending'}`}>
              {movie.watched ? '✓' : '⏳'}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

export default function CustomDatePicker({ value, onChange, token, disabled }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState(globalVersion);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredTileEl, setHoveredTileEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    (window as any).__cdpSetToken?.(token);
  }, [token]);

  useEffect(() => {
    const onUpdate = () => setVersion(globalVersion);
    listeners.add(onUpdate);
    return () => { listeners.delete(onUpdate); };
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      refreshDates(token);
    } else {
      setHoveredDate(null);
      setHoveredTileEl(null);
    }
  }, [isOpen, token]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const calendarHeight = 380;
    const calendarWidth = 310;

    let top = rect.bottom + 8;
    let left = rect.left;

    if (top + calendarHeight > window.innerHeight - 16) {
      top = rect.top - calendarHeight - 8;
    }
    if (left + calendarWidth > window.innerWidth - 16) {
      left = window.innerWidth - calendarWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    setDropdownPos({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Sem setTimeout para aparecer instantaneamente
  const handleTileMouseEnter = useCallback((dateStr: string, event: React.MouseEvent) => {
    const movies = globalMoviesByDate.get(dateStr);
    if (movies && movies.length > 0) {
      setHoveredDate(dateStr);
      setHoveredTileEl(event.currentTarget as HTMLElement);
    }
  }, []);

  const handleTileMouseLeave = useCallback(() => {
    setHoveredDate(null);
    setHoveredTileEl(null);
  }, []);

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const dateStr = toDateStr(date);
    const movies = globalMoviesByDate.get(dateStr);
    const hasMovie = movies && movies.length > 0;
    
    // Fallback nativo: string com os títulos dos filmes
    const nativeTooltip = hasMovie ? movies.map(m => m.title).join(', ') : undefined;

    return (
      <div
        className={`cdp-dot-wrapper ${hasMovie ? 'cdp-dot-wrapper--has-movies' : ''}`}
        onMouseEnter={(e) => handleTileMouseEnter(dateStr, e)}
        onMouseLeave={handleTileMouseLeave}
        title={nativeTooltip}
      >
        <span className={hasMovie ? 'cdp-dot cdp-dot--occupied' : 'cdp-dot cdp-dot--free'} />
        {hasMovie && movies.length > 1 && (
          <span className="cdp-dot-count">{movies.length}</span>
        )}
      </div>
    );
  };

  const dateValue = value ? new Date(`${value}T12:00:00`) : null;
  const formattedValue = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
    : '';

  const handleCalendarChange = useCallback((val: any) => {
    if (val) {
      onChange(toDateStr(val));
    } else {
      onChange('');
    }
    setIsOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  }, [onChange]);

  const hoveredMovies = hoveredDate ? globalMoviesByDate.get(hoveredDate) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`cdp-trigger ${isOpen ? 'cdp-trigger--open' : ''} ${disabled ? 'cdp-trigger--disabled' : ''}`}
      >
        <CalendarIcon size={16} className="cdp-trigger-icon" />
        <span className={formattedValue ? 'cdp-trigger-value' : 'cdp-trigger-placeholder'}>
          {formattedValue || 'Selecionar data...'}
        </span>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="cdp-trigger-clear"
            title="Limpar data"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="cdp-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <Calendar
            key={version}
            className="cdp-calendar"
            onChange={handleCalendarChange}
            value={dateValue}
            tileContent={tileContent}
            locale="pt-BR"
            prev2Label={null}
            next2Label={null}
            minDetail="month"
          />
          <div className="cdp-legend">
            <span className="cdp-legend-item">
              <span className="cdp-dot cdp-dot--occupied"></span>
              Com filme
            </span>
            <span className="cdp-legend-item">
              <span className="cdp-dot cdp-dot--free"></span>
              Livre
            </span>
          </div>
        </div>,
        document.body
      )}

      {hoveredDate && hoveredMovies && hoveredMovies.length > 0 && hoveredTileEl && (
        <DayTooltip movies={hoveredMovies} tileEl={hoveredTileEl} />
      )}
    </>
  );
}
