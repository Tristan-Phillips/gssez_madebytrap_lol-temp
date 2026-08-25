const KEYS = {
  settings: 'ezcopy.settings',
  history: 'ezcopy.history',
  recents: 'ezcopy.recents',
  optionOrder: 'ezcopy.optionOrder'
};

const DEFAULT_SETTINGS = {
  copyRaw: false,
  stickyTopbar: false,
  dataVersions: { variables: null, templates: null },
  templateOverrides: {}, // { [templateId]: { subject?, body? } }
  sharedSubjectOverrides: {}, // { [groupId]: subjectText }
  customGroups: [] // [{ id, label, templates: [{ id, label, subject, body }] }]
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('EZcopy: failed to write to local storage', err);
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(KEYS.settings, {}) };
}

export function saveSettings(settings) {
  writeJson(KEYS.settings, settings);
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  saveSettings(next);
  return next;
}

export function getHistory() {
  return readJson(KEYS.history, []);
}

export function saveHistory(entries) {
  writeJson(KEYS.history, entries);
}

export function upsertHistoryEntry(entry) {
  const entries = getHistory();
  const idx = entries.findIndex((e) => e.signature === entry.signature);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...entry, savedAt: entry.savedAt };
  } else {
    entries.unshift(entry);
  }
  saveHistory(entries);
  return entries;
}

export function deleteHistoryEntry(id) {
  const entries = getHistory().filter((e) => e.id !== id);
  saveHistory(entries);
  return entries;
}

export function getRecents(fieldKey) {
  const all = readJson(KEYS.recents, {});
  return all[fieldKey] || [];
}

export function addRecent(fieldKey, value) {
  if (!value) return;
  const all = readJson(KEYS.recents, {});
  const list = (all[fieldKey] || []).filter((v) => v !== value);
  list.unshift(value);
  all[fieldKey] = list.slice(0, 8);
  writeJson(KEYS.recents, all);
}

export function getOptionOrder(fieldKey) {
  const all = readJson(KEYS.optionOrder, {});
  return all[fieldKey] || [];
}

export function recordOptionUse(fieldKey, label) {
  if (!label) return;
  const all = readJson(KEYS.optionOrder, {});
  const list = (all[fieldKey] || []).filter((v) => v !== label);
  list.unshift(label);
  all[fieldKey] = list.slice(0, 50);
  writeJson(KEYS.optionOrder, all);
}

export function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    history: getHistory(),
    recents: readJson(KEYS.recents, {}),
    optionOrder: readJson(KEYS.optionOrder, {})
  };
}

export function importAll(data) {
  if (data.settings) saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  if (Array.isArray(data.history)) saveHistory(data.history);
  if (data.recents) writeJson(KEYS.recents, data.recents);
  if (data.optionOrder) writeJson(KEYS.optionOrder, data.optionOrder);
}
