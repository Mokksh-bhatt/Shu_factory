// Free Google Translate proxy — no API key needed
// Supports auto-detect source language

const LANG_CODES = {
  en: 'en',
  hi: 'hi',
  gu: 'gu',
};

const cache = new Map();

export async function translateText(text, targetLang) {
  if (!text || !targetLang) return text;

  const target = LANG_CODES[targetLang] || targetLang;
  const cacheKey = `${text.slice(0, 100)}__${target}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return text;

    const data = await res.json();
    // data[0] is an array of [translatedSegment, originalSegment, ...]
    const translated = data[0]?.map(seg => seg[0]).join('') || text;
    const detectedLang = data[2] || 'unknown';

    // Don't cache if source = target (no translation needed)
    if (detectedLang === target) {
      cache.set(cacheKey, text);
      return text;
    }

    cache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}
