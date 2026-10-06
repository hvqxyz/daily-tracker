import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TopNav } from './components/nav/TopNav.jsx';
import { TodayPage } from './pages/TodayPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { TemplatesPage } from './pages/TemplatesPage.jsx';
import { ActivityPage } from './pages/ActivityPage.jsx';
import { InsightsPage } from './pages/InsightsPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { NotesPage } from './pages/NotesPage.jsx';
import { QuickNoteModal } from './notes/ui/QuickNoteModal.jsx';
import { useStore } from './common/store.js';
import { onNav, requestNav } from './common/nav.js';
import { todayKey } from './common/time.js';

function App() {
  const [page, setPage] = useState('today');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [quickNote, setQuickNote] = useState(false);
  const [toast, setToast] = useState(null); // { text, noteId }
  const state = useStore();
  const mainRef = useRef(null);

  // Ask-to-navigate requests from anywhere (open a note, open a tracker item).
  useEffect(() => onNav((t) => { if (t.page && t.page !== page) setPage(t.page); }), [page]);

  // Ctrl/Cmd + Shift + N: capture a note from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setQuickNote(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function openDay(dateKey) {
    setSelectedDate(dateKey);
    setPage('today');
  }

  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [page]);

  return (
    <div className="app-shell">
      <TopNav page={page} onChange={setPage} onQuickNote={() => setQuickNote(true)} />
      <main ref={mainRef} className={page === 'today' ? 'no-scroll' : ''}>
        {page === 'today' && <TodayPage selectedDate={selectedDate} onSelectedDateChange={setSelectedDate} />}
        {page === 'calendar' && <CalendarPage selectedDate={selectedDate} onOpenDay={openDay} />}
        {page === 'templates' && <TemplatesPage onOpenDay={openDay} />}
        {page === 'activity' && <ActivityPage />}
        {page === 'insights' && <InsightsPage onOpenDay={openDay} />}
        {page === 'notes' && <NotesPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      {quickNote && (
        <QuickNoteModal
          state={state}
          onClose={() => setQuickNote(false)}
          onSaved={(note) => setToast({ text: 'Saved to Knowledge', noteId: note.id })}
        />
      )}
      {toast && (
        <div className="trk-toast" role="status">
          {toast.text}
          <button type="button" className="toast-action" onClick={() => { requestNav({ page: 'notes', noteId: toast.noteId }); setPage('notes'); setToast(null); }}>Open</button>
        </div>
      )}
    </div>
  );
}

export default App;
