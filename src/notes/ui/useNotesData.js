import { useCallback, useMemo } from 'react';
import { useTrackerData } from '../../trackers/ui/useTrackerData.js';
import { makeNoteIndex, noteTitle, recentNotes, searchNotes } from '../knowledge.js';

/** Everything a notes screen needs: state, tracker ctx, note index and small resolvers. */
export function useNotesData() {
  const { state, ctx } = useTrackerData();
  const index = useMemo(() => makeNoteIndex(state.notes), [state.notes]);

  const resolveNote = useCallback((id) => {
    const n = index.byId.get(id);
    return n ? { title: noteTitle(n), icon: n.icon } : null;
  }, [index]);

  const searchForEditor = useCallback((query) => {
    const list = query.trim() ? searchNotes(state, { query }).map((r) => r.note) : recentNotes(state.notes, 6);
    return list.map((n) => ({ id: n.id, title: noteTitle(n), icon: n.icon }));
  }, [state]);

  return { state, ctx, index, resolveNote, searchForEditor };
}
