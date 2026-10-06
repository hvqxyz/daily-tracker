import { useMemo } from 'react';
import { useStore } from '../../common/store.js';
import { makeCtx } from '../engine/data.js';

/** App state plus a formula/relation context that is rebuilt only when tracker data changes. */
export function useTrackerData() {
  const state = useStore();
  const ctx = useMemo(() => makeCtx(state.trackers, state.trackerItems), [state.trackers, state.trackerItems]);
  return { state, ctx };
}
