import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayKey, shiftDateKey } from '../../common/time.js';
import { CalendarIconInput } from './CalendarIconInput.jsx';
import './DateCarousel.css';

const WINDOW_RADIUS = 15;

export function DateCarousel({ selectedDate, onChange }) {
  const stripRef = useRef(null);
  const mountedRef = useRef(false);
  const today = todayKey();

  const pillDates = [];
  for (let i = -WINDOW_RADIUS; i <= WINDOW_RADIUS; i += 1) {
    pillDates.push(shiftDateKey(selectedDate, i));
  }

  useEffect(() => {
    stripRef.current
      ?.querySelector('.date-pill.selected')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: mountedRef.current ? 'smooth' : 'auto' });
    mountedRef.current = true;
  }, [selectedDate]);

  return (
    <section className="day-carousel">
      <CalendarIconInput className="day-carousel-icon" value={selectedDate} onChange={onChange} />

      <button type="button" className="day-carousel-nav" onClick={() => onChange(shiftDateKey(selectedDate, -1))} aria-label="Previous day">
        <ChevronLeft size={18} />
      </button>

      <div className="day-carousel-strip" ref={stripRef}>
        {pillDates.map((key) => {
          const date = new Date(`${key}T00:00:00`);
          return (
            <button
              type="button"
              key={key}
              className={`date-pill ${key === selectedDate ? 'selected' : ''} ${key === today ? 'today' : ''}`}
              onClick={() => onChange(key)}
            >
              <span className="dow">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span> </span>
              <span className="day">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <button type="button" className="day-carousel-nav" onClick={() => onChange(shiftDateKey(selectedDate, 1))} aria-label="Next day">
        <ChevronRight size={18} />
      </button>
    </section>
  );
}
