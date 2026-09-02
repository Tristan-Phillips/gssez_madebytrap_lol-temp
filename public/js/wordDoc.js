const MONTHS_TITLE = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Fields required before a Word letter can be generated — mirrors the
// copy-button gating pattern (blocked + tooltip listing what's missing),
// but as an explicit list since introspecting a .docx's placeholders
// client-side (vs. the plain-text email templates) isn't practical.
export const WORD_DOC_REQUIRED_KEYS = [
  'MATTER_TYPE', 'RANK', 'INIT_SURNAME', 'LOCATION', 'COURT_TYPE', 'DATE', 'ATT_NAME', 'MATTER_FILE_CODE', 'MATTER_FILE_YEAR'
];

function formatDateTitleCase(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_TITLE[m - 1]} ${y}`;
}

// Compound-surname prefix particles, common in Afrikaans/Dutch surnames in
// this domain (van Wyk, van der Merwe, du Plessis, de Villiers, von...).
// Matched case-insensitively since staff type these capitalized ("Van Wyk")
// or lowercase ("van Wyk") interchangeably — capitalization can't be used
// to tell a prefix apart from an initial.
const SURNAME_PREFIXES = new Set(['van', 'der', 'den', 'du', 'de', 'von', 'la', 'le', 'di', 'da', 'das', 'dos', 'ter', 'ten']);

// Splits "J.S. Van Wyk" into { initials: "J.S.", surname: "Van Wyk" }. The
// last token is always part of the surname; any preceding tokens that match
// a known prefix particle are folded into the surname too.
function splitInitialsSurname(initSurname) {
  const trimmed = (initSurname || '').trim();
  if (!trimmed) return { initials: '', surname: '' };
  const parts = trimmed.split(/\s+/);
  let splitIndex = parts.length - 1;
  while (splitIndex > 0 && SURNAME_PREFIXES.has(parts[splitIndex - 1].toLowerCase())) {
    splitIndex--;
  }
  return { initials: parts.slice(0, splitIndex).join(' '), surname: parts.slice(splitIndex).join(' ') };
}

// e.g. "S.V. Motapane" -> "SVM" (initials without periods + first letter of surname)
function deriveMemberInitFull(initSurname) {
  const { initials, surname } = splitInitialsSurname(initSurname);
  if (!surname) return '';
  const initialsClean = initials.replace(/[^A-Za-z]/g, '').toUpperCase();
  const surnameFirst = surname.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
  return `${initialsClean}${surnameFirst}`;
}

// Real letters always show the surname in caps (e.g. "S.V. MOTAPANE"), initials
// stay natural case — matches how the real historical letters were typed.
function uppercaseSurname(initSurname) {
  const { initials, surname } = splitInitialsSurname(initSurname);
  if (!surname) return initials;
  return initials ? `${initials} ${surname.toUpperCase()}` : surname.toUpperCase();
}

// Word letters use their own court wording (no apostrophe-s), unlike the emails.
// Apostrophe is normalized (straight vs curly) before comparing, defensively.
function wordCourtType(courtType) {
  if (!courtType || !courtType.label) return '';
  const normalized = courtType.label.replace(/[‘’ʼ]/g, "'").trim();
  if (normalized === "Magistrate's Court") return 'Magistrate Court';
  return courtType.label;
}

export function isDateValid(dateVal) {
  if (!dateVal) return false;
  if (dateVal.isRange) return !!(dateVal.from?.valid && dateVal.till?.valid);
  return !!dateVal.valid;
}

export function wordDocMissingFields(inputs) {
  const missing = [];
  for (const key of WORD_DOC_REQUIRED_KEYS) {
    const val = inputs[key];
    if (key === 'DATE') {
      if (!isDateValid(val)) missing.push(key);
      continue;
    }
    if (val && typeof val === 'object' && 'label' in val) {
      if (!val.label) missing.push(key);
      continue;
    }
    if (!val || !String(val).trim()) missing.push(key);
  }
  return missing;
}

/**
 * Word-specific formatting layer — separate from render.js's buildContext,
 * since generated documents use different casing/wording rules than the
 * emails (title-case dates, natural-case RANK_SHORT, no-apostrophe court
 * wording) and need a few values (MEMBER_INIT_FULL, an unprefixed
 * MATTER_FILE_CODE, CREATOR) that the email templates never touch.
 */
export function buildWordContext(inputs, settings) {
  const ctx = {};
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  ctx.DATE_TODAY = formatDateTitleCase(todayIso);
  ctx.CREATOR = settings.creatorInitials || '';
  ctx.INIT_SURNAME = uppercaseSurname(inputs.INIT_SURNAME);
  ctx.MEMBER_INIT_FULL = deriveMemberInitFull(inputs.INIT_SURNAME);
  ctx.RANK_SHORT = inputs.RANK?.short || '';
  ctx.MATTER_TYPE_SHORT = inputs.MATTER_TYPE?.short || '';
  ctx.ATT_NAME = (inputs.ATT_NAME || '').toUpperCase();
  ctx.LOCATION = inputs.LOCATION || '';
  ctx.LOCATION_CAPS = (inputs.LOCATION || '').toUpperCase();
  ctx['COURT TYPE'] = wordCourtType(inputs.COURT_TYPE);
  // Reads the "MATTER_SPECIFIC" input variable but keeps the .docx placeholder
  // named MATTER_SPECIFIC_SHORT (the ctx key here maps 1:1 to the <<...>>
  // token baked into the template files) — see variables.json for why the
  // input's own key was renamed off of "_SHORT" (it collided with render.js's
  // short-form-stripping convention for email <VAR_SHORT> tags).
  ctx.MATTER_SPECIFIC_SHORT = inputs.MATTER_SPECIFIC || '';
  ctx.MATTER_PARTY_ROLE = inputs.MATTER_PARTY_ROLE || '';
  ctx.MATTER_COURT_NAME = inputs.MATTER_COURT_NAME || '';

  const rawFileNum = (inputs.MATTER_FILE_CODE || '').trim();
  const fileYear = (inputs.MATTER_FILE_YEAR || '').trim();
  ctx.MATTER_FILE_CODE = (rawFileNum && fileYear) ? `${rawFileNum}/${fileYear}` : '';

  const dateVal = inputs.DATE;
  if (dateVal?.isRange) {
    ctx.DATE = formatDateTitleCase(dateVal.from?.iso);
    ctx.DATE_TILL = formatDateTitleCase(dateVal.till?.iso);
  } else if (dateVal?.valid) {
    ctx.DATE = formatDateTitleCase(dateVal.iso);
    ctx.DATE_TILL = '';
  } else {
    ctx.DATE = '';
    ctx.DATE_TILL = '';
  }
  return ctx;
}

function sanitizeFilename(name) {
  return (name || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

export function buildWordDocFilename(wordContext) {
  const who = `${wordContext.RANK_SHORT} ${wordContext.INIT_SURNAME}`.trim();
  const firm = wordContext.ATT_NAME || 'Attorney';
  return sanitizeFilename(`Request to attorney with fee offer (${who}) - ${firm}`) + '.docx';
}

export async function generateWordDoc(matterShort, wordContext, matters) {
  const matterDef = matters?.[matterShort];
  if (!matterDef?.docxTemplate) {
    throw new Error(`No Word template configured for matter type "${matterShort}"`);
  }
  // Cache-bust: this file is edited directly on disk between sessions, and
  // should always be read fresh rather than risk a stale cached copy.
  const response = await fetch(`${matterDef.docxTemplate}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`Failed to load ${matterDef.docxTemplate}: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  const zip = new window.PizZip(arrayBuffer);
  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '<<', end: '>>' },
    nullGetter: () => ''
  });
  doc.render(wordContext);

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
