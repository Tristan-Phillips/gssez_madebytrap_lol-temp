const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function buildResult(day, month, year, raw) {
  if (month < 1 || month > 12) return { raw, formatted: '', valid: false };
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return { raw, formatted: '', valid: false };
  return { raw, formatted: `${day} ${MONTHS[month - 1]} ${year}`, valid: true, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function parseDate(input) {
  const raw = (input || '').trim();
  if (!raw) return { raw, formatted: '', valid: false };

  const digits = raw.replace(/\D/g, '');
  if (digits.length === raw.length) {
    const currentYear = new Date().getFullYear();
    if (digits.length === 4) {
      return buildResult(parseInt(digits.slice(0, 2), 10), parseInt(digits.slice(2, 4), 10), currentYear, raw);
    }
    if (digits.length === 6) {
      const yy = parseInt(digits.slice(4, 6), 10);
      return buildResult(parseInt(digits.slice(0, 2), 10), parseInt(digits.slice(2, 4), 10), 2000 + yy, raw);
    }
    if (digits.length === 8) {
      return buildResult(parseInt(digits.slice(0, 2), 10), parseInt(digits.slice(2, 4), 10), parseInt(digits.slice(4, 8), 10), raw);
    }
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return buildResult(parseInt(isoMatch[3], 10), parseInt(isoMatch[2], 10), parseInt(isoMatch[1], 10), raw);
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return buildResult(d.getDate(), d.getMonth() + 1, d.getFullYear(), raw);
  }

  return { raw, formatted: '', valid: false };
}

export function formatIso(iso) {
  if (!iso) return { raw: '', formatted: '', valid: false };
  const [y, m, d] = iso.split('-').map(Number);
  return buildResult(d, m, y, iso);
}
