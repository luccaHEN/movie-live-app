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

// Cache global compartilhado entre todas as instâncias
let globalDates: Set<string> = new Set();
let globalVersion = 0;
let fetchPromise: Promise<void> | null = null;

// Lista de callbacks para notificar todas as instâncias montadas
const listeners: Set<() => void> = new Set();

function refreshDates(token: string) {
  // Evita fetches simultâneos
  if (fetchPromise) return fetchPromise;
  fetchPromise = api.get('/movies', { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      const dates = new Set<string>();
      const movies = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      movies.forEach((m: any) => {
        if (m.watchDate) {
          const d = new Date(m.watchDate);
          dates.add(
            d.getUTCFullYear() + '-' +
            String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(d.getUTCDate()).padStart(2, '0')
          );
        }
      });
      globalDates = dates;
      globalVersion++;
      // Notifica TODAS as instâncias montadas para re-renderizar
      listeners.forEach(fn => fn());
    })
    .catch(() => {})
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

// Escuta globalmente o evento moviesUpdated (uma só vez)
if (typeof window !== 'undefined') {
  let registeredToken: string | null = null;

  window.addEventListener('moviesUpdated', () => {
    if (registeredToken) {
      refreshDates(registeredToken);
    }
  });

  // Exporta uma forma de registrar o token
  (window as any).__cdpSetToken = (t: string) => { registeredToken = t; };
}

function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

export default function CustomDatePicker({ value, onChange, token, disabled }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState(globalVersion);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Registra o token para o listener global
  useEffect(() => {
    (window as any).__cdpSetToken?.(token);
  }, [token]);

  // Se inscreve para receber notificações de mudança nos dados
  useEffect(() => {
    const onUpdate = () => setVersion(globalVersion);
    listeners.add(onUpdate);
    return () => { listeners.delete(onUpdate); };
  }, []);

  // Busca os dados ao abrir o calendário pela primeira vez
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      refreshDates(token);
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

  // Fecha ao clicar fora
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

  // tileContent sem useCallback — sempre usa globalDates direto
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const dateStr = toDateStr(date);
    const hasMovie = globalDates.has(dateStr);
    return (
      <span className={hasMovie ? 'cdp-dot cdp-dot--occupied' : 'cdp-dot cdp-dot--free'} />
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
          {/* key={version} força o Calendar a re-montar quando os dados mudam */}
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
    </>
  );
}
