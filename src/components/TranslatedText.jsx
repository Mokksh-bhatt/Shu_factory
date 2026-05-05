import { useState, useEffect, memo } from 'react';
import { translateText } from '../utils/translate';

// Renders text with auto-translation based on user's selected language
const TranslatedText = memo(function TranslatedText({ text, targetLang, style }) {
  const [translated, setTranslated] = useState(text);
  const [isTranslated, setIsTranslated] = useState(false);

  useEffect(() => {
    if (!text || !targetLang) return;

    let cancelled = false;
    translateText(text, targetLang).then(result => {
      if (cancelled) return;
      if (result !== text) {
        setTranslated(result);
        setIsTranslated(true);
      } else {
        setTranslated(text);
        setIsTranslated(false);
      }
    });

    return () => { cancelled = true; };
  }, [text, targetLang]);

  return (
    <span style={style}>
      {translated}
      {isTranslated && (
        <span style={{
          display: 'block', fontSize: '0.72rem', opacity: 0.55,
          fontStyle: 'italic', marginTop: '2px',
        }}>
          Original: {text}
        </span>
      )}
    </span>
  );
});

export default TranslatedText;
