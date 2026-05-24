import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Plus, Trash2, Save, Sparkles, Clipboard, Package } from 'lucide-react';

export default function DailyProductionForm({ t }) {
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [project, setProject] = useState('');
  const [ballMillYes, setBallMillYes] = useState(true);
  const [chargeNumber, setChargeNumber] = useState('');
  const [pvaConsumed, setPvaConsumed] = useState('');
  
  const [coloursFired, setColoursFired] = useState([]);
  
  const [consumables, setConsumables] = useState({
    boxes: '', cutPaper: '', gum: '', sheetsMade: '', 
    kraftPaper: '', stretchFilm: '', plasticBags: ''
  });

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'production_colours'), s => setColours(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u2 = onSnapshot(collection(db, 'production_sizes'), s => setSizes(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u3 = onSnapshot(collection(db, 'production_raw_materials'), s => setRawMaterials(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const addColourFired = () => {
    setColoursFired([...coloursFired, { colourId: '', sizeId: '', numberOfCharges: '', totalWeight: '' }]);
  };

  const updateColourFired = (idx, field, value) => {
    const updated = [...coloursFired];
    updated[idx][field] = value;
    setColoursFired(updated);
  };

  const removeColourFired = (idx) => {
    const updated = [...coloursFired];
    updated.splice(idx, 1);
    setColoursFired(updated);
  };

  // Calculate Auto Consumption based on colours fired
  const calculateRawMaterialConsumption = () => {
    const consumptionMap = {};
    coloursFired.forEach(cf => {
      if (!cf.colourId || !cf.totalWeight) return;
      const colour = colours.find(c => c.id === cf.colourId);
      if (!colour || !colour.recipe) return;
      
      const weight = parseFloat(cf.totalWeight);
      colour.recipe.forEach(ing => {
        const amount = (weight * ing.percentage) / 100;
        if (!consumptionMap[ing.rawMaterialId]) {
          consumptionMap[ing.rawMaterialId] = { name: ing.name, total: 0 };
        }
        consumptionMap[ing.rawMaterialId].total += amount;
      });
    });
    return Object.values(consumptionMap);
  };

  const calculatedRMs = calculateRawMaterialConsumption();

  const handleSubmit = async () => {
    if (coloursFired.length === 0) return alert('Please add at least one colour fired.');
    
    // Snapshot the current rates for historical accuracy
    const rmSnapshots = rawMaterials.reduce((acc, rm) => {
      acc[rm.id] = { currentRate: rm.currentRate, unit: rm.unit, name: rm.name };
      return acc;
    }, {});

    const payload = {
      date,
      project,
      ballMill: { charge1300: ballMillYes, chargeNumber },
      pvaConsumed: parseFloat(pvaConsumed) || 0,
      coloursFired: coloursFired.map(cf => {
        const col = colours.find(c => c.id === cf.colourId);
        return {
          ...cf,
          colourName: col?.name || '',
          recipeSnapshot: col?.recipe || [] // Snapshot recipe
        };
      }),
      calculatedRawMaterials: calculatedRMs,
      consumables: {
        boxes: parseFloat(consumables.boxes) || 0,
        cutPaper: parseFloat(consumables.cutPaper) || 0,
        gum: parseFloat(consumables.gum) || 0,
        sheetsMade: parseFloat(consumables.sheetsMade) || 0,
        kraftPaper: parseFloat(consumables.kraftPaper) || 0,
        stretchFilm: parseFloat(consumables.stretchFilm) || 0,
        plasticBags: parseFloat(consumables.plasticBags) || 0,
      },
      rmRatesSnapshot: rmSnapshots,
      status: 'PENDING_APPROVAL', // Needs Admin check
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'dailyProductions'), payload);
      alert('Daily Production Submitted for Approval!');
      // Reset form
      setColoursFired([]);
      setChargeNumber('');
      setProject('');
      setPvaConsumed('');
      setConsumables({boxes:'', cutPaper:'', gum:'', sheetsMade:'', kraftPaper:'', stretchFilm:'', plasticBags:''});
    } catch (e) {
      console.error(e);
      alert('Failed to submit.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clipboard size={24} />
        </div>
        <h2 style={{ color: '#818cf8', margin: 0, fontSize: '1.5rem' }}>Daily Production Log</h2>
      </div>
      
      {/* HEADER SECTION CARD */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--surface-high)' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#818cf8', marginBottom: '8px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>Log Details</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Project Name</label>
            <input type="text" placeholder="e.g. Project Alpha" value={project} onChange={e => setProject(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>PVA Consumed (Kgs)</label>
          <input type="number" step="0.1" placeholder="0.0" value={pvaConsumed} onChange={e => setPvaConsumed(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Ball Mill Charge (1300kgs)</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={() => setBallMillYes(true)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: ballMillYes ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--surface-high)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              Yes
            </button>
            <button 
              type="button" 
              onClick={() => setBallMillYes(false)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: !ballMillYes ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--surface-high)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              No
            </button>
          </div>
          {ballMillYes && (
            <input 
              placeholder="Enter Charge Number" 
              value={chargeNumber} 
              onChange={e => setChargeNumber(e.target.value)} 
              style={{ marginTop: '6px' }}
            />
          )}
        </div>
      </div>

      {/* COLOURS FIRED SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--on-background)', margin: 0 }}>Colours Fired</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>({coloursFired.length} Fired)</span>
      </div>

      {coloursFired.map((cf, idx) => (
        <div key={idx} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', border: '1px solid var(--surface-high)', position: 'relative', paddingTop: '40px' }}>
          <button 
            type="button" 
            onClick={() => removeColourFired(idx)} 
            style={{ 
              position: 'absolute', 
              top: '12px', 
              right: '12px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: 'none', 
              color: 'var(--error)', 
              borderRadius: '8px', 
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={16} />
          </button>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Colour</label>
            <select value={cf.colourId} onChange={e => updateColourFired(idx, 'colourId', e.target.value)}>
              <option value="">Select Colour</option>
              {colours.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Size</label>
            <select value={cf.sizeId} onChange={e => updateColourFired(idx, 'sizeId', e.target.value)}>
              <option value="">Select Size</option>
              {sizes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Charges</label>
            <input type="number" placeholder="No. of Charges" value={cf.numberOfCharges} onChange={e => updateColourFired(idx, 'numberOfCharges', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Total Wt (Kg)</label>
            <input type="number" step="0.1" placeholder="Weight" value={cf.totalWeight} onChange={e => updateColourFired(idx, 'totalWeight', e.target.value)} />
          </div>
        </div>
      ))}

      <button 
        onClick={addColourFired} 
        style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%', 
          marginBottom: '24px', 
          padding: '14px', 
          borderRadius: '12px', 
          background: 'rgba(99, 102, 241, 0.1)', 
          color: '#818cf8', 
          border: 'none', 
          cursor: 'pointer',
          fontWeight: 'bold',
          fontFamily: 'var(--font-display)',
          transition: 'all 0.2s ease'
        }}
      >
        <Plus size={18} /> Add Colour Fired
      </button>

      {/* AUTO CALCULATED RAW MATERIALS */}
      {calculatedRMs.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed #6366f1', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#818cf8' }}>
            <Sparkles size={18} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Live Consumption Estimation</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            {calculatedRMs.map((rm, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-high)', paddingBottom: '6px', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--on-surface)' }}>{rm.name}</span>
                <strong style={{ color: '#818cf8' }}>{rm.total.toFixed(3)} Kgs</strong>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '12px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
            *Estimated based on Colour Recipe master configurations.
          </p>
        </div>
      )}

      {/* CONSUMABLES SECTION */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--surface-high)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', marginBottom: '4px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
          <Package size={18} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Consumables & Packaging</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          {Object.keys(consumables).map(key => (
            <div key={key}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize', fontWeight: '600' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input 
                type="number" step="0.1"
                placeholder="0"
                value={consumables[key]} 
                onChange={e => setConsumables({...consumables, [key]: e.target.value})} 
              />
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSubmit} 
        style={{ 
          width: '100%', 
          padding: '16px', 
          fontSize: '1.1rem', 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '8px', 
          alignItems: 'center', 
          borderRadius: '16px', 
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: 'white',
          border: 'none',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)',
          transition: 'all 0.2s ease'
        }}
      >
        <Save size={20} /> Submit for Approval
      </button>
    </div>
  );
}
