import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', style = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef(null);

// Levenshtein distance helper for fuzzy matching
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

  // Sort options alphabetically by default (using numeric and base sensitivity)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => 
      (a.label || '').localeCompare(b.label || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [options]);

  // Find the label of the currently selected option
  const selectedOption = sortedOptions.find(opt => opt.value === value);
  
  // Filter options based on search query with smart matching
  const filteredOptions = useMemo(() => {
    if (!search.trim() || search === selectedOption?.label) return sortedOptions;
    
    const normalizePhonetics = (s) => s
      .replace(/g/g, 'j')
      .replace(/y/g, 'i')
      .replace(/ph/g, 'f')
      .replace(/c/g, 's')
      .replace(/x/g, 'ks')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/tt/g, 't')
      .replace(/pp/g, 'p')
      .replace(/ll/g, 'l')
      .replace(/dd/g, 'd')
      .replace(/mm/g, 'm')
      .replace(/nn/g, 'n')
      .replace(/ff/g, 'f')
      .replace(/ss/g, 's')
      .replace(/rr/g, 'r')
      .replace(/bb/g, 'b');

    const query = search.toLowerCase().trim();
    const cleanQuery = query.replace(/[^a-z0-9]/g, '');
    const queryWords = query.split(/[\s\-_,./()]+/).filter(Boolean).map(w => w.replace(/[^a-z0-9]/g, ''));
    
    if (queryWords.length === 0) return sortedOptions;

    return sortedOptions.filter(opt => {
      const label = (opt.label || '').toLowerCase();
      const cleanLabel = label.replace(/[^a-z0-9]/g, '');
      
      // 1. Standard includes match
      if (label.includes(query)) return true;
      if (cleanLabel.includes(cleanQuery)) return true;
      
      // 2. Word-based fuzzy/phonetic matching
      const labelWords = label.split(/[\s\-_,./()]+/).filter(Boolean).map(w => w.replace(/[^a-z0-9]/g, ''));
      
      return queryWords.every(qWord => {
        if (qWord.length === 0) return true;
        
        // Substring / prefix check
        const hasSubstringMatch = labelWords.some(lWord => lWord.includes(qWord) || qWord.includes(lWord));
        if (hasSubstringMatch) return true;
        
        // Phonetic check
        const normQ = normalizePhonetics(qWord);
        const hasPhoneticMatch = labelWords.some(lWord => {
          const normL = normalizePhonetics(lWord);
          return normL.includes(normQ) || normQ.includes(normL);
        });
        if (hasPhoneticMatch) return true;
        
        // Levenshtein fuzzy check
        const hasFuzzyMatch = labelWords.some(lWord => {
          if (Math.abs(lWord.length - qWord.length) > 2) return false;
          const dist = levenshteinDistance(lWord, qWord);
          const threshold = qWord.length > 4 ? 2 : 1;
          return dist <= threshold;
        });
        return hasFuzzyMatch;
      });
    });
  }, [sortedOptions, search, selectedOption]);

  useEffect(() => {
    // Handle click outside to close dropdown
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update input search term when option changes
  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    }
  }, [value, isOpen, selectedOption]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearch(''); // Clear search on focus so user can see all options immediately
    
    // Check space below to determine if dropdown should open upwards
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If less than 250px below and more space above, open upwards
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }

      // Smooth scroll the input into view, particularly useful on mobile when keyboard opens
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={selectedOption ? selectedOption.label : (placeholder || 'Type to search...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={handleFocus}
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--surface-high)',
            background: 'var(--surface)',
            color: 'var(--on-surface)',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
        />
        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '4px', pointerEvents: 'none', color: 'var(--on-surface-variant)', opacity: 0.7 }}>
          {isOpen ? <Search size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          ...(dropUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'var(--surface)',
          border: '1px solid var(--surface-high)',
          borderRadius: '12px',
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          animation: 'fadeIn 0.15s ease-in-out'
        }}>
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px', color: 'var(--on-surface-variant)', fontSize: '0.9rem', textAlign: 'center' }}>
              No matches found
            </div>
          ) : (
            filteredOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  color: opt.value === value ? 'white' : 'var(--on-surface)',
                  background: opt.value === value 
                    ? 'linear-gradient(135deg, #4f46e5, #6366f1)' 
                    : 'transparent',
                  fontSize: '0.95rem',
                  transition: 'background 0.1s ease',
                  borderBottom: '1px solid var(--surface-high)'
                }}
                onMouseEnter={e => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'var(--surface-high)';
                  }
                }}
                onMouseLeave={e => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
