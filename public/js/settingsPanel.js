import { getSettings, updateSettings, exportAll, importAll } from './storage.js';
import { acknowledgeStaleData } from './data.js';
import { icon } from './icons.js';
import { copyPlain } from './clipboard.js';

const TOKEN_INFO = [
  { token: '{{TELEPHONIC_LINE}}', label: 'Inserted when "Telephonically discussed" is checked' },
  { token: '{{DOCS_LINE}}', label: 'Inserted when "Supporting documents attached" is checked' }
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function createSettingsPanel(app, requestClose) {
  const panel = document.createElement('aside');
  panel.className = 'side-panel settings-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Settings');

  const header = document.createElement('div');
  header.className = 'side-panel-header';
  header.append(el('h2', null, 'Settings'));
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.innerHTML = icon('close');
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'settings-body';
  panel.appendChild(body);

  function render() {
    body.innerHTML = '';
    body.appendChild(buildStaleNotice());
    body.appendChild(buildGeneralSection());
    body.appendChild(buildTestingSection());
    body.appendChild(buildVariablesReferenceSection());
    body.appendChild(buildMatterFeesSection());
    body.appendChild(buildTemplatesSection());
    body.appendChild(buildNewTemplateSection());
  }

  function buildStaleNotice() {
    const wrap = el('div');
    if (!app.data.stale) return wrap;
    const notice = el('div', 'notice notice-warning');
    notice.innerHTML = icon('warning');
    notice.appendChild(el('span', null, 'The shipped templates/variables were updated since your local edits were made. Review your customizations below.'));
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'btn btn-small';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => {
      acknowledgeStaleData(app.data.versions.variables, app.data.versions.templates, app.data.versions.matters);
      app.data.stale = false;
      render();
    });
    notice.appendChild(dismiss);
    wrap.appendChild(notice);
    return wrap;
  }

  function buildGeneralSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'General'));

    const settings = getSettings();
    const label = el('label', 'settings-toggle');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = settings.copyRaw;
    checkbox.addEventListener('change', () => {
      updateSettings({ copyRaw: checkbox.checked });
    });
    label.append(checkbox, el('span', null, 'Copy raw text by default (no bold/italic formatting)'));
    section.appendChild(label);

    const stickyLabel = el('label', 'settings-toggle');
    const stickyCheckbox = document.createElement('input');
    stickyCheckbox.type = 'checkbox';
    stickyCheckbox.checked = settings.stickyTopbar;
    stickyCheckbox.addEventListener('change', () => {
      updateSettings({ stickyTopbar: stickyCheckbox.checked });
      app.applyStickySetting();
    });
    stickyLabel.append(stickyCheckbox, el('span', null, 'Keep the input bar pinned while scrolling'));
    section.appendChild(stickyLabel);

    const initialsField = el('div', 'settings-field');
    initialsField.appendChild(el('label', null, 'Your initials (remembered, used as the drafter reference on generated documents)'));
    const initialsInput = document.createElement('input');
    initialsInput.type = 'text';
    initialsInput.placeholder = 'e.g. JvR';
    initialsInput.maxLength = 16;
    initialsInput.value = settings.creatorInitials;
    initialsInput.addEventListener('input', () => {
      updateSettings({ creatorInitials: initialsInput.value });
    });
    initialsField.appendChild(initialsInput);
    section.appendChild(initialsField);

    const ioRow = el('div', 'settings-io-row');
    const exportBtn = el('button', 'btn');
    exportBtn.type = 'button';
    exportBtn.innerHTML = icon('download') + '<span>Export settings</span>';
    exportBtn.addEventListener('click', doExport);

    const importBtn = el('button', 'btn');
    importBtn.type = 'button';
    importBtn.innerHTML = icon('upload') + '<span>Import settings</span>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.className = 'visually-hidden';
    fileInput.addEventListener('change', () => doImport(fileInput.files[0]));
    importBtn.addEventListener('click', () => fileInput.click());

    ioRow.append(exportBtn, importBtn, fileInput);
    section.appendChild(ioRow);
    return section;
  }

  function buildTestingSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'Testing'));
    section.appendChild(
      el('p', 'settings-hint', "Fills every field with random sample data so you don't have to type values while testing. Not for real cases.")
    );

    const btn = el('button', 'btn');
    btn.type = 'button';
    btn.innerHTML = icon('shuffle') + '<span>Randomize all values</span>';
    btn.addEventListener('click', () => app.randomizeInputs());
    section.appendChild(btn);

    return section;
  }

  function buildCodeChip(text) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'code-chip';
    chip.textContent = text;
    chip.title = 'Click to copy';
    chip.addEventListener('click', async () => {
      const ok = await copyPlain(text);
      if (!ok) return;
      chip.classList.add('copied');
      chip.textContent = 'Copied!';
      setTimeout(() => {
        chip.classList.remove('copied');
        chip.textContent = text;
      }, 1000);
    });
    return chip;
  }

  function buildVariablesReferenceSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'Template codes'));
    section.appendChild(el('p', 'settings-hint', 'Use these in the subject/body text below — click a code to copy it.'));

    const list = el('div', 'code-ref-list');
    for (const v of app.data.variables) {
      const row = el('div', 'code-ref-row');
      const codes = el('div', 'code-ref-codes');
      codes.appendChild(buildCodeChip(`<${v.key}>`));
      if (v.hasShort) codes.appendChild(buildCodeChip(`<${v.key}_SHORT>`));
      row.append(codes, el('span', 'code-ref-label', v.label));
      list.appendChild(row);
    }
    section.appendChild(list);

    section.appendChild(el('h4', 'code-ref-subheading', 'Checkbox insert lines'));
    const tokenList = el('div', 'code-ref-list');
    for (const t of TOKEN_INFO) {
      const row = el('div', 'code-ref-row');
      const codes = el('div', 'code-ref-codes');
      codes.appendChild(buildCodeChip(t.token));
      row.append(codes, el('span', 'code-ref-label', t.label));
      tokenList.appendChild(row);
    }
    section.appendChild(tokenList);

    return section;
  }

  function buildFeeList(title, fees) {
    const wrap = el('div', 'fees-group');
    wrap.appendChild(el('h4', 'code-ref-subheading', title));
    const list = el('div', 'code-ref-list');
    for (const fee of fees || []) {
      const row = el('div', 'code-ref-row');
      row.append(el('span', 'fees-label', fee.label), el('span', 'fees-amount', fee.amount));
      list.appendChild(row);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function buildMatterFeesSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'Matter fees'));
    section.appendChild(el('p', 'settings-hint', 'Reference only — these amounts are baked into the generated Word letter\'s text and are not editable here.'));

    for (const matter of Object.values(app.data.matters || {})) {
      const details = el('details', 'template-row');
      const summary = document.createElement('summary');
      summary.textContent = matter.label;
      details.appendChild(summary);
      details.appendChild(buildFeeList('VAT registered', matter.fees?.vatRegistered));
      details.appendChild(buildFeeList('Not VAT registered', matter.fees?.notVatRegistered));
      section.appendChild(details);
    }

    return section;
  }

  function doExport() {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ezcopy-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function doImport(file) {
    if (!file) return;
    if (!confirm('Import this file? It will replace your current settings, history, and template customizations. This cannot be undone.')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importAll(data);
      await app.reloadData();
      render();
    } catch (err) {
      console.error('EZcopy: import failed', err);
      alert('Could not import that file — it may not be a valid EZcopy settings export.');
    }
  }

  function buildTemplatesSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'Templates'));

    for (const group of app.data.defaults.groups) {
      if (group.sharedSubject) {
        section.appendChild(
          buildEditableRow({
            title: `${group.label} — shared subject line`,
            value: getSettings().sharedSubjectOverrides[group.id] || group.sharedSubject,
            defaultValue: group.sharedSubject,
            onSave: (text) => {
              updateSettings({ sharedSubjectOverrides: { ...getSettings().sharedSubjectOverrides, [group.id]: text } });
            },
            onReset: () => {
              const next = { ...getSettings().sharedSubjectOverrides };
              delete next[group.id];
              updateSettings({ sharedSubjectOverrides: next });
            }
          })
        );
      }
      for (const tpl of group.templates) {
        section.appendChild(
          buildEditableRow({
            title: `${group.label} — ${tpl.label}`,
            value: getSettings().templateOverrides[tpl.id]?.body || tpl.body,
            defaultValue: tpl.body,
            onSave: (text) => {
              const overrides = getSettings().templateOverrides;
              updateSettings({ templateOverrides: { ...overrides, [tpl.id]: { ...overrides[tpl.id], body: text } } });
            },
            onReset: () => {
              const overrides = { ...getSettings().templateOverrides };
              if (overrides[tpl.id]) {
                delete overrides[tpl.id].body;
                if (!Object.keys(overrides[tpl.id]).length) delete overrides[tpl.id];
              }
              updateSettings({ templateOverrides: overrides });
            }
          })
        );
      }
    }

    for (const group of getSettings().customGroups) {
      for (const tpl of group.templates) {
        section.appendChild(
          buildEditableRow({
            title: `${group.label} — ${tpl.label} (custom)`,
            value: tpl.body,
            defaultValue: tpl.body,
            onSave: (text) => saveCustomTemplateField(group.id, tpl.id, 'body', text),
            onDelete: () => deleteCustomTemplate(group.id, tpl.id)
          })
        );
      }
    }

    return section;
  }

  function buildEditableRow({ title, value, defaultValue, onSave, onReset, onDelete }) {
    const row = el('details', 'template-row');
    const summary = document.createElement('summary');
    summary.textContent = title;
    if (value !== defaultValue) summary.appendChild(el('span', 'badge', 'edited'));
    row.appendChild(summary);

    const textarea = document.createElement('textarea');
    textarea.className = 'template-editor';
    textarea.value = value;
    row.appendChild(textarea);

    const actions = el('div', 'template-row-actions');
    const saveBtn = el('button', 'btn btn-small', 'Save');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async () => {
      onSave(textarea.value);
      await app.reloadData();
      render();
    });
    actions.appendChild(saveBtn);

    if (onReset) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'btn btn-small';
      resetBtn.innerHTML = icon('reset') + '<span>Reset to default</span>';
      resetBtn.addEventListener('click', async () => {
        if (!confirm(`Reset "${title}" to its default text? Your customization will be lost.`)) return;
        onReset();
        await app.reloadData();
        render();
      });
      actions.appendChild(resetBtn);
    }
    if (onDelete) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-small btn-danger';
      delBtn.innerHTML = icon('trash') + '<span>Delete</span>';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        onDelete();
        await app.reloadData();
        render();
      });
      actions.appendChild(delBtn);
    }
    row.appendChild(actions);
    return row;
  }

  function saveCustomTemplateField(groupId, templateId, field, value) {
    const settings = getSettings();
    const groups = settings.customGroups.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, templates: g.templates.map((t) => (t.id === templateId ? { ...t, [field]: value } : t)) };
    });
    updateSettings({ customGroups: groups });
  }

  function deleteCustomTemplate(groupId, templateId) {
    const settings = getSettings();
    const groups = settings.customGroups
      .map((g) => (g.id === groupId ? { ...g, templates: g.templates.filter((t) => t.id !== templateId) } : g))
      .filter((g) => g.templates.length > 0);
    updateSettings({ customGroups: groups });
  }

  function buildNewTemplateSection() {
    const section = el('section', 'settings-section');
    section.appendChild(el('h3', null, 'New template'));

    const form = document.createElement('form');
    form.className = 'new-template-form';

    const groupSelect = document.createElement('select');
    const newGroupOpt = document.createElement('option');
    newGroupOpt.value = '__new__';
    newGroupOpt.textContent = '+ New group…';
    groupSelect.appendChild(newGroupOpt);
    for (const g of getSettings().customGroups) {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = g.label;
      groupSelect.appendChild(o);
    }

    const newGroupName = document.createElement('input');
    newGroupName.type = 'text';
    newGroupName.placeholder = 'New group name (e.g. "For Court Clerk")';
    newGroupName.maxLength = 64;

    groupSelect.addEventListener('change', () => {
      newGroupName.hidden = groupSelect.value !== '__new__';
    });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Template name';
    nameInput.required = true;
    nameInput.maxLength = 128;

    const subjectInput = document.createElement('input');
    subjectInput.type = 'text';
    subjectInput.placeholder = 'Subject line (you can use <VAR> tags)';
    subjectInput.maxLength = 512;

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'template-editor';
    bodyInput.placeholder = 'Body text (you can use <VAR> tags, e.g. <RANK> <INIT_SURNAME>)';

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'btn';
    addBtn.innerHTML = icon('plus') + '<span>Add template</span>';

    form.append(
      el('label', null, 'Group'),
      groupSelect,
      newGroupName,
      el('label', null, 'Name'),
      nameInput,
      el('label', null, 'Subject'),
      subjectInput,
      el('label', null, 'Body'),
      bodyInput,
      addBtn
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nameInput.value.trim() || !bodyInput.value.trim()) return;
      const settings = getSettings();
      const groups = [...settings.customGroups];
      let groupId = groupSelect.value;
      if (groupId === '__new__') {
        const label = newGroupName.value.trim();
        if (!label) return;
        groupId = `custom-${Date.now()}`;
        groups.push({ id: groupId, label, templates: [] });
      }
      const group = groups.find((g) => g.id === groupId);
      group.templates.push({
        id: `${groupId}-tpl-${Date.now()}`,
        label: nameInput.value.trim(),
        subject: subjectInput.value.trim(),
        body: bodyInput.value
      });
      updateSettings({ customGroups: groups });
      await app.reloadData();
      render();
    });

    section.appendChild(form);
    return section;
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
