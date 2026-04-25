function getLocale(language) {
  if (language === 'hi') return 'hi-IN';
  if (language === 'gu') return 'gu-IN';
  return 'en-IN';
}

function toDate(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function formatTime(ts, language = 'en') {
  const date = toDate(ts);
  if (!date) return '';
  return date.toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' });
}
