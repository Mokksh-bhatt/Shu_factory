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

  // Aggregate matrix based strictly on requested layout
  const matrixData = useMemo(() => {
    const data = {
      ballMill: Array(daysInMonth).fill(''),
      glassPowderMfg: Array(daysInMonth).fill(0),
      blackStain: Array(daysInMonth).fill(0),
      glassScrap: Array(daysInMonth).fill(0),
      glassPowderConsumed: Array(daysInMonth).fill(0),
      boxes: Array(daysInMonth).fill(0),
      pva: Array(daysInMonth).fill(0),
      cutPaper: Array(daysInMonth).fill(0),
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

      // Helper to sum material by name keywords
      const getRMQty = (keywords) => {
        let total = 0;
        const check = (name) => keywords.some(k => name.toLowerCase().includes(k.toLowerCase()));
        
        (log.calculatedRawMaterials || []).forEach(rm => {
          if (check(rm.name)) total += parseFloat(rm.total) || 0;
        });
        (log.loggedConsumables || []).forEach(lc => {
          if (check(lc.name)) total += parseFloat(lc.total) || 0;
        });
        return total;
      };

      // 2. RAW MATERIAL CONSUMED
      data.blackStain[dayIdx] += getRMQty(['Black Stain', 'Balck Stain']);
      data.glassScrap[dayIdx] += getRMQty(['Glass Scrap']);
      data.glassPowderConsumed[dayIdx] += getRMQty(['Glass Powder']);

      // 3. CONSUMABLES CONSUMED
      data.boxes[dayIdx] += getRMQty(['Boxes', 'Corrugated']);
      data.pva[dayIdx] += (parseFloat(log.pvaConsumed) || 0) + getRMQty(['PVA']);
      data.cutPaper[dayIdx] += getRMQty(['Cut Paper', 'Paper Cuttings', 'Cut Papper']);

      // Old legacy consumables structure fallback
      if (log.consumables) {
        data.boxes[dayIdx] += parseFloat(log.consumables.boxes) || 0;
        data.cutPaper[dayIdx] += parseFloat(log.consumables.cutPaper) || 0;
        data.pva[dayIdx] += parseFloat(log.consumables.pva) || 0;
        data.sheetsMade[dayIdx] += parseFloat(log.consumables.sheetsMade) || 0;
      }

      // Also check if Sheets Made is logged as an extra material
      data.sheetsMade[dayIdx] += getRMQty(['Sheets made', 'Sheets']);

      // 4. SEMI FINISH AND FINISHED ITEMS
      data.looseTileMfg[dayIdx] += parseFloat(log.looseTilesMfgSqmtr) || 0;
      
      const currentSheets = data.sheetsMade[dayIdx];
      if (currentSheets > 0) {
        // Recalculate loose tile consumed for the day based on total sheets
        data.looseTileConsumed[dayIdx] = (currentSheets / 10.76) * 1.02;
      }

      if (log.finishedMaterials) {
        data.glassMosaicPacked[dayIdx] += parseFloat(log.finishedMaterials.glassMosaicSqmtr) || 0;
        data.unglazedMosaicPacked[dayIdx] += parseFloat(log.finishedMaterials.unglazedSqmtr) || 0;
        data.glazedMosaicPacked[dayIdx] += parseFloat(log.finishedMaterials.glazedSqmtr) || 0;
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

  const renderRow = (label, unit, dataKey, isString = false) => {
    const rowData = matrixData[dataKey];
    let total = 0;
    if (!isString) {
      total = rowData.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    }
    
    return (
      <tr style={{ borderBottom: '1px solid var(--surface-high)', background: 'var(--surface)' }}>
        <td className="grid-label-cell" style={{ position: 'sticky', left: 0, background: 'var(--surface)', borderRight: '2px solid var(--surface-high)', padding: '6px 12px', fontWeight: '500', color: 'var(--on-surface)', zIndex: 5, whiteSpace: 'nowrap' }}>
          {label}
        </td>
        <td className="grid-unit-cell" style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--on-surface-variant)', borderRight: '1px solid var(--surface-high)' }}>
          {unit}
        </td>
        {daysArray.map((_, i) => (
          <td className="grid-val-cell" key={i} style={{ padding: '6px 4px', textAlign: 'center', color: rowData[i] ? 'var(--on-surface)' : 'var(--on-surface-variant)', borderRight: '1px solid var(--surface-high)' }}>
            {rowData[i] ? (isString ? rowData[i] : parseFloat(rowData[i]).toFixed(2).replace(/\.00$/, '')) : ''}
          </td>
        ))}
        <td className="grid-total-cell" style={{ background: 'var(--surface-high)', borderLeft: '2px solid var(--surface-high)', padding: '6px 12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--on-surface)' }}>
          {!isString && total > 0 ? total.toFixed(2).replace(/\.00$/, '') : ''}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title) => (
    <tr className="grid-section-header">
      <td colSpan={daysInMonth + 3} style={{ background: 'var(--surface-high)', color: 'var(--primary)', fontWeight: 'bold', padding: '10px 12px', borderBottom: '1px solid var(--surface-high)', borderTop: '2px solid var(--surface-high)' }}>
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
        <table style={{ minWidth: 'max-content', width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr className="grid-main-header">
              <th style={{ position: 'sticky', left: 0, background: 'var(--surface-high)', color: 'var(--on-surface)', borderRight: '2px solid var(--surface-high)', borderBottom: '2px solid var(--surface-high)', padding: '12px', zIndex: 10, textAlign: 'left', minWidth: '220px' }}>
                {/* Empty top left corner */}
              </th>
              <th style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', borderRight: '1px solid var(--surface-high)', borderBottom: '2px solid var(--surface-high)', padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                Units
              </th>
              {daysArray.map(day => (
                <th key={day} style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', borderBottom: '2px solid var(--surface-high)', borderRight: '1px solid var(--surface-high)', padding: '12px 6px', textAlign: 'center', minWidth: '35px', fontWeight: 'bold' }}>
                  {day}
                </th>
              ))}
              <th style={{ background: 'var(--surface-high)', color: 'var(--error)', borderBottom: '2px solid var(--surface-high)', borderLeft: '2px solid var(--surface-high)', padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            
            {renderSectionHeader('ITEM PROCESSED')}
            {renderRow('Ball Mill', 'Chg No', 'ballMill', true)}
            {renderRow('Glass Powder Mfg', '', 'glassPowderMfg')}

            {renderSectionHeader('RAW MATERIAL CONSUMED')}
            {renderRow('Balck Stain', '', 'blackStain')}
            {renderRow('Glass Scrap', '', 'glassScrap')}
            {renderRow('Glass Powder Consumed', '', 'glassPowderConsumed')}

            {renderSectionHeader('CONSUMABLES CONSUMED')}
            {renderRow('Boxes', '', 'boxes')}
            {renderRow('PVA', '', 'pva')}
            {renderRow('Cut Papper', '', 'cutPaper')}

            {renderSectionHeader('SEMI FINISH AND FINISHED ITEMS')}
            {renderRow('Loose Tile Mfg', '', 'looseTileMfg')}
            {renderRow('Sheets made', '', 'sheetsMade')}
            {renderRow('Loose Tile Consumed', '', 'looseTileConsumed')}
            
            <tr><td colSpan={daysInMonth + 3} style={{ padding: '8px' }}></td></tr>

            {renderRow('Glass Mosaic Packed', '', 'glassMosaicPacked')}
            {renderRow('Unglazed Mosaic Packed', '', 'unglazedMosaicPacked')}
            {renderRow('Glazed Mosaic Packed', '', 'glazedMosaicPacked')}

          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Force page and body to be white, hide background */
          html, body {
            background-color: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          /* Hide EVERYTHING in the app by default */
          body * {
            visibility: hidden;
          }

          /* Unhide ONLY the grid wrapper and its children */
          .print-w-100, .print-w-100 * {
            visibility: visible;
          }

          /* Make the grid wrapper position absolute at the top left of the page */
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
          }
          
          /* Make table headers and cells explicitly black and white */
          table th, table td {
            color: black !important;
            background-color: transparent !important;
            border: 1px solid #000 !important;
            padding: 4px !important;
            font-size: 10px !important;
          }
          
          table th {
            background-color: #f0f0f0 !important;
          }

          /* For sticky headers, disable sticky in print so it flows naturally */
          table th[style], table td[style] {
            position: static !important;
          }

          @page { size: A4 landscape; margin: 0.5cm; }
        }
      `}} />
    </div>
  );
}
