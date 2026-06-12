import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
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
  const [actualRMs, setActualRMs] = useState({}); // Actual inputs
  const [overriddenRMs, setOverriddenRMs] = useState({}); // Tracking manual overrides
  const [extraRMs, setExtraRMs] = useState([]); // Manual additions
  
  // Real-time suggestions state derived from recent logs
  const [recentProjects, setRecentProjects] = useState([]);
  const [nextSuggestedCharge, setNextSuggestedCharge] = useState('');
  const [frequentFires, setFrequentFires] = useState([]);
  const [pastProjectLog, setPastProjectLog] = useState(null);

  const [allProductions, setAllProductions] = useState([]);
  const [lastAutoPopulatedProject, setLastAutoPopulatedProject] = useState('');
  const [isProjectFocused, setIsProjectFocused] = useState(false);
  const [autoRecalledMessage, setAutoRecalledMessage] = useState('');

  const [looseTilesMfgSqmtr, setLooseTilesMfgSqmtr] = useState('');
  const [isLooseTilesOverridden, setIsLooseTilesOverridden] = useState(false);

  const [loggedConsumables, setLoggedConsumables] = useState({});
  const [sheetsMade, setSheetsMade] = useState('');
  const [hasAutoFilledConsumables, setHasAutoFilledConsumables] = useState(false);

  const [finishedMaterials, setFinishedMaterials] = useState({
    unglazedSqmtr: '',
    glazedSqmtr: '',
    glassMosaicSqmtr: ''
  });

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'production_colours'), s => setColours(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u2 = onSnapshot(collection(db, 'production_sizes'), s => setSizes(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u3 = onSnapshot(collection(db, 'production_raw_materials'), s => setRawMaterials(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, []);

  // Fetch all productions in history (to power smart suggestions and project recall)
  useEffect(() => {
    const q = query(collection(db, 'dailyProductions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setAllProductions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Pre-fill Consumables & Packaging from the most recent global entry when form loads
  useEffect(() => {
    if (allProductions.length > 0 && !hasAutoFilledConsumables) {
      const latestLog = allProductions[0];
      if (latestLog.loggedConsumables) {
        const lcMap = {};
        latestLog.loggedConsumables.forEach(lc => {
          if (lc.name === 'Sheets' || lc.rawMaterialId === 'legacy_sheets') {
            setSheetsMade(lc.total?.toString() || '');
          } else {
            lcMap[lc.rawMaterialId] = lc.total?.toString() || '';
          }
        });
        setLoggedConsumables(lcMap);
      } else if (latestLog.consumables) {
        if (latestLog.consumables.sheetsMade) {
          setSheetsMade(latestLog.consumables.sheetsMade.toString());
        }
      }
      setHasAutoFilledConsumables(true);
    }
  }, [allProductions, hasAutoFilledConsumables]);

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

  // Look up matching project log history locally (case-insensitive & spacing-insensitive)
  useEffect(() => {
    if (!project.trim()) {
      setPastProjectLog(null);
      setAutoRecalledMessage('');
      setLastAutoPopulatedProject('');
      return;
    }

    const clean = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const searchProj = clean(project);

    // Find the latest daily production log that matches this project name
    const match = allProductions.find(p => p.project && clean(p.project) === searchProj);
    
    if (match) {
      setPastProjectLog(match);
      
      // If we haven't auto-populated for this project name yet
      if (searchProj !== clean(lastAutoPopulatedProject)) {
        // Auto-fill all states
        if (match.coloursFired) {
          setColoursFired(match.coloursFired.map(cf => ({
            colourId: cf.colourId || '',
            sizeId: cf.sizeId || '',
            numberOfCharges: cf.numberOfCharges?.toString() || '',
            totalWeight: cf.totalWeight?.toString() || ''
          })));
        }
        if (match.pvaConsumed !== undefined) {
          setPvaConsumed(match.pvaConsumed.toString());
        }
        if (match.ballMill) {
          setBallMillYes(!!match.ballMill.charge1300);
          setChargeNumber(match.ballMill.chargeNumber || '');
        }
        if (match.loggedConsumables) {
          const lcMap = {};
          match.loggedConsumables.forEach(lc => {
            if (lc.name === 'Sheets' || lc.rawMaterialId === 'legacy_sheets') {
              setSheetsMade(lc.total?.toString() || '');
            } else {
              lcMap[lc.rawMaterialId] = lc.total?.toString() || '';
            }
          });
          setLoggedConsumables(lcMap);
        } else {
          setLoggedConsumables({});
          if (match.consumables && match.consumables.sheetsMade) {
            setSheetsMade(match.consumables.sheetsMade.toString());
          } else {
            setSheetsMade('');
          }
        }
        if (match.calculatedRawMaterials) {
          const actuals = {};
          const overrides = {};
          match.calculatedRawMaterials.forEach(rm => {
            actuals[rm.rawMaterialId] = rm.total?.toString() || '';
            overrides[rm.rawMaterialId] = true;
          });
          setActualRMs(actuals);
          setOverriddenRMs(overrides);
        }
        
        setLastAutoPopulatedProject(project);
        setAutoRecalledMessage(`Automatically recalled previous data for "${match.project}"`);
        // Clear message after 4 seconds
        setTimeout(() => setAutoRecalledMessage(''), 4000);
      }
    } else {
      setPastProjectLog(null);
    }
  }, [project, allProductions, lastAutoPopulatedProject]);

  const handleGlobalProjectChange = (val) => {
    const oldVal = project;
    setProject(val);
    setColoursFired(prev => prev.map(cf => {
      if (!cf.project || cf.project === oldVal) {
        return { ...cf, project: val };
      }
      return cf;
    }));
  };

  const addColourFired = () => {
    setColoursFired([...coloursFired, { colourId: '', sizeId: '', numberOfCharges: '', totalWeight: '', project: project }]);
  };

  const updateColourFired = (idx, field, value) => {
    const updated = [...coloursFired];
    updated[idx][field] = value;
    if (field === 'numberOfCharges') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        updated[idx].totalWeight = (parsed * 45).toString();
      } else {
        updated[idx].totalWeight = '';
      }
    }
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

    // Auto-consume 1300kg of glass pieces (Glass Scrap) if Ball Mill Charge is active
    if (ballMillYes) {
      const glassScrap = rawMaterials.find(r => r.name?.toLowerCase().trim() === 'glass scrap');
      if (glassScrap) {
        const glassId = glassScrap.id;
        if (!consumptionMap[glassId]) {
          consumptionMap[glassId] = { rawMaterialId: glassId, name: glassScrap.name, total: 0 };
        }
        consumptionMap[glassId].total += 1300; // Default 1300kg per batch
      }
    }

    return Object.values(consumptionMap).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  const calculatedRMs = calculateRawMaterialConsumption();

  // Auto-calculate Loose Tiles Mfg Sqmtr (Total color wt / 10.76)
  const totalColourWeight = coloursFired.reduce((sum, cf) => sum + (parseFloat(cf.totalWeight) || 0), 0);
  useEffect(() => {
    if (!isLooseTilesOverridden) {
      if (totalColourWeight > 0) {
        setLooseTilesMfgSqmtr((totalColourWeight / 10.76).toFixed(2));
      } else {
        setLooseTilesMfgSqmtr('');
      }
    }
  }, [totalColourWeight, isLooseTilesOverridden]);

  // Synchronize actual inputs with estimates dynamically unless manually overridden by the user
  useEffect(() => {
    setActualRMs(prev => {
      const updated = { ...prev };
      let changed = false;
      
      calculatedRMs.forEach(rm => {
        const id = rm.rawMaterialId;
        const estVal = rm.total.toFixed(3);
        // If not manually overridden, keep in sync with live estimates
        if (!overriddenRMs[id] && prev[id] !== estVal) {
          updated[id] = estVal;
          changed = true;
        }
      });
      
      // Clean up deleted ones
      Object.keys(updated).forEach(id => {
        if (!calculatedRMs.some(rm => rm.rawMaterialId === id)) {
          delete updated[id];
          changed = true;
        }
      });
      
      return changed ? updated : prev;
    });
  }, [calculatedRMs, overriddenRMs]);

  const handleActualRMChange = (rmId, value) => {
    setActualRMs(prev => ({ ...prev, [rmId]: value }));
    setOverriddenRMs(prev => ({ ...prev, [rmId]: true }));
  };

  const resetRMOverride = (rmId) => {
    setOverriddenRMs(prev => {
      const updated = { ...prev };
      delete updated[rmId];
      return updated;
    });
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
    
    // Compile and merge duplicate raw materials (actual overrides + manual extra logs)
    const mergedMap = {};
    
    // 1. Add recipe auto-calculated / actual-adjusted materials
    calculatedRMs.forEach(rm => {
      const actualVal = actualRMs[rm.rawMaterialId] !== undefined ? actualRMs[rm.rawMaterialId] : rm.total;
      const total = parseFloat(actualVal) || 0;
      mergedMap[rm.rawMaterialId] = {
        rawMaterialId: rm.rawMaterialId,
        name: rm.name,
        total: total
      };
    });
    
    // 2. Merge manual extra materials
    extraRMs.forEach(e => {
      if (!e.rawMaterialId || !e.total) return;
      const rm = rawMaterials.find(r => r.id === e.rawMaterialId);
      const total = parseFloat(e.total) || 0;
      if (mergedMap[e.rawMaterialId]) {
        mergedMap[e.rawMaterialId].total += total;
      } else {
        mergedMap[e.rawMaterialId] = {
          rawMaterialId: e.rawMaterialId,
          name: rm?.name || 'Manual Material',
          total: total
        };
      }
    });

    const finalRawMaterialsList = Object.values(mergedMap).filter(rm => rm.total > 0);

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
          colourId: cf.colourId || '',
          colourName: col?.name || '',
          sizeId: cf.sizeId || '',
          numberOfCharges: parseFloat(cf.numberOfCharges) || 0,
          totalWeight: parseFloat(cf.totalWeight) || 0,
          project: cf.project || '',
          recipeSnapshot: col?.recipe || []
        };
      }),
      calculatedRawMaterials: finalRawMaterialsList,
      looseTilesMfgSqmtr: parseFloat(looseTilesMfgSqmtr) || 0,
      loggedConsumables: [
        ...Object.entries(loggedConsumables)
          .filter(([id, val]) => parseFloat(val) > 0)
          .map(([id, val]) => {
            const rm = rawMaterials.find(r => r.id === id);
            return { rawMaterialId: id, name: rm?.name || 'Unknown', total: parseFloat(val) };
          }),
        ...(parseFloat(sheetsMade) > 0 ? [{ rawMaterialId: 'legacy_sheets', name: 'Sheets', total: parseFloat(sheetsMade) }] : [])
      ],
      finishedMaterials: {
        unglazedSqmtr: parseFloat(finishedMaterials.unglazedSqmtr) || 0,
        glazedSqmtr: parseFloat(finishedMaterials.glazedSqmtr) || 0,
        glassMosaicSqmtr: parseFloat(finishedMaterials.glassMosaicSqmtr) || 0
      },
      rmRatesSnapshot: rmSnapshots,
      status: 'PENDING_APPROVAL',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'dailyProductions'), payload);
      alert('Production saved successfully!');
      // Reset form
      setColoursFired([]);
      setActualRMs({});
      setOverriddenRMs({});
      setExtraRMs([]);
      setChargeNumber('');
      setProject('');
      setPvaConsumed('');
      setLooseTilesMfgSqmtr('');
      setIsLooseTilesOverridden(false);
      setLoggedConsumables({});
      setSheetsMade('');
      setFinishedMaterials({ unglazedSqmtr: '', glazedSqmtr: '', glassMosaicSqmtr: '' });
      setHasAutoFilledConsumables(false); // Reset so it auto-fills again next time
      
      // Scroll to top of the form so user sees it has been completely reset
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      alert('Failed to submit.');
    }
  };

  const uniqueProjectsList = useMemo(() => {
    const projs = allProductions.map(p => p.project?.trim()).filter(Boolean);
    const unique = Array.from(new Set(projs));
    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [allProductions]);

  const filteredProjects = useMemo(() => {
    const query = project.toLowerCase().trim();
    if (!query) return uniqueProjectsList.slice(0, 8); // Top 8 suggestions if empty
    
    // Fuzzy matching locally
    const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanQuery = clean(query);
    
    return uniqueProjectsList.filter(p => {
      const cleanP = clean(p);
      return cleanP.includes(cleanQuery);
    });
  }, [uniqueProjectsList, project]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      <datalist id="project-suggestions">
        {uniqueProjectsList.map((p, i) => (
          <option key={i} value={p} />
        ))}
      </datalist>
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
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Project Name</label>
            <input 
              type="text" 
              placeholder="e.g. Project Alpha" 
              value={project} 
              onChange={e => handleGlobalProjectChange(e.target.value)} 
              onFocus={() => setIsProjectFocused(true)}
              onBlur={() => setTimeout(() => setIsProjectFocused(false), 250)}
              style={{ width: '100%' }} 
            />

            {/* Auto Recalled notification */}
            {autoRecalledMessage && (
              <div style={{
                marginTop: '6px',
                fontSize: '0.8rem',
                color: '#10b981',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                animation: 'fadeIn 0.2s ease-in-out'
              }}>
                <Sparkles size={14} /> {autoRecalledMessage}
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {isProjectFocused && filteredProjects.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                marginTop: '4px',
                background: 'var(--surface)',
                border: '1px solid var(--surface-high)',
                borderRadius: '8px',
                maxHeight: '180px',
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                animation: 'fadeIn 0.15s ease-in-out'
              }}>
                {filteredProjects.map((p, i) => (
                  <div
                     key={i}
                     onClick={() => {
                       handleGlobalProjectChange(p);
                       setIsProjectFocused(false);
                     }}
                     style={{
                       padding: '8px 12px',
                       cursor: 'pointer',
                       fontSize: '0.9rem',
                       color: 'var(--on-surface)',
                       borderBottom: '1px solid var(--surface-high)',
                       textAlign: 'left'
                     }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-high)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}

            {recentProjects.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center' }}>Recent:</span>
                {recentProjects.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleGlobalProjectChange(p)}
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
          <label style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Ball Mill Charge (1300kg Scrap &rarr; 1240kg Powder)</label>
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
                  onClick={() => setColoursFired([...coloursFired, { colourId: f.colourId, sizeId: f.sizeId, numberOfCharges: '1', totalWeight: '45', project: project }])}
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
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Project Name</label>
            <input 
              type="text" 
              placeholder="Assign project to this colour..." 
              value={cf.project || ''} 
              onChange={e => updateColourFired(idx, 'project', e.target.value)} 
              list="project-suggestions"
              style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }}
            />
          </div>

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
                const isOverridden = overriddenRMs[rm.rawMaterialId];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--on-surface)', fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {rm.name}
                        {isOverridden && (
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Adjusted
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Estimated: {rm.total.toFixed(3)} Kgs</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => resetRMOverride(rm.rawMaterialId)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '4px 8px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: '#818cf8',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Reset
                        </button>
                      )}
                      <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          {rawMaterials.filter(rm => rm.isConsumable).map(rm => (
            <div key={rm.id}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
                {rm.name}
              </label>
              <input 
                type="number" step="0.1"
                placeholder="0"
                value={loggedConsumables[rm.id] || ''} 
                onChange={e => setLoggedConsumables({...loggedConsumables, [rm.id]: e.target.value})} 
                style={{ width: '100%' }}
              />
            </div>
          ))}
          {rawMaterials.filter(rm => rm.isConsumable).length === 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', gridColumn: '1 / -1' }}>
              No consumables found in Master List. Go to Admin -&gt; Master Data and tag materials as Consumable.
            </div>
          )}
        </div>
      </div>

      {/* SEMI FINISHED & FINISHED ITEMS SECTION */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--surface-high)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', marginBottom: '4px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
          <Package size={18} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Semi Finished & Finished Items</h3>
        </div>
        
        {/* Semi Finished (Loose Tiles) */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
            Loose Tiles Mfg (SQMTR)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={looseTilesMfgSqmtr} 
              onChange={e => {
                setLooseTilesMfgSqmtr(e.target.value);
                setIsLooseTilesOverridden(true);
              }} 
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', minWidth: '45px' }}>Sqmtr</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
            Sheets Made (Nos)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="number" 
              step="1" 
              placeholder="0" 
              value={sheetsMade} 
              onChange={e => setSheetsMade(e.target.value)} 
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', minWidth: '45px' }}>Nos</span>
          </div>
        </div>

        {isLooseTilesOverridden && (
          <div style={{ marginTop: '12px' }}>
            <button 
              type="button" 
              onClick={() => {
                setIsLooseTilesOverridden(false);
                if (totalColourWeight > 0) {
                  setLooseTilesMfgSqmtr((totalColourWeight / 10.76).toFixed(2));
                } else {
                  setLooseTilesMfgSqmtr('');
                }
              }}
              style={{
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818cf8',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Reset Default
            </button>
          </div>
        )}
        <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
          *Calculated as total of colour-wise weight / 10.76 (Default: {(totalColourWeight / 10.76).toFixed(2)} Sqmtr)
        </span>

        {/* Finished Material */}
        <div style={{ marginTop: '12px', borderTop: '1px dashed var(--surface-high)', paddingTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--on-surface)', fontWeight: '600' }}>
            Finished Material Packed (Sqmtr)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Unglazed Mosaic Tiles</label>
              <input 
                type="number" step="0.01" placeholder="0.00"
                value={finishedMaterials.unglazedSqmtr} 
                onChange={e => setFinishedMaterials({...finishedMaterials, unglazedSqmtr: e.target.value})} 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Glazed Mosaic Tiles</label>
              <input 
                type="number" step="0.01" placeholder="0.00"
                value={finishedMaterials.glazedSqmtr} 
                onChange={e => setFinishedMaterials({...finishedMaterials, glazedSqmtr: e.target.value})} 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Glass Mosaic Tiles</label>
              <input 
                type="number" step="0.01" placeholder="0.00"
                value={finishedMaterials.glassMosaicSqmtr} 
                onChange={e => setFinishedMaterials({...finishedMaterials, glassMosaicSqmtr: e.target.value})} 
                style={{ width: '100%' }}
              />
            </div>
          </div>
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
