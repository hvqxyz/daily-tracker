import { Cloud, CloudOff, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { Card } from '../Card.jsx';
import { Button } from '../buttons/Button.jsx';
import { useSyncStatus, connectSync, disconnectSync, pullFromSheets, syncNow, openInSheets } from '../../common/store.js';
import { formatRelativeTime } from '../../common/time.js';
import './SyncCard.css';

export function SyncCard() {
  const sync = useSyncStatus();

  if (!sync.connected) {
    return (
      <Card title="Sync">
        <p className="sync-copy">
          Your plan lives in this browser by default. Connect Google Sheets to back it up and pick it up on another device —
          drags and edits stay instant either way; sync just happens quietly in the background.
        </p>
        <Button onClick={connectSync} disabled={sync.connecting}>
          <Cloud size={16} /> {sync.connecting ? 'Connecting…' : 'Connect Google Sheets'}
        </Button>
        {sync.error && <p className="message error">{sync.error}</p>}
      </Card>
    );
  }

  return (
    <Card title="Sync">
      <div className="sync-status-row">
        <span className="sync-status-dot" />
        <div className="sync-status-info">
          <span className="sync-status-title">{sync.email || 'Connected'}</span>
          <span className="sync-status-sub">{sync.syncing ? 'Syncing…' : `Last synced ${formatRelativeTime(sync.lastSyncedAt)}`}</span>
        </div>
      </div>
      <div className="sync-actions">
        <Button size="small" variant="subtle" onClick={openInSheets}>
          <ExternalLink size={14} /> Open in Sheets
        </Button>
        <Button size="small" variant="subtle" onClick={syncNow} disabled={sync.syncing}>
          <RefreshCw size={14} /> Sync now
        </Button>
        <Button size="small" variant="subtle" onClick={pullFromSheets} disabled={sync.syncing}>
          <Download size={14} /> Pull latest
        </Button>
        <Button size="small" variant="danger" onClick={disconnectSync}>
          <CloudOff size={14} /> Disconnect
        </Button>
      </div>
      {sync.error && <p className="message error">{sync.error}</p>}
    </Card>
  );
}
