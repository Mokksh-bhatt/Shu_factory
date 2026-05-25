import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', style = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Find the label of the currently selected option
  const selectedOption = options.find(opt => opt.value === value);
  
  // Filter options based on search query
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

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
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={selectedOption ? selectedOption.label : placeholder}
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
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          marginTop: '4px',
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
