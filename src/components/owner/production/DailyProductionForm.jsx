import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Plus, Trash2, Save, Sparkles, Clipboard, Package } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';

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
  const [actualRMs, setActualRMs] = useState({}); // Recipe overrides
  const [extraRMs, setExtraRMs] = useState([]); // Manual additions
  
  // Real-time suggestions state derived from recent logs
  const [recentProjects, setRecentProjects] = useState([]);
  const [nextSuggestedCharge, setNextSuggestedCharge] = useState('');
  const [frequentFires, setFrequentFires] = useState([]);

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

  // Fetch recent log history to extract smart suggestions
  useEffect(() => {
    const qLogs = query(collection(db, 'dailyProductions'), orderBy('createdAt', 'desc'), limit(30));
    const unsubLogs = onSnapshot(qLogs, snap => {
      const logs = snap.docs.map(d => d.data());
      
      // 1. Extract unique recent projects
      const uniqueProjects = Array.from(new Set(logs.map(l => l.project).filter(Boolean))).slice(0, 4);
      setRecentProjects(uniqueProjects);
      
      // 2. Predict next sequential ball mill charge number
      const lastChargeLog = logs.find(l => l.ballMill?.chargeNumber);
      if (lastChargeLog) {
        const lastNum = lastChargeLog.ballMill.chargeNumber;
        const digitsMatch = lastNum.match(/\d+/);
        if (digitsMatch) {
          const num = parseInt(digitsMatch[0], 10);
          const nextSuggested = lastNum.replace(digitsMatch[0], num + 1);
          setNextSuggestedCharge(nextSuggested);
        } else {
          setNextSuggestedCharge('');
        }
      } else {
        setNextSuggestedCharge('');
      }
      
      // 3. Find most frequent colour + size configurations
      const counts = {};
      logs.forEach(log => {
        if (log.coloursFired) {
          log.coloursFired.forEach(cf => {
            if (cf.colourId && cf.sizeId) {
              const key = `${cf.colourId}_${cf.sizeId}`;
              counts[key] = (counts[key] || 0) + 1;
            }
          });
        }
      });
      
      const sortedFires = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => {
          const [colourId, sizeId] = key.split('_');
          return { colourId, sizeId };
        });
      setFrequentFires(sortedFires);
    });
    return unsubLogs;
  }, [colours, sizes]);

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
          consumptionMap[ing.rawMaterialId] = { rawMaterialId: ing.rawMaterialId, name: ing.name, total: 0 };
        }
        consumptionMap[ing.rawMaterialId].total += amount;
      });
    });
    return Object.values(consumptionMap);
  };

  const calculatedRMs = calculateRawMaterialConsumption();

  const handleActualRMChange = (rmId, value) => {
    setActualRMs({ ...actualRMs, [rmId]: value });
  };

  const addExtraRM = () => {
    setExtraRMs([...extraRMs, { rawMaterialId: '', total: '' }]);
  };

  const updateExtraRM = (idx, field, value) => {
    const updated = [...extraRMs];
    updated[idx][field] = value;
    setExtraRMs(updated);
  };

  const removeExtraRM = (idx) => {
    const updated = [...extraRMs];
    updated.splice(idx, 1);
    setExtraRMs(updated);
  };

  const handleSubmit = async () => {
    if (coloursFired.length === 0) return alert('Please add at least one colour fired.');
    
    // Compile final raw materials list (merging actual overrides and extra manuals)
    const finalRawMaterialsList = [
      ...calculatedRMs.map(rm => ({
        rawMaterialId: rm.rawMaterialId,
        name: rm.name,
        total: parseFloat(actualRMs[rm.rawMaterialId] !== undefined ? actualRMs[rm.rawMaterialId] : rm.total) || 0
      })),
      ...extraRMs.map(e => {
        const rm = rawMaterials.find(r => r.id === e.rawMaterialId);
        return {
          rawMaterialId: e.rawMaterialId,
          name: rm?.name || 'Manual Material',
          total: parseFloat(e.total) || 0
        };
      }).filter(e => e.rawMaterialId && e.total > 0)
    ];

    // Snapshot the current rates for historical accuracy
    const rmSnapshots = rawMaterials.reduce((acc, rm) => {
      acc[rm.id] = { currentRate: rm.currentRate || 0, unit: rm.unit || 'Kgs', name: rm.name };
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
          recipeSnapshot: col?.recipe || []
        };
      }),
      calculatedRawMaterials: finalRawMaterialsList,
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
      status: 'PENDING_APPROVAL',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'dailyProductions'), payload);
      alert('Daily Production Log Submitted for Approval!');
      // Reset form
      setColoursFired([]);
      setActualRMs({});
      setExtraRMs([]);
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Project Name</label>
            <input type="text" placeholder="e.g. Project Alpha" value={project} onChange={e => setProject(e.target.value)} style={{ width: '100%' }} />
            {recentProjects.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center' }}>Recent:</span>
                {recentProjects.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setProject(p)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--surface-high)',
                      background: 'rgba(99, 102, 241, 0.05)',
                      color: '#818cf8',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>PVA Consumed (Kgs)</label>
          <input type="number" step="0.1" placeholder="0.0" value={pvaConsumed} onChange={e => setPvaConsumed(e.target.value)} style={{ width: '100%' }} />
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
            <div style={{ marginTop: '6px' }}>
              <input 
                placeholder="Enter Charge Number" 
                value={chargeNumber} 
                onChange={e => setChargeNumber(e.target.value)} 
                style={{ width: '100%' }}
              />
              {nextSuggestedCharge && (
                <div style={{ marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setChargeNumber(nextSuggestedCharge)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--surface-high)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: '#10b981',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Suggest Next: {nextSuggestedCharge}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COLOURS FIRED SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--on-background)', margin: 0 }}>Colours Fired</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>({coloursFired.length} Fired)</span>
      </div>

      {/* Popular Configurations Quick-Add Pills */}
      {frequentFires.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', background: 'var(--surface-high)', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Quick Add Popular Configurations:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {frequentFires.map((f, i) => {
              const col = colours.find(c => c.id === f.colourId);
              const sz = sizes.find(s => s.id === f.sizeId);
              if (!col || !sz) return null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setColoursFired([...coloursFired, { colourId: f.colourId, sizeId: f.sizeId, numberOfCharges: '1', totalWeight: '' }])}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--surface-high)',
                    background: 'var(--surface)',
                    color: 'var(--on-surface)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#818cf8'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--surface-high)'}
                >
                  + {col.name} ({sz.name})
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <Trash2 size={16} />
          </button>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Colour</label>
            <SearchableSelect
              options={colours.map(c => ({ value: c.id, label: `${c.name} (${c.code || '-'})` }))}
              value={cf.colourId}
              onChange={val => updateColourFired(idx, 'colourId', val)}
              placeholder="Search Colour..."
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Size</label>
            <SearchableSelect
              options={sizes.map(s => ({ value: s.id, label: `${s.name} (${s.code || '-'})` }))}
              value={cf.sizeId}
              onChange={val => updateColourFired(idx, 'sizeId', val)}
              placeholder="Search Size..."
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Charges</label>
            <input type="number" placeholder="No. of Charges" value={cf.numberOfCharges} onChange={e => updateColourFired(idx, 'numberOfCharges', e.target.value)} style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Total Wt (Kg)</label>
            <input type="number" step="0.1" placeholder="Weight" value={cf.totalWeight} onChange={e => updateColourFired(idx, 'totalWeight', e.target.value)} style={{ width: '100%' }} />
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

      {/* DETAILED INTERACTIVE RAW MATERIALS LOGS */}
      {(calculatedRMs.length > 0 || extraRMs.length > 0) && (
        <div className="card" style={{ marginBottom: '24px', background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed #6366f1', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#818cf8' }}>
            <Sparkles size={18} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Raw Material Consumption Adjustments</h4>
          </div>
          
          {/* Estimated / Autocalculated */}
          {calculatedRMs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Recipe Estimates (Override if needed)</span>
              {calculatedRMs.map((rm, i) => {
                const actualVal = actualRMs[rm.rawMaterialId] !== undefined ? actualRMs[rm.rawMaterialId] : rm.total.toFixed(3);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--on-surface)', fontSize: '0.95rem', fontWeight: '600' }}>{rm.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Estimated: {rm.total.toFixed(3)} Kgs</div>
                    </div>
                    <div style={{ width: '140px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="number" 
                        step="0.001" 
                        value={actualVal} 
                        onChange={e => handleActualRMChange(rm.rawMaterialId, e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.9rem', textAlign: 'right', width: '100%' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>Kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extra Manual Raw Materials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: calculatedRMs.length > 0 ? '1px dashed var(--surface-high)' : 'none', paddingTop: calculatedRMs.length > 0 ? '16px' : '0' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Extra Materials Logged (Unrelated to Recipes)</span>
            
            {extraRMs.map((e, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--surface)', padding: '10px', borderRadius: '10px', border: '1px solid var(--surface-high)' }}>
                <div style={{ flex: 2 }}>
                  <SearchableSelect
                    options={rawMaterials.map(rm => ({ value: rm.id, label: `${rm.name} (${rm.code || '-'})` }))}
                    value={e.rawMaterialId}
                    onChange={val => updateExtraRM(idx, 'rawMaterialId', val)}
                    placeholder="Search material..."
                  />
                </div>
                <div style={{ flex: 1.2, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Qty"
                    value={e.total}
                    onChange={val => updateExtraRM(idx, 'total', val.target.value)}
                    style={{ padding: '8px', fontSize: '0.9rem', textAlign: 'right', width: '100%' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Kg</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => removeExtraRM(idx)}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addExtraRM}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.08)',
                color: '#818cf8',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} /> Log Extra Material Used
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '16px', fontStyle: 'italic', margin: '16px 0 0 0' }}>
            *Recipe estimates automatically calculate, but you have 100% control to adjust or manually log materials.
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
                style={{ width: '100%' }}
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
