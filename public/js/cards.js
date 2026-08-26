import { renderText, formatMarkup } from './render.js';
import { copyRich, copyPlain } from './clipboard.js';
import { icon } from './icons.js';

function activeBody(def, checkboxState) {
  if (checkboxState.sentTogether && def.variants && def.variants.sentTogether) {
    return { text: def.variants.sentTogether.body, label: def.variants.sentTogether.label };
  }
  return { text: def.body, label: def.label };
}

function activeSubject(def, sharedSubjects, groupId) {
  if (def.subject.shared) return sharedSubjects[groupId] || '';
  return def.subject.static || '';
}

async function handleCopy(btn, getPlain, getHtml, useRaw, onSuccess) {
  const ok = useRaw ? await copyPlain(getPlain()) : await copyRich(getHtml(), getPlain());
  if (!ok) return;
  onSuccess?.();
  btn.classList.add('copied');
  btn.innerHTML = icon('check');
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = icon('copy');
  }, 1400);
}

function buildOverrideField(label, rows, onEdit, onReset) {
  const field = document.createElement('div');
  field.className = 'override-field';

  const head = document.createElement('div');
  head.className = 'override-field-head';
  head.appendChild(Object.assign(document.createElement('span'), { className: 'override-field-label', textContent: label }));
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'icon-btn override-field-reset';
  resetBtn.setAttribute('aria-label', `Reset ${label.toLowerCase()} to default`);
  resetBtn.title = `Reset ${label.toLowerCase()} to default`;
  resetBtn.innerHTML = icon('reset');
  head.appendChild(resetBtn);
  field.appendChild(head);

  const textarea = document.createElement('textarea');
  textarea.className = 'override-field-textarea';
  textarea.rows = rows;
  field.appendChild(textarea);

  textarea.addEventListener('input', () => onEdit(textarea.value));
  resetBtn.addEventListener('click', () => onReset());

  return { el: field, textarea };
}

export function createCard(def, group, app) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.templateId = def.id;

  const header = document.createElement('header');
  header.className = 'card-header';
  const title = document.createElement('h3');
  title.className = 'card-title';
  header.appendChild(title);

  const overrideToggle = document.createElement('button');
  overrideToggle.type = 'button';
  overrideToggle.className = 'icon-btn card-override-toggle';
  overrideToggle.setAttribute('aria-label', 'Edit this card\'s text');
  overrideToggle.title = 'Edit this card\'s text';
  overrideToggle.innerHTML = icon('pencil');
  overrideToggle.setAttribute('aria-expanded', 'false');
  header.appendChild(overrideToggle);
  el.appendChild(header);

  const overridePanel = document.createElement('div');
  overridePanel.className = 'card-override-panel';
  overridePanel.hidden = true;

  const subjectField = buildOverrideField(
    'Subject',
    2,
    (text) => {
      app.overrides[def.id] = app.overrides[def.id] || {};
      app.overrides[def.id].subject = text;
      overrideToggle.classList.add('has-override');
      update();
    },
    () => {
      if (app.overrides[def.id]) delete app.overrides[def.id].subject;
      subjectField.textarea.value = currentRaw().subject;
      overrideToggle.classList.toggle('has-override', hasActiveOverride());
      update();
    }
  );
  const bodyField = buildOverrideField(
    'Body',
    10,
    (text) => {
      app.overrides[def.id] = app.overrides[def.id] || {};
      app.overrides[def.id].body = text;
      overrideToggle.classList.add('has-override');
      update();
    },
    () => {
      if (app.overrides[def.id]) delete app.overrides[def.id].body;
      bodyField.textarea.value = currentRaw().body;
      overrideToggle.classList.toggle('has-override', hasActiveOverride());
      update();
    }
  );
  overridePanel.append(subjectField.el, bodyField.el);
  el.appendChild(overridePanel);

  function hasActiveOverride() {
    const ov = app.overrides[def.id];
    return !!(ov && (ov.subject !== undefined || ov.body !== undefined));
  }
  overrideToggle.classList.toggle('has-override', hasActiveOverride());

  function currentRaw() {
    const ctx = app.getContext();
    const subjectRaw = activeSubject(def, app.data.sharedSubjects, group.id);
    const body = activeBody(def, app.checkboxState);
    return {
      subject: renderText(subjectRaw, ctx, app.checkboxState, app.data.checkboxes, { uppercase: true }).raw,
      body: renderText(body.text, ctx, app.checkboxState, app.data.checkboxes).raw
    };
  }

  overrideToggle.addEventListener('click', () => {
    const opening = overridePanel.hidden;
    overridePanel.hidden = !overridePanel.hidden;
    overrideToggle.setAttribute('aria-expanded', String(!overridePanel.hidden));
    if (opening) {
      const fresh = currentRaw();
      const ov = app.overrides[def.id];
      subjectField.textarea.value = ov?.subject !== undefined ? ov.subject : fresh.subject;
      bodyField.textarea.value = ov?.body !== undefined ? ov.body : fresh.body;
    }
  });

  const subjectBlock = document.createElement('div');
  subjectBlock.className = 'card-block';
  const subjectText = document.createElement('div');
  subjectText.className = 'card-text card-subject-text';
  const subjectCopy = document.createElement('button');
  subjectCopy.type = 'button';
  subjectCopy.className = 'icon-btn card-copy';
  subjectCopy.setAttribute('aria-label', 'Copy subject line');
  subjectCopy.title = 'Copy subject line';
  subjectCopy.innerHTML = icon('copy');
  subjectBlock.append(subjectText, subjectCopy);
  el.appendChild(subjectBlock);

  const bodyBlock = document.createElement('div');
  bodyBlock.className = 'card-block card-body-block';
  const bodyText = document.createElement('div');
  bodyText.className = 'card-text card-body-text';
  const bodyCopy = document.createElement('button');
  bodyCopy.type = 'button';
  bodyCopy.className = 'icon-btn card-copy';
  bodyCopy.setAttribute('aria-label', 'Copy email body');
  bodyCopy.title = 'Copy email body';
  bodyCopy.innerHTML = icon('copy');
  bodyBlock.append(bodyText, bodyCopy);
  el.appendChild(bodyBlock);

  const live = { subjectPlain: '', subjectHtml: '', bodyPlain: '', bodyHtml: '' };

  subjectCopy.addEventListener('click', () => {
    if (subjectCopy.disabled) return;
    handleCopy(subjectCopy, () => live.subjectPlain, () => live.subjectPlain, true, app.onCopySuccess);
  });
  bodyCopy.addEventListener('click', () => {
    if (bodyCopy.disabled) return;
    handleCopy(bodyCopy, () => live.bodyPlain, () => live.bodyHtml, app.getSettings().copyRaw, app.onCopySuccess);
  });

  function update() {
    const body = activeBody(def, app.checkboxState);
    title.textContent = body.label;

    const ov = app.overrides[def.id];

    if (ov?.subject !== undefined) {
      const formatted = formatMarkup(ov.subject);
      subjectText.innerHTML = formatted.html;
      live.subjectPlain = formatted.plain;
      live.subjectHtml = formatted.html;
      subjectCopy.disabled = !ov.subject.trim();
      subjectCopy.title = subjectCopy.disabled ? 'Nothing to copy' : 'Copy subject line';
    } else {
      const ctx = app.getContext();
      const subjectRaw = activeSubject(def, app.data.sharedSubjects, group.id);
      const subjectResult = renderText(subjectRaw, ctx, app.checkboxState, app.data.checkboxes, { uppercase: true });
      subjectText.innerHTML = subjectResult.html;
      live.subjectPlain = subjectResult.plain;
      live.subjectHtml = subjectResult.html;
      subjectCopy.disabled = subjectResult.missing.size > 0;
      subjectCopy.title = subjectCopy.disabled
        ? `Fill in: ${[...subjectResult.missing].join(', ')}`
        : 'Copy subject line';
    }

    if (ov?.body !== undefined) {
      const formatted = formatMarkup(ov.body);
      bodyText.innerHTML = formatted.html;
      live.bodyPlain = formatted.plain;
      live.bodyHtml = formatted.html;
      bodyCopy.disabled = !ov.body.trim();
      bodyCopy.title = bodyCopy.disabled ? 'Nothing to copy' : 'Copy email body';
    } else {
      const ctx = app.getContext();
      const bodyResult = renderText(body.text, ctx, app.checkboxState, app.data.checkboxes);
      bodyText.innerHTML = bodyResult.html;
      live.bodyPlain = bodyResult.plain;
      live.bodyHtml = bodyResult.html;
      bodyCopy.disabled = bodyResult.missing.size > 0;
      bodyCopy.title = bodyCopy.disabled ? `Fill in: ${[...bodyResult.missing].join(', ')}` : 'Copy email body';
    }
  }

  update();
  return { el, update, templateId: def.id };
}

export function buildGrid(container, data, app) {
  container.innerHTML = '';
  const cards = [];

  for (const group of data.groups) {
    const section = document.createElement('section');
    section.className = 'card-group';
    const heading = document.createElement('h2');
    heading.className = 'card-group-title';
    heading.textContent = group.label;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    for (const def of group.templates) {
      const card = createCard(def, group, app);
      cards.push(card);
      grid.appendChild(card.el);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  return cards;
}
