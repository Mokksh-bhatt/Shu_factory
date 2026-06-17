import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FileSpreadsheet, Printer } from 'lucide-react';

export default function MonthlyProductionGrid() {
  const [productions, setProductions] = useState([]);
  
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, '0'));

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'dailyProductions'), snap => {
      setProductions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const daysInMonth = useMemo(() => {
    return new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  }, [selectedYear, selectedMonth]);

  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Aggregate matrix dynamically
  const matrixData = useMemo(() => {
    const data = {
      ballMill: Array(daysInMonth).fill(''),
      glassPowderMfg: Array(daysInMonth).fill(0),
      rawMaterials: {}, // dynamic: { "Name": [0,0,0...] }
      consumables: {},  // dynamic: { "Name": [0,0,0...] }
      looseTileMfg: Array(daysInMonth).fill(0),
      sheetsMade: Array(daysInMonth).fill(0),
      looseTileConsumed: Array(daysInMonth).fill(0),
      glassMosaicPacked: Array(daysInMonth).fill(0),
      unglazedMosaicPacked: Array(daysInMonth).fill(0),
      glazedMosaicPacked: Array(daysInMonth).fill(0),
    };

    const targetPrefix = `${selectedYear}-${selectedMonth}-`;

    const filteredLogs = productions.filter(p => 
      p.status === 'APPROVED' && p.date && p.date.startsWith(targetPrefix)
    );

    filteredLogs.forEach(log => {
      const day = parseInt(log.date.split('-')[2], 10);
      if (isNaN(day) || day < 1 || day > daysInMonth) return;
      const dayIdx = day - 1;

      // 1. ITEMS PROCESSED
      if (log.ballMill?.chargeNumber) {
        data.ballMill[dayIdx] = data.ballMill[dayIdx] ? `${data.ballMill[dayIdx]}, ${log.ballMill.chargeNumber}` : log.ballMill.chargeNumber;
      }
      if (log.ballMill?.charge1300) {
        data.glassPowderMfg[dayIdx] += 1240;
      }

      const addToGroup = (groupObj, name, qty) => {
        if (!name) return;
        const key = name.trim();
        if (!groupObj[key]) groupObj[key] = Array(daysInMonth).fill(0);
        groupObj[key][dayIdx] += parseFloat(qty) || 0;
      };

      // 2. RAW MATERIAL CONSUMED
      (log.calculatedRawMaterials || []).forEach(rm => {
        addToGroup(data.rawMaterials, rm.name, rm.total);
      });

      // 3. CONSUMABLES CONSUMED
      // New format (Array of objects with name)
      if (Array.isArray(log.loggedConsumables)) {
        log.loggedConsumables.forEach(lc => {
          addToGroup(data.consumables, lc.name, lc.total);
        });
      } 
      // Old legacy fallback format
      else if (log.consumables) {
        addToGroup(data.consumables, 'Corrugated Boxes', log.consumables.boxes);
        addToGroup(data.consumables, 'Paper Cuttings', log.consumables.cutPaper);
        addToGroup(data.consumables, 'PVA', log.consumables.pva);
        addToGroup(data.consumables, 'Sheets', log.consumables.sheetsMade);
        addToGroup(data.consumables, 'Liquid Gum For Pasting', log.consumables.gum);
        addToGroup(data.consumables, 'Kraft paper Roll', log.consumables.kraftPaper);
        addToGroup(data.consumables, 'Stretch wrapping Roll', log.consumables.stretchFilm);
        addToGroup(data.consumables, 'Plastic bags', log.consumables.plasticBags);
      }
      
      // PVA is also explicitly logged
      if (log.pvaConsumed) {
        addToGroup(data.consumables, 'PVA', log.pvaConsumed);
      }

      // Sheets Made fallback logic
      let sheetsFromConsumables = 0;
      if (Array.isArray(log.loggedConsumables)) {
        const s = log.loggedConsumables.find(lc => lc.name === 'Sheets' || lc.rawMaterialId === 'legacy_sheets');
        if (s) sheetsFromConsumables = parseFloat(s.total) || 0;
      } else if (log.consumables && log.consumables.sheetsMade) {
        sheetsFromConsumables = parseFloat(log.consumables.sheetsMade) || 0;
      }
      
      data.sheetsMade[dayIdx] += sheetsFromConsumables;

      // 4. SEMI FINISH AND FINISHED ITEMS
      data.looseTileMfg[dayIdx] += parseFloat(log.looseTilesMfgSqmtr) || 0;

      if (log.finishedMaterials) {
        const glass = parseFloat(log.finishedMaterials.glassMosaicSqmtr) || 0;
        const unglazed = parseFloat(log.finishedMaterials.unglazedSqmtr) || 0;
        const glazed = parseFloat(log.finishedMaterials.glazedSqmtr) || 0;
        
        data.glassMosaicPacked[dayIdx] += glass;
        data.unglazedMosaicPacked[dayIdx] += unglazed;
        data.glazedMosaicPacked[dayIdx] += glazed;
      }

      // Loose Tiles Consumed: (Sheets Made + 2%) / 10.7639
      if (sheetsFromConsumables > 0) {
        data.looseTileConsumed[dayIdx] += (sheetsFromConsumables * 1.02) / 10.7639;
      }
    });

    return data;
  }, [productions, selectedYear, selectedMonth, daysInMonth]);

  const handlePrint = () => {
    window.print();
  };

  const years = Array.from({ length: 5 }, (_, i) => (currentDate.getFullYear() - i).toString());
  const months = [
    { val: '01', label: 'January' }, { val: '02', label: 'February' },
    { val: '03', label: 'March' }, { val: '04', label: 'April' },
    { val: '05', label: 'May' }, { val: '06', label: 'June' },
    { val: '07', label: 'July' }, { val: '08', label: 'August' },
    { val: '09', label: 'September' }, { val: '10', label: 'October' },
    { val: '11', label: 'November' }, { val: '12', label: 'December' }
  ];

  const renderDynamicRow = (label, unit, rowData) => {
    const total = rowData.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    if (total === 0) return null; // Hide empty rows
    
    return (
      <tr style={{ borderBottom: '1px solid #333', background: '#121212' }}>
        <td className="grid-label-cell" style={{ position: 'sticky', left: 0, background: '#1a1a1c', borderRight: '2px solid #444', padding: '8px 12px', fontWeight: '600', color: '#fff', zIndex: 5, whiteSpace: 'nowrap' }}>
          {label}
        </td>
        <td className="grid-unit-cell" style={{ padding: '8px 12px', textAlign: 'center', color: '#aaa', borderRight: '1px solid #333' }}>
          {unit}
        </td>
        {daysArray.map((_, i) => (
          <td className="grid-val-cell" key={i} style={{ padding: '8px 4px', textAlign: 'center', color: rowData[i] ? '#fff' : '#555', borderRight: '1px solid #333', fontWeight: rowData[i] ? '500' : 'normal' }}>
            {rowData[i] ? parseFloat(rowData[i]).toFixed(2).replace(/\.00$/, '') : '-'}
          </td>
        ))}
        <td className="grid-total-cell" style={{ background: '#27272a', borderLeft: '2px solid #444', padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
          {total > 0 ? total.toFixed(2).replace(/\.00$/, '') : '-'}
        </td>
      </tr>
    );
  };

  const renderRow = (label, unit, dataKey, isString = false) => {
    const rowData = matrixData[dataKey];
    let total = 0;
    if (!isString) {
      total = rowData.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    }
    
    return (
      <tr style={{ borderBottom: '1px solid #333', background: '#121212' }}>
        <td className="grid-label-cell" style={{ position: 'sticky', left: 0, background: '#1a1a1c', borderRight: '2px solid #444', padding: '8px 12px', fontWeight: '600', color: '#fff', zIndex: 5, whiteSpace: 'nowrap' }}>
          {label}
        </td>
        <td className="grid-unit-cell" style={{ padding: '8px 12px', textAlign: 'center', color: '#aaa', borderRight: '1px solid #333' }}>
          {unit}
        </td>
        {daysArray.map((_, i) => (
          <td className="grid-val-cell" key={i} style={{ padding: '8px 4px', textAlign: 'center', color: rowData[i] ? '#fff' : '#555', borderRight: '1px solid #333', fontWeight: rowData[i] ? '500' : 'normal' }}>
            {rowData[i] ? (isString ? rowData[i] : parseFloat(rowData[i]).toFixed(2).replace(/\.00$/, '')) : '-'}
          </td>
        ))}
        <td className="grid-total-cell" style={{ background: '#27272a', borderLeft: '2px solid #444', padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
          {!isString && total > 0 ? total.toFixed(2).replace(/\.00$/, '') : '-'}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title) => (
    <tr className="grid-section-header">
      <td colSpan={daysInMonth + 3} className="print-group-header" style={{ background: '#27272a', color: '#03a64b', fontWeight: 'bold', padding: '12px 12px', borderBottom: '1px solid #444', borderTop: '2px solid #444', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
        {title}
      </td>
    </tr>
  );

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header and Controls (Hide when printing) */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 style={{ color: '#10b981', margin: 0, fontSize: '1.5rem' }}>Monthly Matrix Report</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Exact Image Format</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--surface-high)', background: 'var(--surface)', color: 'var(--on-surface)', fontWeight: 'bold' }}
          >
            {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--surface-high)', background: 'var(--surface)', color: 'var(--on-surface)', fontWeight: 'bold' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          
          <button
            onClick={handlePrint}
            style={{
              background: 'var(--surface-high)',
              color: 'var(--on-surface)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="card print-w-100" style={{ overflowX: 'auto', border: '1px solid var(--surface-high)', padding: '0', borderRadius: '12px' }}>
        {/* Print ONLY Header */}
        <div className="print-only-header" style={{ display: 'none', padding: '12px 16px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', textAlign: 'left', color: 'black', textTransform: 'uppercase' }}>Consumption / Production Summary</h2>
          <div style={{ color: 'red', fontWeight: 'bold', fontSize: '14px', textAlign: 'left', marginTop: '6px' }}>
            Date Range - 01/{selectedMonth}/{selectedYear} TO {daysInMonth}/{selectedMonth}/{selectedYear}
          </div>
        </div>
        <table style={{ minWidth: 'max-content', width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr className="grid-main-header">
              <th style={{ position: 'sticky', left: 0, background: '#1a1a1c', color: '#fff', borderRight: '2px solid #444', borderBottom: '2px solid #444', padding: '12px', zIndex: 10, textAlign: 'left', minWidth: '220px' }}>
                {/* Empty top left corner */}
              </th>
              <th style={{ background: '#1a1a1c', color: '#aaa', borderRight: '1px solid #444', borderBottom: '2px solid #444', padding: '12px', textAlign: 'center', fontWeight: 'bold', minWidth: '60px' }}>
                Unit
              </th>
              {daysArray.map(day => (
                <th key={day} style={{ background: '#1a1a1c', color: '#fff', borderBottom: '2px solid #444', borderRight: '1px solid #333', padding: '12px 2px', textAlign: 'center', minWidth: '32px', fontWeight: 'bold' }}>
                  {day}
                </th>
              ))}
              <th className="print-total-header" style={{ background: '#1a1a1c', color: '#10b981', borderBottom: '2px solid #444', borderLeft: '2px solid #444', padding: '12px', textAlign: 'right', fontWeight: 'bold', minWidth: '80px' }}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            
            {/* ITEMS PROCESSED */}
            {renderSectionHeader('A. ITEMS PROCESSED')}
            {renderRow('Ball Mill (Charge No)', 'Nos', 'ballMill', true)}
            {renderRow('Glass Powder Mfg', 'Kgs', 'glassPowderMfg')}

            {/* RAW MATERIAL CONSUMED (DYNAMIC) */}
            {renderSectionHeader('B. RAW MATERIAL CONSUMED')}
            {Object.keys(matrixData.rawMaterials).sort().map(rmName => 
              renderDynamicRow(rmName, 'Kgs', matrixData.rawMaterials[rmName])
            )}
            {Object.keys(matrixData.rawMaterials).length === 0 && (
              <tr><td colSpan={daysInMonth + 3} style={{ padding: '12px', textAlign: 'center', color: '#888' }}>No Raw Materials Logged</td></tr>
            )}

            {/* CONSUMABLES CONSUMED (DYNAMIC) */}
            {renderSectionHeader('C. CONSUMABLES CONSUMED')}
            {Object.keys(matrixData.consumables).sort().map(rmName => {
               // Sheets made is shown in semi-finished section instead
               if (rmName.toLowerCase().includes('sheets')) return null;
               return renderDynamicRow(rmName, 'Kgs/Nos', matrixData.consumables[rmName]);
            })}
            {Object.keys(matrixData.consumables).length === 0 && (
              <tr><td colSpan={daysInMonth + 3} style={{ padding: '12px', textAlign: 'center', color: '#888' }}>No Consumables Logged</td></tr>
            )}

            {/* SEMI FINISH AND FINISHED ITEMS */}
            {renderSectionHeader('D. SEMI FINISH AND FINISHED ITEMS')}
            {renderRow('Loose Tiles Mfg', 'Sqmtr', 'looseTileMfg')}
            {renderRow('Loose Tile Consumed', 'Sqmtr', 'looseTileConsumed')}
            {Object.keys(matrixData.consumables).find(k => k.toLowerCase().includes('sheets')) && renderDynamicRow('Sheets Made', 'Nos', matrixData.consumables[Object.keys(matrixData.consumables).find(k => k.toLowerCase().includes('sheets'))])}
            {renderRow('Glass Mosaic Packed', 'Sqmtr', 'glassMosaicPacked')}
            {renderRow('Unglazed Mosaic Packed', 'Sqmtr', 'unglazedMosaicPacked')}
            {renderRow('Glazed Mosaic Packed', 'Sqmtr', 'glazedMosaicPacked')}

          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Force page and body to be white, hide background */
          html, body {
            background-color: white !important;
            color: black !important;
            height: 100vh !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Hide EVERYTHING in the app by default */
          body * {
            visibility: hidden;
          }

          /* Unhide ONLY the grid wrapper and its children */
          .print-w-100, .print-w-100 * {
            visibility: visible;
          }

          /* Scale the table to fit on ONE PAGE */
          .print-w-100 {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            transform: scale(0.68) !important;
            transform-origin: top left !important;
          }
          
          /* Make table headers and cells explicitly black and white */
          table, table tr, table th, table td {
            color: black !important;
            background: white !important;
            background-color: white !important;
            border: 1px solid #aaa !important;
            padding: 2px !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          
          table th {
            background-color: #eee !important;
          }

          table td.grid-label-cell {
            background-color: #f9f9f9 !important;
            font-weight: bold !important;
          }

          /* Left-aligned print header */
          .print-only-header {
            display: block !important;
            margin-bottom: 8px;
            background: white !important;
          }

          /* Group header: BLUE */
          table td.print-group-header {
            color: #1d4ed8 !important; /* Blue text */
            background-color: #eff6ff !important; /* Light blue background */
          }

          /* Totals: GREEN */
          table th.print-total-header, table td.grid-total-cell {
            color: #15803d !important; /* Green text */
            background-color: #f0fdf4 !important; /* Light green background */
          }

          /* Fix Red text specifically */
          .print-only-header div {
            color: red !important;
          }

          /* For sticky headers, disable sticky in print so it flows naturally */
          table th[style], table td[style] {
            position: static !important;
          }
        }
        
        @page { 
          size: landscape; 
          margin: 5mm; 
        }
      `}} />
    </div>
  );
}
