import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { CheckCircle, Clock, Trash2, Calendar, FileText, RefreshCw } from 'lucide-react';

export default function ProductionReports({ t, filterStatus }) {
  const [productions, setProductions] = useState([]);
  const [recalculatingId, setRecalculatingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'dailyProductions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setProductions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const approveProduction = async (id) => {
    if (confirm('Approve this daily production? This will finalize the consumption.')) {
      await updateDoc(doc(db, 'dailyProductions', id), { status: 'APPROVED' });
    }
  };

  const deleteProduction = async (id) => {
    if (confirm('Are you sure you want to delete this production log?')) {
      await deleteDoc(doc(db, 'dailyProductions', id));
    }
  };

  const recalculateProduction = async (prod) => {
    setRecalculatingId(prod.id);
    try {
      // 1. Fetch colours master list
      const coloursSnap = await getDocs(collection(db, 'production_colours'));
      const coloursMap = new Map();
      coloursSnap.forEach(d => coloursMap.set(d.id, d.data()));

      // 2. Fetch raw materials master list
      const rmSnap = await getDocs(collection(db, 'production_raw_materials'));
      const rmMap = new Map();
      rmSnap.forEach(d => rmMap.set(d.id, d.data()));

      const coloursFired = prod.coloursFired || [];
      const validColoursFired = coloursFired.filter(cf => cf.colourId && cf.totalWeight);
      
      if (validColoursFired.length === 0) {
        alert('No valid colours fired in this log to recalculate.');
        setRecalculatingId(null);
        return;
      }

      // Calculate aggregated raw material consumption
      const consumptionMap = {};
      
      validColoursFired.forEach(cf => {
        // Find recipe either from snapshot or from live colours master
        let recipe = cf.recipeSnapshot || [];
        if (recipe.length === 0) {
          const liveCol = coloursMap.get(cf.colourId);
          recipe = liveCol?.recipe || [];
        }
        
        if (recipe.length === 0) {
          return;
        }
        
        const weight = parseFloat(cf.totalWeight) || 0;
        recipe.forEach(ing => {
          const amount = (weight * ing.percentage) / 100;
          if (!consumptionMap[ing.rawMaterialId]) {
            let name = ing.name;
            if (!name) {
              const liveRm = rmMap.get(ing.rawMaterialId);
              name = liveRm?.name || 'Unknown Material';
            }
            consumptionMap[ing.rawMaterialId] = {
              rawMaterialId: ing.rawMaterialId,
              name: name,
              total: 0
            };
          }
          consumptionMap[ing.rawMaterialId].total += amount;
        });
      });
      
      const correctedList = Object.values(consumptionMap).filter(rm => rm.total > 0);
      
      if (correctedList.length === 0) {
        alert('Recalculation yielded no raw material consumption.');
        setRecalculatingId(null);
        return;
      }

      // Update in Firestore
      await updateDoc(doc(db, 'dailyProductions', prod.id), {
        calculatedRawMaterials: correctedList
      });

      alert('Successfully recalculated and updated raw material consumption!');
    } catch (err) {
      console.error(err);
      alert('Failed to recalculate: ' + err.message);
    } finally {
      setRecalculatingId(null);
    }
  };

  // Filter based on prop if provided
  const filtered = filterStatus 
    ? productions.filter(p => p.status === filterStatus)
    : productions;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={24} />
        </div>
        <h2 style={{ color: '#818cf8', margin: 0, fontSize: '1.5rem' }}>
          {filterStatus === 'PENDING_APPROVAL' ? 'Pending Reviews' : 'Production History'}
        </h2>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)', border: '1px solid var(--surface-high)' }}>
          <Calendar size={48} style={{ opacity: 0.2, marginBottom: '12px', color: '#818cf8' }} />
          <p>No {filterStatus === 'PENDING_APPROVAL' ? 'pending reviews' : 'production history'} found.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.map(prod => (
          <div key={prod.id} className="card" style={{ 
            border: `1px solid ${prod.status === 'APPROVED' ? 'rgba(79, 70, 229, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, 
            position: 'relative'
          }}>
            {/* Status Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px' }}>Date Logged</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', color: 'var(--on-background)' }}>{prod.date}</h4>
                {prod.project && (
                  <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.8rem', background: 'var(--surface-high)', padding: '2px 8px', borderRadius: '6px', color: '#818cf8' }}>
                    Project: {prod.project}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {prod.status === 'PENDING_APPROVAL' ? (
                  <>
                    <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '8px' }}>
                      <Clock size={14} /> PENDING
                    </span>
                    <button 
                      onClick={() => approveProduction(prod.id)} 
                      style={{ 
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                      }}
                    >
                      Approve
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 'bold', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 10px', borderRadius: '8px' }}>
                    <CheckCircle size={14} /> APPROVED
                  </span>
                )}
                
                <button 
                  onClick={() => recalculateProduction(prod)} 
                  disabled={recalculatingId === prod.id}
                  style={{ 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    border: 'none', 
                    color: '#818cf8', 
                    borderRadius: '8px', 
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: recalculatingId === prod.id ? 0.6 : 1
                  }}
                  title="Recalculate Consumption"
                  aria-label="Recalculate Consumption"
                >
                  <RefreshCw size={16} className={recalculatingId === prod.id ? "spin-animation" : ""} />
                </button>

                <button 
                  onClick={() => deleteProduction(prod.id)} 
                  style={{ 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: 'none', 
                    color: 'var(--error)', 
                    borderRadius: '8px', 
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  aria-label="Delete Record"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Core Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--surface-high)', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Ball Mill Charge</span>
                <strong style={{ color: 'var(--on-surface)' }}>
                  {prod.ballMill?.charge1300 ? `Yes (#${prod.ballMill.chargeNumber})` : 'No'}
                </strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>PVA Consumed</span>
                <strong style={{ color: 'var(--on-surface)' }}>{prod.pvaConsumed} Kgs</strong>
              </div>
            </div>

            {/* Colours Fired */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold', marginBottom: '6px' }}>Colours Fired</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(prod.coloursFired || []).filter(cf => cf.colourId && cf.totalWeight).map((cf, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid var(--surface-high)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--on-surface)' }}>{cf.colourName || 'Unknown Colour'}</span>
                    <span style={{ color: 'var(--on-surface-variant)' }}>
                      <strong>{cf.totalWeight}kg</strong> ({cf.numberOfCharges} chgs)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculated Consumption */}
            <div style={{ borderTop: '1px solid var(--surface-high)', paddingTop: '12px' }}>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold', marginBottom: '8px' }}>
                Calculated Raw Material Consumption
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(prod.calculatedRawMaterials || []).map((rm, idx) => (
                  <span key={idx} style={{ background: 'var(--surface-high)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--on-surface)' }}>
                    {rm.name}: <strong style={{ color: '#818cf8' }}>{rm.total?.toFixed(3)}kg</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Consumables & Packaging */}
            {prod.consumables && Object.values(prod.consumables).some(v => v > 0) && (
              <div style={{ borderTop: '1px solid var(--surface-high)', paddingTop: '12px', marginTop: '12px' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold', marginBottom: '8px' }}>
                  Consumables & Packaging
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(prod.consumables)
                    .filter(([_, qty]) => qty > 0)
                    .map(([key, qty]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').trim();
                      return (
                        <span key={key} style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--on-surface)', textTransform: 'capitalize' }}>
                          {label}: <strong style={{ color: '#818cf8' }}>{qty}</strong>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
