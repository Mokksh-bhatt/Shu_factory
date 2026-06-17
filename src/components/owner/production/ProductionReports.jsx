import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { CheckCircle, Clock, Trash2, Calendar, FileText, RefreshCw, Edit, Save, X, Plus, Sparkles } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';

export default function ProductionReports({ t, filterStatus }) {
  const [productions, setProductions] = useState([]);
  const [recalculatingId, setRecalculatingId] = useState(null);
  
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  const uniqueProjectsList = useMemo(() => {
    const projs = [];
    productions.forEach(p => {
      if (p.project) projs.push(p.project.trim());
      if (p.coloursFired) {
        p.coloursFired.forEach(cf => {
          if (cf.project) projs.push(cf.project.trim());
        });
      }
    });
    const unique = Array.from(new Set(projs)).filter(Boolean);
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [productions]);

  // State for inline card editing in reviews
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    project: '',
    pvaConsumed: 0,
    ballMillCharge: false,
    ballMillNumber: '',
    coloursFired: [],
    calculatedRawMaterials: [],
    loggedConsumables: []
  });

  const getDisplayRawMaterials = (prod) => {
    return prod.calculatedRawMaterials || [];
  };

  const startEditing = (prod) => {
    setEditingId(prod.id);
    setEditForm({
      date: prod.date || '',
      project: prod.project || '',
      pvaConsumed: prod.pvaConsumed !== undefined ? prod.pvaConsumed.toString() : '0',
      ballMillCharge: !!prod.ballMill?.charge1300,
      ballMillNumber: prod.ballMill?.chargeNumber || '',
      coloursFired: prod.coloursFired ? JSON.parse(JSON.stringify(prod.coloursFired)) : [],
      calculatedRawMaterials: prod.calculatedRawMaterials
        ? prod.calculatedRawMaterials.map(rm => ({ ...rm, total: rm.total !== undefined ? rm.total.toString() : '0' }))
        : [],
      loggedConsumables: prod.loggedConsumables
        ? prod.loggedConsumables.map(lc => ({ ...lc, total: lc.total !== undefined ? lc.total.toString() : '0' }))
        : [],
      looseTilesMfgSqmtr: prod.looseTilesMfgSqmtr !== undefined ? prod.looseTilesMfgSqmtr.toString() : ''
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBallMillToggle = (val) => {
    setEditForm(prev => {
      let updatedRMs = [...prev.calculatedRawMaterials];
      const glassScrap = rawMaterials.find(r => r.name?.toLowerCase().trim() === 'glass scrap');
      const glassId = glassScrap?.id || '3DfTCP8HWkcvetXrexOW';
      const glassName = glassScrap?.name || 'Glass Scrap';
      
      const glassScrapIndex = updatedRMs.findIndex(rm => rm.rawMaterialId === glassId || rm.name?.toLowerCase().trim() === 'glass scrap');
      
      if (val) {
        if (glassScrapIndex >= 0) {
          if ((parseFloat(updatedRMs[glassScrapIndex].total) || 0) < 1300) {
            updatedRMs[glassScrapIndex].total = '1300';
          }
        } else {
          updatedRMs.push({
            rawMaterialId: glassId,
            name: glassName,
            total: '1300'
          });
        }
      } else {
        if (glassScrapIndex >= 0) {
          const currentTotal = parseFloat(updatedRMs[glassScrapIndex].total) || 0;
          const nextTotal = currentTotal - 1300;
          if (nextTotal <= 0) {
            updatedRMs.splice(glassScrapIndex, 1);
          } else {
            updatedRMs[glassScrapIndex].total = nextTotal.toString();
          }
        }
      }
      return {
        ...prev,
        ballMillCharge: val,
        calculatedRawMaterials: updatedRMs
      };
    });
  };

  const addColourFiredEdit = () => {
    setEditForm(prev => ({
      ...prev,
      coloursFired: [...prev.coloursFired, { colourId: '', sizeId: '', numberOfCharges: '1', totalWeight: '45', project: prev.project || '' }]
    }));
  };

  const removeColourFiredEdit = (idx) => {
    setEditForm(prev => {
      const updated = [...prev.coloursFired];
      updated.splice(idx, 1);
      return { ...prev, coloursFired: updated };
    });
  };

  const recalculateEditFormRMs = () => {
    const consumptionMap = {};
    
    // 1. Calculate from colours fired
    editForm.coloursFired.forEach(cf => {
      if (!cf.colourId || !cf.totalWeight) return;
      const col = colours.find(c => c.id === cf.colourId);
      if (!col) return;
      const recipe = col.recipe || [];
      const weight = parseFloat(cf.totalWeight) || 0;
      
      recipe.forEach(ing => {
        const amount = (weight * ing.percentage) / 100;
        if (!consumptionMap[ing.rawMaterialId]) {
          consumptionMap[ing.rawMaterialId] = {
            rawMaterialId: ing.rawMaterialId,
            name: ing.name || 'Unknown Material',
            total: 0
          };
        }
        consumptionMap[ing.rawMaterialId].total += amount;
      });
    });

    // 2. Add glass scrap if ball mill is active
    if (editForm.ballMillCharge) {
      const glassScrap = rawMaterials.find(r => r.name?.toLowerCase().trim() === 'glass scrap');
      const glassId = glassScrap?.id || '3DfTCP8HWkcvetXrexOW';
      const glassName = glassScrap?.name || 'Glass Scrap';
      
      if (!consumptionMap[glassId]) {
        consumptionMap[glassId] = {
          rawMaterialId: glassId,
          name: glassName,
          total: 0
        };
      }
      consumptionMap[glassId].total += 1300;
    }

    setEditForm(prev => ({
      ...prev,
      calculatedRawMaterials: Object.values(consumptionMap)
        .filter(rm => rm.total > 0)
        .map(rm => ({ ...rm, total: rm.total.toString() }))
    }));
  };

  const handleColourFiredEdit = (idx, field, val) => {
    const updated = [...editForm.coloursFired];
    updated[idx][field] = val;
    if (field === 'numberOfCharges') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        updated[idx].totalWeight = (parsed * 45).toString();
      } else {
        updated[idx].totalWeight = '';
      }
    }
    setEditForm(prev => {
      const totalWt = updated.reduce((sum, cf) => sum + (parseFloat(cf.totalWeight) || 0), 0);
      return {
        ...prev,
        coloursFired: updated,
        looseTilesMfgSqmtr: (totalWt / 10.7639).toFixed(2)
      };
    });
  };

  const handleRMEdit = (rmId, val) => {
    const updated = [...editForm.calculatedRawMaterials];
    const itemIndex = updated.findIndex(rm => rm.rawMaterialId === rmId);
    if (itemIndex >= 0) {
      updated[itemIndex].total = val;
    }
    setEditForm(prev => ({ ...prev, calculatedRawMaterials: updated }));
  };

  const handleConsumableEdit = (rmId, val) => {
    const updated = [...editForm.loggedConsumables];
    const itemIndex = updated.findIndex(lc => lc.rawMaterialId === rmId);
    if (itemIndex >= 0) {
      updated[itemIndex].total = val;
    }
    setEditForm(prev => ({ ...prev, loggedConsumables: updated }));
  };

  const saveEdits = async (id) => {
    try {
      const prod = productions.find(p => p.id === id);
      if (!prod) return;

      const isApproved = prod.status === 'APPROVED';
      const updatedPayload = {
        date: editForm.date,
        project: editForm.project,
        pvaConsumed: parseFloat(editForm.pvaConsumed) || 0,
        ballMill: {
          charge1300: editForm.ballMillCharge,
          chargeNumber: editForm.ballMillNumber
        },
        coloursFired: editForm.coloursFired.map(cf => {
          const col = colours.find(c => c.id === cf.colourId);
          const origCF = prod.coloursFired?.find(o => o.colourId === cf.colourId);
          let recipe = [];
          if (isApproved) {
            recipe = origCF?.recipeSnapshot || cf.recipeSnapshot || [];
          }
          if (recipe.length === 0) {
            recipe = col?.recipe || cf.recipeSnapshot || [];
          }
          return {
            colourId: cf.colourId || '',
            colourName: col?.name || cf.colourName || '',
            sizeId: cf.sizeId || '',
            numberOfCharges: parseFloat(cf.numberOfCharges) || 0,
            totalWeight: parseFloat(cf.totalWeight) || 0,
            project: cf.project || '',
            recipeSnapshot: recipe
          };
        }),
        calculatedRawMaterials: editForm.calculatedRawMaterials.map(rm => ({
          ...rm,
          total: parseFloat(rm.total) || 0
        })),
        looseTilesMfgSqmtr: parseFloat(editForm.looseTilesMfgSqmtr) || 0,
        loggedConsumables: editForm.loggedConsumables.map(lc => ({
          ...lc,
          total: parseFloat(lc.total) || 0
        }))
      };

      await updateDoc(doc(db, 'dailyProductions', id), updatedPayload);
      setEditingId(null);
      alert('Production log updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save changes: ' + err.message);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'dailyProductions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setProductions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCol = onSnapshot(collection(db, 'production_colours'), s => setColours(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubSz = onSnapshot(collection(db, 'production_sizes'), s => setSizes(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubRm = onSnapshot(collection(db, 'production_raw_materials'), s => setRawMaterials(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { unsub(); unsubCol(); unsubSz(); unsubRm(); };
  }, []);

  const approveProduction = async (id) => {
    if (!confirm('Approve this daily production? This will finalize the consumption.')) return;
    
    try {
      // Find the production log
      const prod = productions.find(p => p.id === id);
      if (!prod) return;

      // 1. Fetch colours master list
      const coloursSnap = await getDocs(collection(db, 'production_colours'));
      const coloursMap = new Map();
      coloursSnap.forEach(d => coloursMap.set(d.id, d.data()));

      // 2. Fetch raw materials master list
      const rmSnap = await getDocs(collection(db, 'production_raw_materials'));
      const rmMap = new Map();
      rmSnap.forEach(d => rmMap.set(d.id, d.data()));

      const coloursFired = prod.coloursFired || [];
      const updatedColoursFired = coloursFired.map(cf => {
        if (!cf.colourId) return cf;
        // For unapproved logs, we want to fetch the live recipe to freeze it today on approval
        let recipe = [];
        if (prod.status === 'APPROVED') {
          recipe = cf.recipeSnapshot || [];
        }
        if (recipe.length === 0) {
          const liveCol = coloursMap.get(cf.colourId);
          recipe = liveCol?.recipe || [];
        }
        return {
          colourId: cf.colourId || '',
          colourName: cf.colourName || '',
          sizeId: cf.sizeId || '',
          numberOfCharges: parseFloat(cf.numberOfCharges) || 0,
          totalWeight: parseFloat(cf.totalWeight) || 0,
          project: cf.project || '',
          recipeSnapshot: recipe
        };
      });

      const validColoursFired = updatedColoursFired.filter(cf => cf.colourId && cf.totalWeight);

      // Calculate final raw material consumption
      const consumptionMap = {};
      validColoursFired.forEach(cf => {
        const recipe = cf.recipeSnapshot || [];
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

      // 3. Add glass scrap consumption if ball mill charge is active
      if (prod.ballMill?.charge1300) {
        const glassScrap = Array.from(rmMap.values()).find(rm => rm.name?.toLowerCase().trim() === 'glass scrap');
        let glassId = null;
        let glassName = 'Glass Scrap';
        if (glassScrap) {
          for (const [id, rm] of rmMap.entries()) {
            if (rm.name?.toLowerCase().trim() === 'glass scrap') {
              glassId = id;
              glassName = rm.name;
              break;
            }
          }
        }
        if (glassId) {
          if (!consumptionMap[glassId]) {
            consumptionMap[glassId] = {
              rawMaterialId: glassId,
              name: glassName,
              total: 0
            };
          }
          consumptionMap[glassId].total += 1300;
        }
      }

      const finalizedRawMaterials = Object.values(consumptionMap).filter(rm => rm.total > 0);

      // Loose Tiles value calculation fallback for old logs
      const totalColWeight = updatedColoursFired.reduce((sum, cf) => sum + (parseFloat(cf.totalWeight) || 0), 0);
      const looseTilesVal = prod.looseTilesMfgSqmtr !== undefined ? prod.looseTilesMfgSqmtr : (totalColWeight / 10.7639);

      // Update document in Firestore
      await updateDoc(doc(db, 'dailyProductions', id), {
        coloursFired: updatedColoursFired,
        calculatedRawMaterials: finalizedRawMaterials,
        looseTilesMfgSqmtr: parseFloat(looseTilesVal) || 0,
        status: 'APPROVED',
        approvedAt: new Date()
      });

      alert('Daily Production Log Approved and Consumption Finalized!');
    } catch (err) {
      console.error(err);
      alert('Failed to approve daily production: ' + err.message);
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
      const updatedColoursFired = coloursFired.map(cf => {
        if (!cf.colourId) return cf;
        // For unapproved logs, we want to fetch the live recipe
        let recipe = [];
        if (prod.status === 'APPROVED') {
          recipe = cf.recipeSnapshot || [];
        }
        if (recipe.length === 0) {
          const liveCol = coloursMap.get(cf.colourId);
          recipe = liveCol?.recipe || [];
        }
        return {
          colourId: cf.colourId || '',
          colourName: cf.colourName || '',
          sizeId: cf.sizeId || '',
          numberOfCharges: parseFloat(cf.numberOfCharges) || 0,
          totalWeight: parseFloat(cf.totalWeight) || 0,
          project: cf.project || '',
          recipeSnapshot: recipe
        };
      });

      const validColoursFired = updatedColoursFired.filter(cf => cf.colourId && cf.totalWeight);
      
      if (validColoursFired.length === 0 && !prod.ballMill?.charge1300) {
        alert('No valid colours fired or active ball mill charge in this log to recalculate.');
        setRecalculatingId(null);
        return;
      }

      // Calculate aggregated raw material consumption
      const consumptionMap = {};
      
      validColoursFired.forEach(cf => {
        const recipe = cf.recipeSnapshot || [];
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

      // 3. Add glass scrap consumption if ball mill charge is active
      if (prod.ballMill?.charge1300) {
        const glassScrap = Array.from(rmMap.values()).find(rm => rm.name?.toLowerCase().trim() === 'glass scrap');
        let glassId = null;
        let glassName = 'Glass Scrap';
        if (glassScrap) {
          for (const [id, rm] of rmMap.entries()) {
            if (rm.name?.toLowerCase().trim() === 'glass scrap') {
              glassId = id;
              glassName = rm.name;
              break;
            }
          }
        }
        if (glassId) {
          if (!consumptionMap[glassId]) {
            consumptionMap[glassId] = {
              rawMaterialId: glassId,
              name: glassName,
              total: 0
            };
          }
          consumptionMap[glassId].total += 1300;
        }
      }
      
      const correctedList = Object.values(consumptionMap).filter(rm => rm.total > 0);
      
      if (correctedList.length === 0) {
        alert('Recalculation yielded no raw material consumption.');
        setRecalculatingId(null);
        return;
      }

      const totalColWeight = updatedColoursFired.reduce((sum, cf) => sum + (parseFloat(cf.totalWeight) || 0), 0);
      const looseTilesVal = prod.looseTilesMfgSqmtr !== undefined ? prod.looseTilesMfgSqmtr : (totalColWeight / 10.7639);

      // Update in Firestore
      await updateDoc(doc(db, 'dailyProductions', prod.id), {
        coloursFired: updatedColoursFired,
        calculatedRawMaterials: correctedList,
        looseTilesMfgSqmtr: parseFloat(looseTilesVal) || 0
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

      <datalist id="project-suggestions">
        {uniqueProjectsList.map((p, i) => (
          <option key={i} value={p} />
        ))}
      </datalist>

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
            {editingId === prod.id ? (
              /* Inline Edit UI */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Edit size={18} /> Edit Production Log
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => saveEdits(prod.id)} 
                      style={{ 
                        background: 'linear-gradient(135deg, #10b981, #059669)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        padding: '6px 12px', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px' 
                      }}
                    >
                      <Save size={14} /> Save
                    </button>
                    <button 
                      onClick={() => setEditingId(null)} 
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        color: 'var(--error)', 
                        border: 'none', 
                        borderRadius: '6px', 
                        padding: '6px 12px', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px' 
                      }}
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
                
                {/* Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: '600' }}>Date</label>
                    <input type="date" value={editForm.date} onChange={e => handleEditChange('date', e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: '600' }}>Project Name</label>
                    <input 
                      type="text" 
                      value={editForm.project} 
                      onChange={e => handleEditChange('project', e.target.value)} 
                      list="project-suggestions"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'var(--surface-high)', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: '600' }}>PVA Consumed (Kgs)</label>
                    <input type="number" step="0.1" value={editForm.pvaConsumed} onChange={e => handleEditChange('pvaConsumed', e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: '600' }}>Loose Tiles Mfg (Sqmtr)</label>
                    <input type="number" step="0.01" value={editForm.looseTilesMfgSqmtr} onChange={e => handleEditChange('looseTilesMfgSqmtr', e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '6px', fontWeight: '600' }}>Ball Mill Charge (1300kg Scrap &rarr; 1240kg Powder)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => handleBallMillToggle(true)} 
                        style={{ 
                          flex: 1, 
                          padding: '6px', 
                          fontSize: '0.85rem', 
                          borderRadius: '6px', 
                          border: 'none', 
                          background: editForm.ballMillCharge ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--surface)', 
                          color: editForm.ballMillCharge ? 'white' : 'var(--on-surface)',
                          fontWeight: 'bold', 
                          cursor: 'pointer' 
                        }}
                      >
                        Yes
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleBallMillToggle(false)} 
                        style={{ 
                          flex: 1, 
                          padding: '6px', 
                          fontSize: '0.85rem', 
                          borderRadius: '6px', 
                          border: 'none', 
                          background: !editForm.ballMillCharge ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--surface)', 
                          color: !editForm.ballMillCharge ? 'white' : 'var(--on-surface)',
                          fontWeight: 'bold', 
                          cursor: 'pointer' 
                        }}
                      >
                        No
                      </button>
                    </div>
                    {editForm.ballMillCharge && (
                      <input type="text" placeholder="Charge Number" value={editForm.ballMillNumber} onChange={e => handleEditChange('ballMillNumber', e.target.value)} style={{ width: '100%', marginTop: '6px', padding: '6px 10px', fontSize: '0.9rem' }} />
                    )}
                  </div>
                </div>

                {/* Colours Fired */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Colours Fired</span>
                    <button 
                      type="button" 
                      onClick={addColourFiredEdit} 
                      style={{ 
                        background: 'rgba(99, 102, 241, 0.1)', 
                        color: '#818cf8', 
                        border: 'none', 
                        borderRadius: '6px', 
                        padding: '4px 8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px' 
                      }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {editForm.coloursFired.map((cf, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--surface-high)', padding: '12px', borderRadius: '10px', border: '1px solid var(--surface-high)', position: 'relative', paddingTop: '36px' }}>
                        <button 
                          type="button" 
                          onClick={() => removeColourFiredEdit(idx)} 
                          style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            right: '8px', 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            border: 'none', 
                            color: 'var(--error)', 
                            borderRadius: '6px', 
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 10
                          }}
                          aria-label="Remove Color Row"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Project Name</label>
                          <input 
                            type="text" 
                            placeholder="Assign project to this colour..." 
                            value={cf.project || ''} 
                            onChange={e => handleColourFiredEdit(idx, 'project', e.target.value)} 
                            list="project-suggestions"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Colour</label>
                          <SearchableSelect
                            options={colours.map(c => ({ value: c.id, label: `${c.name} (${c.code || '-'})` }))}
                            value={cf.colourId}
                            onChange={val => handleColourFiredEdit(idx, 'colourId', val)}
                            placeholder="Search Colour..."
                          />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Size</label>
                          <SearchableSelect
                            options={sizes.map(s => ({ value: s.id, label: `${s.name} (${s.code || '-'})` }))}
                            value={cf.sizeId}
                            onChange={val => handleColourFiredEdit(idx, 'sizeId', val)}
                            placeholder="Search Size..."
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Charges</label>
                          <input 
                            type="number" 
                            placeholder="Charges" 
                            value={cf.numberOfCharges} 
                            onChange={e => handleColourFiredEdit(idx, 'numberOfCharges', e.target.value)} 
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem' }} 
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Total Wt (Kg)</label>
                          <input 
                            type="number" 
                            step="0.1" 
                            placeholder="Weight" 
                            value={cf.totalWeight} 
                            onChange={e => handleColourFiredEdit(idx, 'totalWeight', e.target.value)} 
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem' }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw Materials (Adjustments) */}
                <div style={{ borderTop: '1px solid var(--surface-high)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Calculated Raw Material Consumption</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: '160px' }}>
                        <SearchableSelect
                          options={rawMaterials
                            .filter(rm => !editForm.calculatedRawMaterials.some(e => e.rawMaterialId === rm.id))
                            .map(rm => ({ value: rm.id, label: rm.name }))
                          }
                          value=""
                          onChange={val => {
                            if (!val) return;
                            const rm = rawMaterials.find(r => r.id === val);
                            if (rm) {
                              setEditForm(prev => ({
                                ...prev,
                                calculatedRawMaterials: [
                                  ...prev.calculatedRawMaterials,
                                  { rawMaterialId: rm.id, name: rm.name, total: '0' }
                                ]
                              }));
                            }
                          }}
                          placeholder="Add Material..."
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={recalculateEditFormRMs} 
                        style={{ 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          color: '#818cf8', 
                          border: 'none', 
                          borderRadius: '6px', 
                          padding: '4px 8px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px' 
                        }}
                      >
                        <RefreshCw size={12} /> Recalculate from Recipes
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                    {[...editForm.calculatedRawMaterials]
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                      .map((rm) => (
                        <div key={rm.rawMaterialId} style={{ background: 'var(--surface-high)', padding: '6px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }} title={rm.name}>{rm.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditForm(prev => ({
                                  ...prev,
                                  calculatedRawMaterials: prev.calculatedRawMaterials.filter(item => item.rawMaterialId !== rm.rawMaterialId)
                                }));
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--error)',
                                padding: '2px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="number" step="0.001" value={rm.total} onChange={e => handleRMEdit(rm.rawMaterialId, e.target.value)} style={{ padding: '4px', fontSize: '0.8rem', width: '100%', textAlign: 'right' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>kg</span>
                          </div>
                        </div>
                    ))}
                    {editForm.loggedConsumables.map((lc) => (
                      <div key={lc.rawMaterialId}>
                        <label style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
                          {lc.name}
                        </label>
                        <input 
                          type="number" step="0.1" 
                          value={lc.total} 
                          onChange={e => handleConsumableEdit(lc.rawMaterialId, e.target.value)} 
                          style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem' }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Static Display UI */
              <>
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
                      onClick={() => startEditing(prod)} 
                      style={{ 
                        background: 'rgba(99, 102, 241, 0.1)', 
                        border: 'none', 
                        color: '#818cf8', 
                        borderRadius: '8px', 
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Edit Production Log"
                      aria-label="Edit Production Log"
                    >
                      <Edit size={16} />
                    </button>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', background: 'var(--surface-high)', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '16px' }}>
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
                  {prod.looseTilesMfgSqmtr !== undefined && (
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Loose Tiles Mfg</span>
                      <strong style={{ color: 'var(--on-surface)' }}>{prod.looseTilesMfgSqmtr} Sqmtr</strong>
                    </div>
                  )}
                </div>

                {/* Colours Fired */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 'bold', marginBottom: '6px' }}>Colours Fired</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(prod.coloursFired || []).filter(cf => cf.colourId && cf.totalWeight)
                      .sort((a, b) => (a.colourName || '').localeCompare(b.colourName || '', undefined, { numeric: true, sensitivity: 'base' }))
                      .map((cf, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', borderBottom: '1px solid var(--surface-high)', paddingBottom: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--on-surface)', fontWeight: '600' }}>{cf.colourName || 'Unknown Colour'}</span>
                            <span style={{ color: 'var(--on-surface-variant)' }}>
                              <strong>{cf.totalWeight}kg</strong> ({cf.numberOfCharges} chgs)
                            </span>
                          </div>
                          {cf.project && (
                            <span style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '2px' }}>
                              Project: {cf.project}
                            </span>
                          )}
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
                    {[...getDisplayRawMaterials(prod)]
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                      .map((rm, idx) => (
                        <span key={idx} style={{ background: 'var(--surface-high)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--on-surface)' }}>
                          {rm.name}: <strong style={{ color: '#818cf8' }}>{rm.total?.toFixed(3)}kg</strong>
                        </span>
                    ))}
                  </div>
                </div>

                {/* Consumables & Packaging */}
                {(prod.consumables && Object.values(prod.consumables).some(v => v > 0)) || (prod.loggedConsumables && prod.loggedConsumables.some(v => parseFloat(v.total) > 0)) ? (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '700', 
                      color: 'var(--on-surface-variant)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px', 
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <div style={{ width: '4px', height: '12px', background: '#ec4899', borderRadius: '2px' }}></div>
                      Consumables & Packaging
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {prod.loggedConsumables ? (
                        prod.loggedConsumables.filter(lc => parseFloat(lc.total) > 0).map((lc, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--surface-high)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>{lc.name}</span>
                            <span style={{ fontSize: '0.95rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>{lc.total}</span>
                          </div>
                        ))
                      ) : (
                        Object.entries(prod.consumables || {}).filter(([k,v]) => parseFloat(v) > 0).map(([key, value]) => {
                          const label = key.replace(/([A-Z])/g, ' $1').trim();
                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--surface-high)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize', fontWeight: '600' }}>{label}</span>
                              <span style={{ fontSize: '0.95rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>{value}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
