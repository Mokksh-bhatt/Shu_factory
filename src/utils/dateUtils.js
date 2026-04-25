export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function dateKey(value) {
  const date = toDate(value);
  if (!date) return 'unknown';
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isInDateRange(value, range) {
  if (!range || range === 'all') return true;
  const date = toDate(value);
  if (!date) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'today') {
    return date >= startOfToday;
  }

  if (range === '7d') {
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    return date >= sevenDaysAgo;
  }

  if (range === '30d') {
    const thirtyDaysAgo = new Date(startOfToday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    return date >= thirtyDaysAgo;
  }

  return true;
}

export function formatDateMarker(value, language, t) {
  const date = toDate(value);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((today - thatDay) / (24 * 60 * 60 * 1000));

  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');

  const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function groupByDate(items, getValue) {
  const groups = [];
  let currentKey = null;

  for (const item of items) {
    const raw = getValue(item);
    const key = dateKey(raw);
    if (key !== currentKey) {
      groups.push({ key, value: raw, items: [item] });
      currentKey = key;
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }

  return groups;
}
