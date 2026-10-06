// Tiny cross-page navigation bus. Any component can ask the app to open a
// note or a tracker item without importing the page that shows it.

import { useEffect, useRef } from 'react';

let pending = null;
const listeners = new Set();

/** target: { page: 'notes', noteId } | { page: 'activity', trackerId, itemId } | { page: 'today' } */
export function requestNav(target) {
  pending = target;
  listeners.forEach((l) => l(target));
}

export function onNav(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function takePendingNav(page) {
  if (pending && pending.page === page) {
    const t = pending;
    pending = null;
    return t;
  }
  return null;
}

/** Calls `handler(target)` for requests aimed at `page` (including one made before this page mounted). */
export function useNavRequests(page, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const first = takePendingNav(page);
    if (first) ref.current(first);
    return onNav((t) => {
      if (t.page === page) { takePendingNav(page); ref.current(t); }
    });
  }, [page]);
}
