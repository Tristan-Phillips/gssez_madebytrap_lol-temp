import { parseDate, formatIso } from './dateParse.js';
import { getRecents, addRecent, getOptionOrder, recordOptionUse } from './storage.js';
import { icon } from './icons.js';

let uid = 0;

export function createFieldControl(def, initialValue, { idSuffix, onChange, compact } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'field' + (compact ? ' field-compact' : '');
  wrap.dataset.key = def.key;

  const fieldId = `f-${def.key}-${idSuffix || 'x'}-${uid++}`;

  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = def.label;
  label.title = def.description || '';
  label.htmlFor = fieldId;
  wrap.appendChild(label);

  if (def.type === 'dropdown') {
    buildDropdown(wrap, fieldId, def, initialValue, onChange);
  } else if (def.type === 'date') {
    buildDate(wrap, fieldId, def, initialValue, onChange);
  } else {
    buildText(wrap, fieldId, def, initialValue, onChange);
  }

  return wrap;
}

function buildText(wrap, fieldId, def, initialValue, onChange) {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = fieldId;
  input.placeholder = def.placeholder || '';
  if (def.maxLength) input.maxLength = def.maxLength;
  if (initialValue) input.value = initialValue;
  input.addEventListener('input', () => onChange(input.value));
  wrap.appendChild(input);
}

function optionDisplayText(opt) {
  return opt.short && opt.short !== opt.label ? opt.short : opt.label;
}

// Native <select> popups swallow keystrokes at the OS level while open (confirmed:
// preventDefault() on keydown does not stop the native jump-to-match behavior on
// Windows Chrome/Edge). A fully custom listbox is the only reliable way to intercept
// typing while the list is open, so dropdown fields are built from scratch here
// instead of using <select>.
function buildDropdown(wrap, fieldId, def, initialValue, onChange) {
  const customOpt = def.options.find((o) => o.custom);
  const regularOpts = def.options.filter((o) => !o.custom);

  const combo = document.createElement('div');
  combo.className = 'combo';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = fieldId;
  trigger.className = 'combo-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const triggerText = document.createElement('span');
  triggerText.className = 'combo-trigger-text';
  triggerText.textContent = def.placeholder || 'Select…';
  trigger.appendChild(triggerText);
  trigger.insertAdjacentHTML('beforeend', icon('chevron', 'combo-chevron'));
  combo.appendChild(trigger);

  const list = document.createElement('ul');
  list.className = 'combo-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  combo.appendChild(list);

  wrap.appendChild(combo);

  let selected = null;
  let typeBuffer = '';
  let typeBufferTimer = null;
  let customWrap = null;
  let customInput = null;
  let chipsWrap = null;

  function optionEls() {
    return [...list.children];
  }

  function buildOptionEl(opt, isCustom) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.className = 'combo-option';
    li.tabIndex = -1;
    li.dataset.value = opt.label;
    li.textContent = optionDisplayText(opt);
    if (opt.short && opt.short !== opt.label) li.title = opt.label;
    li.setAttribute('aria-selected', String(!!selected && selected.label === opt.label && !!selected.custom === isCustom));
    li.addEventListener('click', () => chooseOption(opt, isCustom));
    li.addEventListener('keydown', (e) => handleOptionKeydown(e, opt, isCustom));
    return li;
  }

  function renderOptionElements() {
    list.innerHTML = '';
    if (customOpt) list.appendChild(buildOptionEl(customOpt, true));

    const usage = getOptionOrder(def.key);
    const rank = new Map(usage.map((label, i) => [label, i]));
    const sorted = [...regularOpts].sort((a, b) => {
      const ra = rank.has(a.label) ? rank.get(a.label) : Infinity;
      const rb = rank.has(b.label) ? rank.get(b.label) : Infinity;
      return ra - rb;
    });
    for (const opt of sorted) list.appendChild(buildOptionEl(opt, false));
  }

  function focusOption(idx) {
    const els = optionEls();
    if (!els.length) return;
    const clamped = ((idx % els.length) + els.length) % els.length;
    for (const el of els) el.tabIndex = -1;
    els[clamped].tabIndex = 0;
    els[clamped].focus();
  }

  function moveActive(delta) {
    const els = optionEls();
    const current = els.findIndex((el) => el === document.activeElement);
    focusOption((current < 0 ? 0 : current) + delta);
  }

  function openList() {
    renderOptionElements();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const els = optionEls();
    const targetLabel = selected && selected.custom ? customOpt?.label : selected?.label;
    let idx = els.findIndex((li) => li.dataset.value === targetLabel);
    if (idx < 0) idx = 0;
    focusOption(idx);
  }

  function closeList({ focusTrigger = true } = {}) {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger) trigger.focus();
  }

  function isOpen() {
    return !list.hidden;
  }

  function chooseOption(opt, isCustom) {
    trigger.classList.add('has-value');
    if (isCustom) {
      selected = { label: '', short: '', custom: true, pending: true };
      trigger.title = customOpt.label;
      triggerText.textContent = optionDisplayText(customOpt);
      closeList({ focusTrigger: false });
      customWrap.hidden = false;
      chipsWrap.hidden = false;
      customInput.value = '';
      customInput.focus();
      onChange({ label: '', short: '', custom: true, pending: true });
      return;
    }
    selected = { label: opt.label, short: opt.short || opt.label, custom: false };
    trigger.title = opt.label;
    triggerText.textContent = optionDisplayText(opt);
    if (customWrap) customWrap.hidden = true;
    if (chipsWrap) chipsWrap.hidden = true;
    recordOptionUse(def.key, opt.label);
    closeList();
    onChange({ label: opt.label, short: opt.short || opt.label });
  }

  function startOverrideTyping(char) {
    if (!customOpt) return;
    chooseOption(customOpt, true);
    customInput.value = char;
    customInput.setSelectionRange(1, 1);
    emitCustom();
  }

  function typeAheadJump(char) {
    clearTimeout(typeBufferTimer);
    typeBuffer += char.toLowerCase();
    typeBufferTimer = setTimeout(() => {
      typeBuffer = '';
    }, 700);
    const match = regularOpts.find(
      (o) => optionDisplayText(o).toLowerCase().startsWith(typeBuffer) || o.label.toLowerCase().startsWith(typeBuffer)
    );
    if (!match) return;
    const idx = optionEls().findIndex((li) => li.dataset.value === match.label);
    if (idx >= 0) focusOption(idx);
  }

  function handleOptionKeydown(e, opt, isCustom) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusOption(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusOption(optionEls().length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      chooseOption(opt, isCustom);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeList();
    } else if (e.key === 'Tab') {
      closeList({ focusTrigger: false });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (customOpt) startOverrideTyping(e.key);
      else typeAheadJump(e.key);
    }
  }

  trigger.addEventListener('click', () => {
    if (isOpen()) closeList();
    else openList();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) openList();
      else moveActive(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (customOpt) {
        startOverrideTyping(e.key);
      } else {
        if (!isOpen()) openList();
        typeAheadJump(e.key);
      }
    }
  });

  combo.addEventListener('focusout', (e) => {
    if (!combo.contains(e.relatedTarget)) closeList({ focusTrigger: false });
  });
  document.addEventListener('click', (e) => {
    if (!combo.contains(e.target)) closeList({ focusTrigger: false });
  });

  function emitCustom() {
    const text = (customInput.value || '').trim();
    if (!text) {
      onChange({ label: '', short: '', custom: true, pending: true });
      return;
    }
    onChange({ label: text, short: text, custom: true });
  }

  if (customOpt) {
    customWrap = document.createElement('div');
    customWrap.className = 'field-custom';
    customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = `Enter ${def.label.toLowerCase()}…`;
    if (customOpt.maxLength) customInput.maxLength = customOpt.maxLength;
    customWrap.appendChild(customInput);
    customWrap.hidden = true;
    wrap.appendChild(customWrap);

    chipsWrap = document.createElement('div');
    chipsWrap.className = 'field-recents';
    renderRecentChips(chipsWrap, def.key, (val) => {
      customInput.value = val;
      customInput.focus();
      emitCustom();
    });
    chipsWrap.hidden = true;
    wrap.appendChild(chipsWrap);

    customInput.addEventListener('input', emitCustom);
    customInput.addEventListener('blur', () => {
      const text = (customInput.value || '').trim();
      if (!text) return;
      addRecent(def.key, text);
      renderRecentChips(chipsWrap, def.key, (val) => {
        customInput.value = val;
        customInput.focus();
        emitCustom();
      });
    });
  }

  renderOptionElements();

  if (initialValue && initialValue.label) {
    trigger.classList.add('has-value');
    if (customOpt && initialValue.custom) {
      selected = { ...initialValue };
      triggerText.textContent = optionDisplayText(customOpt);
      trigger.title = customOpt.label;
      customInput.value = initialValue.label;
      customWrap.hidden = false;
      chipsWrap.hidden = false;
    } else {
      selected = { ...initialValue };
      triggerText.textContent = optionDisplayText(initialValue);
      trigger.title = initialValue.label;
    }
  }
}

function renderRecentChips(container, fieldKey, onPick) {
  container.innerHTML = '';
  const recents = getRecents(fieldKey);
  if (!recents.length) return;
  const heading = document.createElement('span');
  heading.className = 'field-recents-label';
  heading.textContent = 'Recent:';
  container.appendChild(heading);
  for (const val of recents) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = val;
    chip.addEventListener('click', () => onPick(val));
    container.appendChild(chip);
  }
}

function buildDate(wrap, fieldId, def, initialValue, onChange) {
  const row = document.createElement('div');
  row.className = 'field-date-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = fieldId;
  input.placeholder = def.placeholder ? `${def.placeholder} (e.g. 2208)` : 'e.g. 2208';
  row.appendChild(input);

  const pickerBtn = document.createElement('button');
  pickerBtn.type = 'button';
  pickerBtn.className = 'icon-btn';
  pickerBtn.setAttribute('aria-label', 'Open calendar');
  pickerBtn.title = 'Open calendar';
  pickerBtn.innerHTML = icon('calendar');
  row.appendChild(pickerBtn);

  const native = document.createElement('input');
  native.type = 'date';
  native.className = 'visually-hidden';
  native.tabIndex = -1;
  row.appendChild(native);

  const hint = document.createElement('div');
  hint.className = 'field-hint';

  wrap.appendChild(row);
  wrap.appendChild(hint);

  function setFromResult(result) {
    if (result.valid) {
      hint.textContent = result.formatted;
      hint.classList.remove('field-hint-error');
      onChange(result);
    } else if (input.value.trim()) {
      hint.textContent = 'Unrecognized date';
      hint.classList.add('field-hint-error');
      onChange({ raw: input.value, formatted: '', valid: false });
    } else {
      hint.textContent = '';
      hint.classList.remove('field-hint-error');
      onChange(null);
    }
  }

  input.addEventListener('input', () => setFromResult(parseDate(input.value)));
  pickerBtn.addEventListener('click', () => {
    if (native.showPicker) native.showPicker();
    else native.click();
  });
  native.addEventListener('change', () => {
    const result = formatIso(native.value);
    input.value = result.formatted;
    setFromResult(result);
  });

  if (initialValue && initialValue.raw) {
    input.value = initialValue.raw;
    setFromResult(initialValue);
  }
}
