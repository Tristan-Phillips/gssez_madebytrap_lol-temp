import { parseDate } from './dateParse.js';

// Sample pools for the Settings "Randomize all values" button — testing
// convenience only, never shown to end users or used in real rendering.
const INITIALS = ['M.V.', 'T.', 'J.S.', 'S.V.', 'L.', 'K.R.', 'A.B.', 'N.P.'];
const SURNAMES = ['Kotzee', 'Mhlongo', 'Makodi', 'Motapane', 'Didishe', 'Nkosi', 'Van Wyk', 'Botha', 'Dlamini'];
const LOCATIONS = ['Kroonstad', 'Bloemfontein', 'Pretoria', 'Botshabelo', 'Polokwane', 'Nelspruit', 'Kimberley', 'Upington'];
const FIRMS = ['Lovius Block Inc', 'Smit & Van Wyk Attorneys', 'Botha Massyn Inc', 'Naude Attorneys', 'Kruger & Partners'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomDropdownValue(def) {
  const real = def.options.filter((o) => !o.custom);
  const opt = pick(real);
  return { label: opt.label, short: opt.short || opt.label };
}

function randomDateValue() {
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const year = new Date().getFullYear();
  return parseDate(`${day}${month}${year}`);
}

function randomTextValue(key) {
  switch (key) {
    case 'INIT_SURNAME':
      return `${pick(INITIALS)} ${pick(SURNAMES)}`;
    case 'LOCATION':
      return pick(LOCATIONS);
    case 'MEMBER_CONTACT':
      return `08${Math.floor(Math.random() * 10)} ${randomDigits(3)} ${randomDigits(4)}`;
    case 'ATT_NAME':
      return pick(FIRMS);
    case 'MATTER_FILE_CODE':
      return String(1 + Math.floor(Math.random() * 300));
    default:
      return `Test ${randomDigits(3)}`;
  }
}

export function buildRandomInputs(variables) {
  const inputs = {};
  for (const def of variables) {
    if (def.type === 'dropdown') inputs[def.key] = randomDropdownValue(def);
    else if (def.type === 'date') inputs[def.key] = randomDateValue();
    else inputs[def.key] = randomTextValue(def.key);
  }
  return inputs;
}

export function buildRandomCheckboxState(checkboxes) {
  const state = {};
  for (const def of checkboxes) {
    state[def.id] = Math.random() < 0.5;
  }
  return state;
}
