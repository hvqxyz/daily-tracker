import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayKey } from '../../common/time.js';
import './CalendarIconInput.css';

function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// A stable Monday, used only to read locale weekday names in Mon..Sun order.
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
});

function buildMonthGrid(viewDate) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - leading);

    return Array.from({ length: 42 }, (_, i) => {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        return { date, key: toDateKey(date), outside: date.getMonth() !== month };
    });
}

export function CalendarIconInput({ value, onChange, className = '' }) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => new Date((value || todayKey()) + 'T00:00:00'));
    const wrapRef = useRef(null);

    useEffect(() => {
        if (open) setViewDate(new Date((value || todayKey()) + 'T00:00:00'));
    }, [open, value]);

    useEffect(() => {
        if (!open) return undefined;

        function handlePointerDown(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    function shiftMonth(delta) {
        setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    }

    function handleSelect(key) {
        onChange(key);
        setOpen(false);
    }

    const today = todayKey();
    const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return (
        <div className="calendar-icon-input-wrap" ref={wrapRef}>
            <button
                type="button"
                className={`calendar-icon-input ${className}`.trim()}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <CalendarDays size={18} />
            </button>

            {open && (
                <div className="calendar-popup" role="dialog" aria-label="Choose a date">
                    <div className="calendar-popup-header">
                        <button type="button" className="calendar-popup-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="calendar-popup-month">{monthLabel}</span>
                        <button type="button" className="calendar-popup-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="calendar-popup-weekdays">
                        {WEEKDAY_LABELS.map((label) => (
                            <span key={label}>{label}</span>
                        ))}
                    </div>

                    <div className="calendar-popup-grid">
                        {buildMonthGrid(viewDate).map(({ date, key, outside }) => (
                            <button
                                key={key}
                                type="button"
                                className={`calendar-popup-day${outside ? ' outside' : ''}${key === value ? ' selected' : ''}${key === today ? ' today' : ''}`}
                                onClick={() => handleSelect(key)}
                            >
                                {date.getDate()}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
