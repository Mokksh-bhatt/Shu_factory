import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Printer, Calendar, Filter, FileText, Check, AlertCircle, Download } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';
import html2pdf from 'html2pdf.js';

export default function ProductionSummaryReport({ t }) {
  const [productions, setProductions] = useState([]);
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [reportType, setReportType] = useState('date-wise'); // 'date-wise' or 'custom-period'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [includePending, setIncludePending] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubProd = onSnapshot(collection(db, 'dailyProductions'), s => {
      setProductions(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubCol = onSnapshot(collection(db, 'production_colours'), s => {
      setColours(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSz = onSnapshot(collection(db, 'production_sizes'), s => {
      setSizes(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRm = onSnapshot(collection(db, 'production_raw_materials'), s => {
      setRawMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubProd();
      unsubCol();
      unsubSz();
      unsubRm();
    };
  }, []);

  // Filter logs based on date selections
  const filteredLogs = useMemo(() => {
    return productions.filter(p => {
      // Status filter
      if (!includePending && p.status !== 'APPROVED') return false;

      // Date range check
      const logDate = p.date; // YYYY-MM-DD
      if (!logDate) return false;

      if (reportType === 'date-wise') {
        return logDate === selectedDate;
      } else {
        return logDate >= startDate && logDate <= endDate;
      }
    });
  }, [productions, reportType, selectedDate, startDate, endDate, includePending]);

  // Aggregate Data
  const reportData = useMemo(() => {
    // 1. Item Processed - Ball Mill
    const ballMillCharges = [];
    filteredLogs.forEach(p => {
      if (p.ballMill?.charge1300) {
        ballMillCharges.push({
          date: p.date,
          chargeNumber: p.ballMill.chargeNumber || 'N/A',
          weight: 1300 // Standard Template weight is 1300 kgs
        });
      }
    });

    // 2. Item Processed - Colours & Sizes Fired
    const coloursFiredMap = {};
    filteredLogs.forEach(p => {
      (p.coloursFired || []).forEach(cf => {
        if (!cf.colourId || !cf.totalWeight) return;
        const colName = cf.colourName || 'Unknown Colour';
        const sizeObj = sizes.find(s => s.id === cf.sizeId);
        const sizeName = sizeObj?.name || 'Unknown Size';
        
        const key = `${cf.colourId}_${cf.sizeId}`;
        if (!coloursFiredMap[key]) {
          coloursFiredMap[key] = {
            colourName: colName,
            sizeName: sizeName,
            numberOfCharges: 0,
            totalWeight: 0,
            projects: new Set()
          };
        }
        coloursFiredMap[key].numberOfCharges += parseFloat(cf.numberOfCharges) || 0;
        coloursFiredMap[key].totalWeight += parseFloat(cf.totalWeight) || 0;
        if (cf.project) {
          coloursFiredMap[key].projects.add(cf.project.trim());
        } else if (p.project) {
          coloursFiredMap[key].projects.add(p.project.trim());
        }
      });
    });

    const aggregatedColoursFired = Object.values(coloursFiredMap).sort((a, b) =>
      a.colourName.localeCompare(b.colourName, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 3. Raw Materials Consumed
    const rmMap = {};
    filteredLogs.forEach(p => {
      (p.calculatedRawMaterials || []).forEach(rm => {
        if (!rm.rawMaterialId || !rm.total) return;
        const rmObj = rawMaterials.find(r => r.id === rm.rawMaterialId);
        const rmName = rmObj?.name || rm.name || 'Unknown Material';
        const rmUnit = rmObj?.unit || 'Kgs';

        if (!rmMap[rm.rawMaterialId]) rmMap[rm.rawMaterialId] = { name: rmName, unit: rmUnit, total: 0 };
        
        let qty = parseFloat(rm.total) || 0;
        if (rm.rawMaterialId === '3DfTCP8HWkcvetXrexOW' && p.ballMill?.charge1300 && (qty === 1240 || qty === 0)) {
          qty = 1300;
        }
        rmMap[rm.rawMaterialId].total += qty;
      });

      // Logged Consumables (New way)
      (p.loggedConsumables || []).forEach(lc => {
        if (!lc.rawMaterialId || !lc.total) return;
        const rmObj = rawMaterials.find(r => r.id === lc.rawMaterialId);
        const rmName = rmObj?.name || lc.name || 'Unknown Consumable';
        const rmUnit = rmObj?.unit || 'Nos';

        if (!rmMap[lc.rawMaterialId]) rmMap[lc.rawMaterialId] = { name: rmName, unit: rmUnit, total: 0 };
        rmMap[lc.rawMaterialId].total += parseFloat(lc.total) || 0;
      });

      // Old Consumables mapping
      if (p.consumables) {
        const oldMappings = {
          boxes: { name: 'Corrugated Boxes', unit: 'Nos' },
          cutPaper: { name: 'Paper Cuttings', unit: 'Kgs' },
          gum: { name: 'Liquid Gum For Pasting', unit: 'Kgs' },
          kraftPaper: { name: 'Kraft paper Roll', unit: 'Kgs' },
          stretchFilm: { name: 'Stretch wrapping Roll', unit: 'Nos' },
          plasticBags: { name: 'Plastic bags', unit: 'Nos' }
        };
        Object.entries(oldMappings).forEach(([key, info]) => {
          if (p.consumables[key]) {
            const mapKey = `old_${key}`;
            if (!rmMap[mapKey]) rmMap[mapKey] = { name: info.name, unit: info.unit, total: 0 };
            rmMap[mapKey].total += parseFloat(p.consumables[key]) || 0;
          }
        });
        if (p.consumables.sheetsMade) {
          totalSheetsMade += parseFloat(p.consumables.sheetsMade) || 0;
        }
      }

      // PVA Consumed
      if (p.pvaConsumed) {
        if (!rmMap['pva']) rmMap['pva'] = { name: 'PVA Consumed', unit: 'Kgs', total: 0 };
        rmMap['pva'].total += parseFloat(p.pvaConsumed) || 0;
      }
    });

    const aggregatedRawMaterials = Object.values(rmMap).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const aggregatedConsumables = { pva: 0, boxes: 0, cutPaper: 0, gum: 0, kraftPaper: 0, stretchFilm: 0, plasticBags: 0 };

    const looseTilesConsumedSqmtr = (totalSheetsMade / 10.76) * 1.02;

    // 4. Items Manufactured
    const mfgMap = {};
    filteredLogs.forEach(p => {
      (p.coloursFired || []).forEach(cf => {
        if (!cf.colourId || !cf.totalWeight) return;
        const colName = cf.colourName || 'Unknown Colour';
        const sizeObj = sizes.find(s => s.id === cf.sizeId);
        const sizeName = sizeObj?.name || 'Unknown Size';

        const key = `${cf.colourId}_${cf.sizeId}`;
        if (!mfgMap[key]) {
          mfgMap[key] = {
            colourName: colName,
            sizeName: sizeName,
            totalWeight: 0,
            sqmtr: 0
          };
        }
        mfgMap[key].totalWeight += parseFloat(cf.totalWeight) || 0;
      });
    });

    const aggregatedMfg = Object.values(mfgMap).map(m => {
      m.sqmtr = m.totalWeight / 10.76;
      return m;
    }).sort((a, b) =>
      a.colourName.localeCompare(b.colourName, undefined, { numeric: true, sensitivity: 'base' })
    );

    const totalLooseTilesMfg = aggregatedMfg.reduce((sum, item) => sum + item.sqmtr, 0);

    const aggregatedFinishedMaterials = {
      unglazedSqmtr: 0,
      glazedSqmtr: 0,
      glassMosaicSqmtr: 0
    };

    filteredLogs.forEach(p => {
      if (p.finishedMaterials) {
        aggregatedFinishedMaterials.unglazedSqmtr += parseFloat(p.finishedMaterials.unglazedSqmtr) || 0;
        aggregatedFinishedMaterials.glazedSqmtr += parseFloat(p.finishedMaterials.glazedSqmtr) || 0;
        aggregatedFinishedMaterials.glassMosaicSqmtr += parseFloat(p.finishedMaterials.glassMosaicSqmtr) || 0;
      }
    });

    return {
      ballMillCharges,
      coloursFired: aggregatedColoursFired,
      rawMaterials: aggregatedRawMaterials,
      totalSheetsMade,
      looseTilesConsumedSqmtr,
      manufactured: aggregatedMfg,
      totalLooseTilesMfg,
      consumables: aggregatedConsumables,
      finishedMaterials: aggregatedFinishedMaterials
    };
  }, [filteredLogs, sizes, rawMaterials]);

  const [isPrinting, setIsPrinting] = useState(false);

  const handleShowPreview = () => {
    setIsPrinting(true);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('production-print-area');
    const rptDate = reportType === 'date-wise' ? selectedDate.replace(/-/g, '') : `${startDate.replace(/-/g, '')}to${endDate.replace(/-/g, '')}`;
    const opt = {
      margin:       [0.2, 0.2],
      filename:     `DProdSummary${rptDate}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (isPrinting) {
    return (
      <div className="print-report-container" style={{ padding: '20px', background: 'white', color: '#1e293b', minHeight: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-report-container, .print-report-container * {
              visibility: visible !important;
            }
            .print-report-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white !important;
              color: #1e293b !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print, .no-print * {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}</style>
        
        {/* Print controls toolbar */}
        <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--surface-high)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>Report Preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleDownloadPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <Download size={16} /> Download PDF
            </button>
            <button 
              onClick={() => setIsPrinting(false)}
              style={{ padding: '8px 16px', background: 'var(--surface-high)', color: 'var(--on-surface)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Go Back
            </button>
          </div>
        </div>

        {/* The report layout */}
        <div id="production-print-area" style={{ maxWidth: '800px', margin: '0 auto', background: 'white', color: '#1e293b', padding: '10px' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #4f46e5', paddingBottom: '10px', marginBottom: '15px' }}>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Daily Production & Consumption Summary
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '11px', fontWeight: '500' }}>
              {reportType === 'date-wise' ? `Date: ${selectedDate}` : `Period: ${startDate} to ${endDate}`}
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4f46e5', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
              1. Item Processed
            </div>
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
              <strong>Ball Mill:</strong>
              {reportData.ballMillCharges.length === 0 ? (
                ' No active Ball Mill charges recorded in this period.'
              ) : (
                reportData.ballMillCharges.map((c, idx) => (
                  <div key={idx} style={{ marginLeft: '15px', marginTop: '4px' }}>
                    • Charge No: <strong>{c.chargeNumber}</strong> | Input: <strong>1300 kgs (Glass Scrap)</strong> &rarr; Output: <strong>1240 kgs (Glass Powder)</strong> ({c.date})
                  </div>
                ))
              )}
            </div>

            <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '8px', marginBottom: '4px', color: '#475569' }}>
              Colours / Size Fired
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Colour</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Size</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>No of Charges</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>Total Weight (Kg)</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Projects</th>
                </tr>
              </thead>
              <tbody>
                {reportData.coloursFired.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '4px 6px', fontSize: '11px' }}>No colors fired in this period</td>
                  </tr>
                ) : (
                  reportData.coloursFired.map((cf, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}><strong>{cf.colourName}</strong></td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{cf.sizeName}</td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{cf.numberOfCharges}</td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{cf.totalWeight.toFixed(1)}</td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '10px', color: '#4f46e5' }}>{Array.from(cf.projects).join(', ') || '-'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4f46e5', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
              2. Raw Material Consumed
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              {/* Left Column: Raw Materials Part 1 */}
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Material Name</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Qty Consumed</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rawMaterials.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '4px 8px', fontSize: '11px' }}>None</td>
                      </tr>
                    ) : (
                      reportData.rawMaterials.slice(0, Math.ceil(reportData.rawMaterials.length / 2)).map((rm, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{rm.name}</td>
                          <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}><strong>{rm.total.toFixed(3)}</strong></td>
                          <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{rm.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Raw Materials Part 2 */}
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Material Name</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Qty Consumed</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rawMaterials.slice(Math.ceil(reportData.rawMaterials.length / 2)).map((rm, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{rm.name}</td>
                        <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}><strong>{rm.total.toFixed(3)}</strong></td>
                        <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{rm.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '4px', color: '#1e1b4b', display: 'flex', justifyContent: 'space-between' }}>
                <span>Finished Material (SQMTR)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Unglazed Mosaic Tiles:</span>
                <strong>{reportData.finishedMaterials.unglazedSqmtr.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Glazed Mosaic Tiles:</span>
                <strong>{reportData.finishedMaterials.glazedSqmtr.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Glass Mosaic Tiles:</span>
                <strong>{reportData.finishedMaterials.glassMosaicSqmtr.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ marginTop: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '4px', color: '#1e1b4b', display: 'flex', justifyContent: 'space-between' }}>
                <span>Loose Tiles Consumed</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Total Sheets Manufactured:</span>
                <strong>{reportData.totalSheetsMade.toFixed(0)} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', borderTop: '1px solid #cbd5e1', paddingTop: '2px', fontWeight: 'bold', color: '#4f46e5' }}>
                <span>Consumed (Sheets / 10.76 + 2% Rejection):</span>
                <span style={{ fontSize: '12px' }}>{reportData.looseTilesConsumedSqmtr.toFixed(2)} SQMTR</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4f46e5', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
              3. Items Manufactured
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Colour</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Size</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Weight Processed (Kg)</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Area Manufactured (Sqmtr)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.manufactured.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '4px 6px', fontSize: '11px' }}>No items manufactured in this period</td>
                  </tr>
                ) : (
                  reportData.manufactured.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}><strong>{m.colourName}</strong></td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{m.sizeName}</td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{m.totalWeight.toFixed(1)}</td>
                      <td style={{ padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}><strong>{m.sqmtr.toFixed(2)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ marginTop: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#4f46e5' }}>
                <span>Total Loose Tiles Manufactured (Sum of Above):</span>
                <span>{reportData.totalLooseTilesMfg.toFixed(2)} SQMTR</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', color: '#94a3b8', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
            Report generated on {new Date().toLocaleString()} - Shu Factory Production Module
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={24} />
          </div>
          <div>
            <h2 style={{ color: '#818cf8', margin: 0, fontSize: '1.5rem' }}>Summary Reports</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Print Daily & Custom Period Summaries</span>
          </div>
        </div>
        
        <button
          onClick={handleShowPreview}
          disabled={filteredLogs.length === 0}
          style={{
            background: filteredLogs.length === 0 ? 'var(--surface-high)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: filteredLogs.length === 0 ? 'var(--on-surface-variant)' : 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: filteredLogs.length === 0 ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.25)',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={16} /> Report Preview
        </button>
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ border: '1px solid var(--surface-high)', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-high)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setReportType('date-wise')}
              style={{
                border: 'none',
                background: reportType === 'date-wise' ? 'var(--surface)' : 'transparent',
                color: reportType === 'date-wise' ? '#818cf8' : 'var(--on-surface-variant)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Date Wise
            </button>
            <button
              onClick={() => setReportType('custom-period')}
              style={{
                border: 'none',
                background: reportType === 'custom-period' ? 'var(--surface)' : 'transparent',
                color: reportType === 'custom-period' ? '#818cf8' : 'var(--on-surface-variant)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Custom Period
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--on-surface)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={includePending} 
                onChange={e => setIncludePending(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: '#818cf8' }}
              />
              Include Pending Approval Logs
            </label>
          </div>
        </div>

        <div style={{ marginTop: '16px', borderTop: '1px solid var(--surface-high)', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {reportType === 'date-wise' ? (
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '6px', fontWeight: '600' }}>Select Date</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px' }}
                />
                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', opacity: 0.7 }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '6px', fontWeight: '600' }}>Start Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 36px' }}
                  />
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                </div>
              </div>
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '6px', fontWeight: '600' }}>End Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 36px' }}
                  />
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)', border: '1px solid var(--surface-high)' }}>
          Loading summary data...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)', border: '1px dashed var(--surface-high)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={32} style={{ color: 'var(--warning)', opacity: 0.8 }} />
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--on-surface)' }}>No Logs Found</h3>
            <span style={{ fontSize: '0.85rem' }}>No daily production logs found for the selected {reportType === 'date-wise' ? 'date' : 'period'}.</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Item Processed */}
          <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
            <h3 style={{ fontSize: '1rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
              1. Item Processed
            </h3>
            
            <div style={{ marginBottom: '16px', background: 'var(--surface-high)', padding: '12px', borderRadius: '8px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px' }}>Ball Mill Status</strong>
              {reportData.ballMillCharges.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>No active Ball Mill charges.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {reportData.ballMillCharges.map((c, i) => (
                    <span key={i} style={{ fontSize: '0.85rem' }}>
                      • Charge Number: <strong style={{ color: '#818cf8' }}>#{c.chargeNumber}</strong> | Input: <strong>1300 kgs (Glass Scrap)</strong> → Output: <strong>1240 kgs (Glass Powder)</strong> ({c.date})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--on-surface-variant)' }}>Colours & Sizes Fired</strong>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-high)' }}>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Colour</th>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Size</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Charges</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Total Wt</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.coloursFired.map((cf, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                      <td style={{ padding: '10px 0', color: 'var(--on-surface)', fontWeight: '600' }}>{cf.colourName}</td>
                      <td style={{ padding: '10px 0', color: 'var(--on-surface-variant)' }}>{cf.sizeName}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--on-surface)' }}>{cf.numberOfCharges}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', color: '#818cf8' }}>{cf.totalWeight.toFixed(1)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Raw Material Consumed */}
          <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
            <h3 style={{ fontSize: '1rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
              2. Raw Material Consumed
            </h3>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--surface-high)' }}>
                      <th style={{ padding: '8px 0', textAlign: 'left' }}>Material Name</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Qty Consumed</th>
                      <th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '12px' }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rawMaterials.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '4px 8px', fontSize: '11px' }}>None</td>
                      </tr>
                    ) : (
                      reportData.rawMaterials.slice(0, Math.ceil(reportData.rawMaterials.length / 2)).map((rm, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                          <td style={{ padding: '8px 0', color: 'var(--on-surface)' }}>{rm.name}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#818cf8' }}>{rm.total.toFixed(3)}</td>
                          <td style={{ padding: '8px 0', paddingLeft: '12px', color: 'var(--on-surface-variant)' }}>{rm.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--surface-high)' }}>
                      <th style={{ padding: '8px 0', textAlign: 'left' }}>Material Name</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Qty Consumed</th>
                      <th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '12px' }}>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rawMaterials.slice(Math.ceil(reportData.rawMaterials.length / 2)).map((rm, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--on-surface)' }}>{rm.name}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#818cf8' }}>{rm.total.toFixed(3)}</td>
                        <td style={{ padding: '8px 0', paddingLeft: '12px', color: 'var(--on-surface-variant)' }}>{rm.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '16px', borderRadius: '10px' }}>
              <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--on-surface)', marginBottom: '8px', borderBottom: '1px solid rgba(99, 102, 241, 0.15)', paddingBottom: '6px' }}>
                Loose Tiles Consumed
              </strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Total Sheets Manufactured:</span>
                <strong style={{ color: 'var(--on-surface)' }}>{reportData.totalSheetsMade.toFixed(0)} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', fontWeight: 'bold', paddingTop: '6px', borderTop: '1px dashed rgba(99, 102, 241, 0.15)' }}>
                <span style={{ color: 'var(--on-surface)' }}>Loose Tiles Consumed in SQMTR:</span>
                <span style={{ color: '#818cf8', fontSize: '1.1rem' }}>{reportData.looseTilesConsumedSqmtr.toFixed(2)} SQMTR</span>
              </div>
            </div>
          </div>

          {/* Section 3: Items Manufactured */}
          <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
            <h3 style={{ fontSize: '1rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
              3. Items Manufactured
            </h3>
            
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-high)' }}>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Colour</th>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Size</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Wt Processed</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Area Mfg (Sqmtr)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.manufactured.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                      <td style={{ padding: '8px 0', color: 'var(--on-surface)', fontWeight: '600' }}>{m.colourName}</td>
                      <td style={{ padding: '8px 0', color: 'var(--on-surface-variant)' }}>{m.sizeName}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--on-surface)' }}>{m.totalWeight.toFixed(1)} kg</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#818cf8' }}>{m.sqmtr.toFixed(2)} Sqmtr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--on-surface)' }}>Total Loose Tiles Manufactured (Sum):</span>
              <span style={{ color: '#818cf8', fontSize: '1.1rem' }}>{reportData.totalLooseTilesMfg.toFixed(2)} SQMTR</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
