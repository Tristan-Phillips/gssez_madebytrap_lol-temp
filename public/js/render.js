const TOKEN_MAP = {
  telephonic: '{{TELEPHONIC_LINE}}',
  docsAttached: '{{DOCS_LINE}}'
};

const TRIAL_NOTE_TOKEN = '{{TRIAL_NOTE}}';
const TRIAL_NOTE_TEXT = '*(This is the date for which the trial is booked)*';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyLineTokens(text, checkboxState, checkboxDefs, isTrialRange) {
  let out = text;
  for (const [id, token] of Object.entries(TOKEN_MAP)) {
    const def = checkboxDefs.find((c) => c.id === id);
    const replacement = checkboxState[id] && def ? def.insertText : '';
    out = out.split(token).join(replacement);
  }
  out = out.split(TRIAL_NOTE_TOKEN).join(isTrialRange ? TRIAL_NOTE_TEXT : '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function substituteVars(text, context, missing) {
  return text.replace(/<([A-Z][A-Z0-9_]*)>/g, (match, name) => {
    const isShort = name.endsWith('_SHORT');
    const baseKey = isShort ? name.slice(0, -6) : name;
    const val = context[baseKey];

    if (val === undefined || val === null || val === '') {
      missing.add(baseKey);
      return '';
    }
    if (typeof val === 'object') {
      const out = isShort ? (val.short || val.label) : val.label;
      if (!out) {
        missing.add(baseKey);
        return '';
      }
      return isShort ? out.toUpperCase() : out;
    }
    return String(val);
  });
}

export function requiredKeysFor(text) {
  const keys = new Set();
  const matches = (text || '').matchAll(/<([A-Z][A-Z0-9_]*)>/g);
  for (const m of matches) {
    const name = m[1];
    keys.add(name.endsWith('_SHORT') ? name.slice(0, -6) : name);
  }
  return keys;
}

function toPlain(substituted) {
  return substituted
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .trim();
}

function toHtml(substituted) {
  const escaped = escapeHtml(substituted)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const paragraphs = escaped.split(/\n\n+/).map((p) => p.split('\n').join('<br>'));
  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}

/**
 * Renders one piece of template text (subject or body) against the current
 * variable context and checkbox state.
 */
export function renderText(text, context, checkboxState, checkboxDefs, { uppercase = false } = {}) {
  const withTokens = applyLineTokens(text || '', checkboxState, checkboxDefs, !!context.__isTrialDateRange);
  const missing = new Set();
  let substituted = substituteVars(withTokens, context, missing);
  if (uppercase) substituted = substituted.toUpperCase();
  return {
    raw: substituted,
    plain: toPlain(substituted),
    html: toHtml(substituted),
    missing
  };
}

/**
 * Formats manually-edited card text (already-substituted, no <VAR> tokens
 * left to resolve) — same bold, underline, and italic markup as renderText,
 * but skips variable substitution and checkbox tokens entirely so a stray
 * angle bracket or curly brace the user types can't be misread as a tag.
 */
export function formatMarkup(text) {
  const substituted = text || '';
  return {
    plain: toPlain(substituted),
    html: toHtml(substituted)
  };
}
