import { renderText, requiredKeysFor } from './render.js';
import { createFieldControl } from './field.js';
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

export function createCard(def, group, variablesByKey, app) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.templateId = def.id;

  const header = document.createElement('header');
  header.className = 'card-header';
  const title = document.createElement('h3');
  title.className = 'card-title';
  header.appendChild(title);

  const requiredKeys = [
    ...requiredKeysFor(def.body),
    ...requiredKeysFor(def.variants?.sentTogether?.body || ''),
    ...requiredKeysFor(def.subject.static || activeSubject(def, app.data.sharedSubjects, group.id))
  ];
  const uniqueKeys = [...new Set(requiredKeys)].filter((k) => variablesByKey[k]);

  let overrideToggle = null;
  let overridePanel = null;
  if (uniqueKeys.length) {
    overrideToggle = document.createElement('button');
    overrideToggle.type = 'button';
    overrideToggle.className = 'icon-btn card-override-toggle';
    overrideToggle.setAttribute('aria-label', 'Override values for this card');
    overrideToggle.title = 'Override values for this card';
    overrideToggle.innerHTML = icon('pencil');
    header.appendChild(overrideToggle);
  }
  el.appendChild(header);

  if (uniqueKeys.length) {
    overridePanel = document.createElement('div');
    overridePanel.className = 'card-override-panel';
    overridePanel.hidden = true;
    for (const key of uniqueKeys) {
      const varDef = variablesByKey[key];
      const control = createFieldControl(varDef, app.overrides[def.id]?.[key] || null, {
        idSuffix: `ov-${def.id}`,
        compact: true,
        onChange: (value) => {
          app.overrides[def.id] = app.overrides[def.id] || {};
          if (value === null || value === '' || (value && value.pending)) {
            delete app.overrides[def.id][key];
          } else {
            app.overrides[def.id][key] = value;
          }
          overrideToggle.classList.toggle('has-override', Object.keys(app.overrides[def.id]).length > 0);
          update();
        }
      });
      overridePanel.appendChild(control);
    }
    el.appendChild(overridePanel);
    overrideToggle.addEventListener('click', () => {
      overridePanel.hidden = !overridePanel.hidden;
      overrideToggle.setAttribute('aria-expanded', String(!overridePanel.hidden));
    });
  }

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
    const ctx = app.buildCardContext(def.id);
    const subjectRaw = activeSubject(def, app.data.sharedSubjects, group.id);
    const body = activeBody(def, app.checkboxState);

    title.textContent = body.label;

    const subjectResult = renderText(subjectRaw, ctx, app.checkboxState, app.data.checkboxes, { uppercase: true });
    const bodyResult = renderText(body.text, ctx, app.checkboxState, app.data.checkboxes);

    subjectText.innerHTML = subjectResult.html;
    bodyText.innerHTML = bodyResult.html;

    live.subjectPlain = subjectResult.plain;
    live.subjectHtml = subjectResult.html;
    live.bodyPlain = bodyResult.plain;
    live.bodyHtml = bodyResult.html;

    subjectCopy.disabled = subjectResult.missing.size > 0;
    subjectCopy.title = subjectCopy.disabled
      ? `Fill in: ${[...subjectResult.missing].join(', ')}`
      : 'Copy subject line';

    bodyCopy.disabled = bodyResult.missing.size > 0;
    bodyCopy.title = bodyCopy.disabled ? `Fill in: ${[...bodyResult.missing].join(', ')}` : 'Copy email body';
  }

  update();
  return { el, update, templateId: def.id };
}

export function buildGrid(container, data, app) {
  container.innerHTML = '';
  const variablesByKey = Object.fromEntries(data.variables.map((v) => [v.key, v]));
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
      const card = createCard(def, group, variablesByKey, app);
      cards.push(card);
      grid.appendChild(card.el);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  return cards;
}
