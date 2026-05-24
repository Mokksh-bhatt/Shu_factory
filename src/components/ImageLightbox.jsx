import { useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '0', margin: '0'
      }}
    >
      {/* Background click to close */}
      <div 
        style={{ position: 'absolute', inset: 0, zIndex: 0 }} 
        onClick={onClose} 
      />

      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: '44px', height: '44px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', cursor: 'pointer', zIndex: 10
        }}
      >
        <X size={26} />
      </button>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div style={{ 
                position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', 
                display: 'flex', gap: '10px', zIndex: 10, background: 'rgba(0,0,0,0.6)', 
                padding: '8px 16px', borderRadius: '30px' 
              }}>
                <button onClick={() => zoomIn()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px' }}><ZoomIn size={24} /></button>
                <button onClick={() => zoomOut()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px' }}><ZoomOut size={24} /></button>
                <button onClick={() => resetTransform()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px' }}><Maximize size={24} /></button>
              </div>
              
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                <img
                  src={src}
                  alt="Full view"
                  style={{
                    maxWidth: '100vw', maxHeight: '100vh',
                    objectFit: 'contain',
                    pointerEvents: 'auto'
                  }}
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
