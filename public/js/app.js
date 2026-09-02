import { loadData } from './data.js';
import { getSettings, upsertHistoryEntry, isStorageAvailable } from './storage.js';
import { createFieldControl } from './field.js';
import { buildGrid } from './cards.js';
import { createHistoryPanel } from './historyPanel.js';
import { createSettingsPanel } from './settingsPanel.js';
import { icon } from './icons.js';
import { buildRandomInputs, buildRandomCheckboxState } from './randomTestData.js';

function buildSignature(inputs, checkboxState) {
  const norm = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (v && typeof v === 'object' && 'label' in v) norm[k] = v.label;
    else if (v && typeof v === 'object' && 'raw' in v) norm[k] = v.raw;
    else norm[k] = v;
  }
  return JSON.stringify({ inputs: norm, checkboxState });
}

function buildHistoryLabel(inputs) {
  const parts = [];
  if (inputs.RANK?.short && inputs.INIT_SURNAME) parts.push(`${inputs.RANK.short} ${inputs.INIT_SURNAME}`);
  else if (inputs.INIT_SURNAME) parts.push(inputs.INIT_SURNAME);
  if (inputs.MATTER_TYPE?.label) parts.push(inputs.MATTER_TYPE.label);
  if (inputs.DATE?.formatted) parts.push(inputs.DATE.formatted);
  return parts.length ? parts.join(' — ') : 'Untitled case';
}

function buildContext(inputs) {
  const ctx = {};
  for (const [key, val] of Object.entries(inputs)) {
    if (val == null) continue;
    if (key === 'DATE') {
      if (val.valid) {
        ctx.DATE = val.formatted;
        ctx.__isTrialDateRange = !!val.isRange;
      }
      continue;
    }
    if (typeof val === 'object' && 'label' in val) {
      if (val.label) ctx[key] = val;
      continue;
    }
    if (typeof val === 'string' && val.trim()) ctx[key] = val;
  }
  if (ctx.MATTER_FILE_CODE && ctx.MATTER_TYPE && ctx.MATTER_FILE_YEAR) {
    const prefix = ctx.MATTER_TYPE.short || ctx.MATTER_TYPE.label;
    ctx.MATTER_FILE_CODE = `${prefix} ${ctx.MATTER_FILE_CODE}/${ctx.MATTER_FILE_YEAR}`;
  } else {
    delete ctx.MATTER_FILE_CODE;
  }
  return ctx;
}

async function main() {
  const app = {
    inputs: {},
    checkboxState: { sentTogether: false, telephonic: false, docsAttached: false, isTrial: false },
    overrides: {},
    cards: [],
    data: null,
    getSettings,
    getContext() {
      return buildContext(this.inputs);
    },
    onCopySuccess() {
      const signature = buildSignature(app.inputs, app.checkboxState);
      upsertHistoryEntry({
        id: signature,
        signature,
        label: buildHistoryLabel(app.inputs),
        savedAt: new Date().toISOString(),
        inputs: app.inputs,
        checkboxState: { ...app.checkboxState }
      });
      historyPanel.render();
    },
    loadHistoryEntry(entry) {
      app.inputs = JSON.parse(JSON.stringify(entry.inputs));
      app.checkboxState = { ...entry.checkboxState };
      app.overrides = {};
      renderInputBar();
      syncCheckboxUI();
      rebuildGrid();
    },
    async reloadData() {
      app.data = await loadData();
      rebuildGrid();
    },
    randomizeInputs() {
      app.inputs = buildRandomInputs(app.data.variables);
      app.checkboxState = buildRandomCheckboxState(app.data.checkboxes);
      app.overrides = {};
      renderInputBar();
      syncCheckboxUI();
      rebuildGrid();
    },
    announce(message) {
      liveRegion.textContent = '';
      requestAnimationFrame(() => {
        liveRegion.textContent = message;
      });
    }
  };

  app.data = await loadData();

  const root = document.getElementById('app');

  const liveRegion = document.createElement('div');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  root.appendChild(liveRegion);

  const storageBanner = document.createElement('div');
  storageBanner.className = 'notice notice-warning app-storage-banner';
  storageBanner.innerHTML = icon('warning') + '<span>Your browser storage is unavailable or full — history and settings will not be saved this session.</span>';
  storageBanner.hidden = isStorageAvailable();
  root.appendChild(storageBanner);

  const topbar = document.createElement('header');
  topbar.id = 'topbar';

  const inputBar = document.createElement('div');
  inputBar.id = 'input-bar';

  const checkboxRow = document.createElement('div');
  checkboxRow.id = 'checkbox-row';

  const actions = document.createElement('div');
  actions.id = 'topbar-actions';
  const historyBtn = document.createElement('button');
  historyBtn.type = 'button';
  historyBtn.className = 'icon-btn icon-btn-large';
  historyBtn.setAttribute('aria-label', 'Open history');
  historyBtn.title = 'History';
  historyBtn.innerHTML = icon('history');
  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'icon-btn icon-btn-large';
  settingsBtn.setAttribute('aria-label', 'Open settings');
  settingsBtn.title = 'Settings';
  settingsBtn.innerHTML = icon('settings');
  actions.append(historyBtn, settingsBtn);

  const topRow = document.createElement('div');
  topRow.id = 'topbar-row';
  topRow.append(inputBar, actions);

  topbar.append(topRow, checkboxRow);

  const gridContainer = document.createElement('main');
  gridContainer.id = 'grid-container';

  root.append(topbar, gridContainer);

  const historyPanel = createHistoryPanel(app, closeAllPanels);
  const settingsPanel = createSettingsPanel(app, closeAllPanels);
  const backdrop = document.createElement('div');
  backdrop.className = 'panel-backdrop';
  backdrop.hidden = true;
  root.append(backdrop, historyPanel.el, settingsPanel.el);

  function openPanel(panel) {
    historyPanel.close();
    settingsPanel.close();
    panel.open();
    backdrop.hidden = false;
  }
  function closeAllPanels() {
    historyPanel.close();
    settingsPanel.close();
    backdrop.hidden = true;
  }
  historyBtn.addEventListener('click', () => openPanel(historyPanel));
  settingsBtn.addEventListener('click', () => openPanel(settingsPanel));
  backdrop.addEventListener('click', closeAllPanels);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });

  let dateControl = null;

  const checkboxEls = {};
  function buildCheckboxRow() {
    checkboxRow.innerHTML = '';
    for (const def of app.data.checkboxes) {
      const label = document.createElement('label');
      label.className = 'checkbox-pill';
      label.title = def.description || '';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = app.checkboxState[def.id] || false;
      input.addEventListener('change', () => {
        app.checkboxState[def.id] = input.checked;
        if (def.id === 'isTrial' && dateControl) {
          dateControl.setTrialMode(input.checked);
        }
        updateAllCards();
      });
      const iconWrap = document.createElement('span');
      iconWrap.innerHTML = icon(def.icon || 'link');
      const textSpan = document.createElement('span');
      textSpan.textContent = def.label;
      label.append(input, iconWrap, textSpan);
      checkboxRow.appendChild(label);
      checkboxEls[def.id] = input;
    }
  }
  function syncCheckboxUI() {
    for (const [id, elInput] of Object.entries(checkboxEls)) {
      elInput.checked = app.checkboxState[id] || false;
    }
  }

  function renderInputBar() {
    inputBar.innerHTML = '';
    for (const def of app.data.variables) {
      const control = createFieldControl(def, app.inputs[def.key] || null, {
        idSuffix: 'main',
        initialTrialMode: def.key === 'DATE' ? !!app.checkboxState.isTrial : undefined,
        onChange: (value) => {
          app.inputs[def.key] = value;
          updateAllCards();
        }
      });
      if (def.key === 'DATE') dateControl = control;
      inputBar.appendChild(control.el);
    }
  }

  function updateAllCards() {
    for (const card of app.cards) card.update();
  }

  function rebuildGrid() {
    app.cards = buildGrid(gridContainer, app.data, app);
  }

  function applyStickySetting() {
    topbar.classList.toggle('topbar-sticky', getSettings().stickyTopbar);
  }
  app.applyStickySetting = applyStickySetting;

  buildCheckboxRow();
  renderInputBar();
  rebuildGrid();
  applyStickySetting();
}

main().catch((err) => {
  console.error('EZcopy failed to start', err);
  document.getElementById('app').innerHTML =
    '<p class="fatal-error">EZcopy could not load. Check the console for details, and make sure the site is served over http(s) rather than opened as a local file.</p>';
});
