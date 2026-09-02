import { getHistory, deleteHistoryEntry } from './storage.js';
import { icon } from './icons.js';

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function createHistoryPanel(app, requestClose) {
  const panel = document.createElement('aside');
  panel.className = 'side-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'History');

  const header = document.createElement('div');
  header.className = 'side-panel-header';
  const title = document.createElement('h2');
  title.textContent = 'History';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Close history');
  closeBtn.innerHTML = icon('close');
  header.append(title, closeBtn);
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'history-list';
  panel.appendChild(list);

  function render() {
    list.innerHTML = '';
    const entries = getHistory();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Copied cases will appear here.';
      list.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'history-row';

      const text = document.createElement('span');
      text.className = 'history-row-text';
      const label = document.createElement('span');
      label.className = 'history-row-label';
      label.textContent = entry.label;
      const time = document.createElement('span');
      time.className = 'history-row-time';
      time.textContent = relativeTime(entry.savedAt);
      text.append(label, time);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn history-row-delete';
      del.setAttribute('aria-label', `Delete ${entry.label} from history`);
      del.innerHTML = icon('trash');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${entry.label}" from history? This cannot be undone.`)) return;
        deleteHistoryEntry(entry.id);
        render();
      });

      row.append(text, del);
      row.addEventListener('click', () => {
        app.loadHistoryEntry(entry);
        close();
      });
      list.appendChild(row);
    }
  }

  function open() {
    panel.hidden = false;
    render();
  }
  function close() {
    panel.hidden = true;
  }

  closeBtn.addEventListener('click', () => (requestClose ? requestClose() : close()));

  return { el: panel, open, close, render };
}
