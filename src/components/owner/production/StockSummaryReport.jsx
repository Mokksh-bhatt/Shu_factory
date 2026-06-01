import { useState, useEffect, useMemo, Fragment } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Plus, Trash2, Printer, Calendar, Filter, Loader, RefreshCw, FileSpreadsheet, ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';

export default function StockSummaryReport({ t }) {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [productions, setProductions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includePending, setIncludePending] = useState(true);

  // Period States
  const [periodType, setPeriodType] = useState('yearly'); // 'daily', 'monthly', 'yearly', 'custom'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState('2024-25'); // Financial Year
  const [customStart, setCustomStart] = useState('2024-04-01');
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

  // Transaction form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [formType, setFormType] = useState('INWARD'); // 'INWARD', 'OPENING'
  const [formMaterial, setFormMaterial] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch standard data
  useEffect(() => {
    setLoading(true);
    const u1 = onSnapshot(collection(db, 'production_raw_materials'), s => {
      setRawMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const u2 = onSnapshot(collection(db, 'dailyProductions'), s => {
      setProductions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const u3 = onSnapshot(collection(db, 'inventory_transactions'), s => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { u1(); u2(); u3(); };
  }, []);

  // Set default rate when material is selected in form
  useEffect(() => {
    if (formMaterial) {
      const rm = rawMaterials.find(r => r.id === formMaterial);
      if (rm) {
        setFormRate(rm.currentRate || '0');
      }
    } else {
      setFormRate('');
    }
  }, [formMaterial, rawMaterials]);

  // Calculate Date Boundaries based on filters
  const dateRange = useMemo(() => {
    let startStr = '';
    let endStr = '';

    if (periodType === 'daily') {
      startStr = selectedDate;
      endStr = selectedDate;
    } else if (periodType === 'monthly') {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      startStr = `${selectedMonth}-01`;
      endStr = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    } else if (periodType === 'yearly') {
      const startYear = parseInt(selectedYear.split('-')[0]);
      const century = 2000; // Assuming 2000s
      startStr = `${startYear}-04-01`;
      endStr = `${century + parseInt(selectedYear.split('-')[1])}-03-31`;
    } else {
      startStr = customStart;
      endStr = customEnd;
    }

    return { start: startStr, end: endStr };
  }, [periodType, selectedDate, selectedMonth, selectedYear, customStart, customEnd]);

  // Filter daily productions based on approval state toggle
  const filteredProductions = useMemo(() => {
    return productions.filter(p => {
      if (!includePending && p.status !== 'APPROVED') return false;
      return true;
    });
  }, [productions, includePending]);

  // dynamic stock calculations
  const ledgerReport = useMemo(() => {
    if (rawMaterials.length === 0) return [];

    const { start, end } = dateRange;

    // Aggregate Transactions and Production Outwards
    return rawMaterials.map(rm => {
      const id = rm.id;
      const rate = rm.currentRate || 0;

      // 1. Transactions before start (to compute dynamic opening stock)
      const prevTransactions = transactions.filter(t => t.rawMaterialId === id && t.date < start);
      
      const prevOpenQty = prevTransactions.filter(t => t.type === 'OPENING').reduce((sum, t) => sum + (t.quantity || 0), 0);
      const prevOpenVal = prevTransactions.filter(t => t.type === 'OPENING').reduce((sum, t) => sum + (t.value || 0), 0);
      
      const prevInwardQty = prevTransactions.filter(t => t.type === 'INWARD').reduce((sum, t) => sum + (t.quantity || 0), 0);
      const prevInwardVal = prevTransactions.filter(t => t.type === 'INWARD').reduce((sum, t) => sum + (t.value || 0), 0);
      
      // Consumption before start
      let prevOutwardQty = 0;
      filteredProductions.forEach(p => {
        if (p.date < start && p.calculatedRawMaterials) {
          const matched = p.calculatedRawMaterials.find(item => item.rawMaterialId === id);
          if (matched) {
            prevOutwardQty += parseFloat(matched.total) || 0;
          }
        }
      });

      // Running average rate before period start
      const totalPrevQty = prevOpenQty + prevInwardQty;
      const totalPrevVal = prevOpenVal + prevInwardVal;
      const prevAvgRate = totalPrevQty > 0 ? totalPrevVal / totalPrevQty : rate;
      const prevOutwardVal = prevOutwardQty * prevAvgRate;

      // Dynamic Opening Balance at start of period = Inwards before + Opening before - Consumed before
      const openingQty = prevOpenQty + prevInwardQty - prevOutwardQty;
      const openingVal = prevOpenQty + prevInwardQty > 0 ? prevOpenVal + prevInwardVal - prevOutwardVal : 0;
      const openingRate = openingQty > 0 ? openingVal / openingQty : rate;

      // 2. Transactions WITHIN period
      const currentTransactions = transactions.filter(t => t.rawMaterialId === id && t.date >= start && t.date <= end);
      
      const periodOpenQty = currentTransactions.filter(t => t.type === 'OPENING').reduce((sum, t) => sum + (t.quantity || 0), 0);
      const periodOpenVal = currentTransactions.filter(t => t.type === 'OPENING').reduce((sum, t) => sum + (t.value || 0), 0);

      const inwardsQty = currentTransactions.filter(t => t.type === 'INWARD').reduce((sum, t) => sum + (t.quantity || 0), 0);
      const inwardsVal = currentTransactions.filter(t => t.type === 'INWARD').reduce((sum, t) => sum + (t.value || 0), 0);

      // Total adjusted opening balance
      const adjustedOpeningQty = openingQty + periodOpenQty;
      const adjustedOpeningVal = openingVal + periodOpenVal;
      const adjustedOpeningRate = adjustedOpeningQty > 0 ? adjustedOpeningVal / adjustedOpeningQty : rate;

      // Weighted average calculation for current period
      const totalAvailableQty = adjustedOpeningQty + inwardsQty;
      const totalAvailableVal = adjustedOpeningVal + inwardsVal;
      const periodAvgRate = totalAvailableQty > 0 ? totalAvailableVal / totalAvailableQty : rate;

      // 3. Outwards (consumptions) WITHIN period
      let outwardsQty = 0;
      let outwardsVal = 0;
      filteredProductions.forEach(p => {
        if (p.date >= start && p.date <= end && p.calculatedRawMaterials) {
          const matched = p.calculatedRawMaterials.find(item => item.rawMaterialId === id);
          if (matched) {
            const qty = parseFloat(matched.total) || 0;
            // Get rate snapshot fallback correctly using || instead of ?? to avoid 0 valuation
            const prodRate = p.rmRatesSnapshot?.[id]?.currentRate || periodAvgRate;
            outwardsQty += qty;
            outwardsVal += qty * prodRate;
          }
        }
      });

      // 4. Closing Balance
      const closingQty = totalAvailableQty - outwardsQty;
      const closingVal = totalAvailableVal - outwardsVal;
      const closingRate = closingQty > 0 ? closingVal / closingQty : periodAvgRate;

      return {
        id,
        name: rm.name,
        code: rm.code || 'raw---',
        group: rm.group || 'Raw Material',
        unit: rm.unit || 'Kgs',
        opening: { qty: adjustedOpeningQty, rate: adjustedOpeningRate, val: adjustedOpeningVal },
        inwards: { qty: inwardsQty, rate: inwardsQty > 0 ? inwardsVal / inwardsQty : rate, val: inwardsVal },
        outwards: { qty: outwardsQty, rate: outwardsQty > 0 ? outwardsVal / outwardsQty : periodAvgRate, val: outwardsVal },
        closing: { qty: closingQty, rate: closingRate, val: closingVal }
      };
    });
  }, [rawMaterials, filteredProductions, transactions, dateRange]);

  // Group ledger report by raw material category/group
  const groupedReport = useMemo(() => {
    const groups = {};
    ledgerReport.forEach(item => {
      const g = item.group;
      if (!groups[g]) {
        groups[g] = { name: g, items: [], totals: { opening: 0, inwards: 0, outwards: 0, closing: 0 } };
      }
      groups[g].items.push(item);
      groups[g].totals.opening += item.opening.val;
      groups[g].totals.inwards += item.inwards.val;
      groups[g].totals.outwards += item.outwards.val;
      groups[g].totals.closing += item.closing.val;
    });
    return Object.values(groups);
  }, [ledgerReport]);

  // Grand Totals
  const grandTotals = useMemo(() => {
    const totals = { opening: 0, inwards: 0, outwards: 0, closing: 0 };
    ledgerReport.forEach(item => {
      totals.opening += item.opening.val;
      totals.inwards += item.inwards.val;
      totals.outwards += item.outwards.val;
      totals.closing += item.closing.val;
    });
    return totals;
  }, [ledgerReport]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!formMaterial || !formQty || !formDate) {
      alert('Please fill out all required fields.');
      return;
    }

    setFormSubmitting(true);
    try {
      const rm = rawMaterials.find(r => r.id === formMaterial);
      const qty = parseFloat(formQty) || 0;
      const rateVal = parseFloat(formRate) || 0;
      const totalValue = qty * rateVal;

      await addDoc(collection(db, 'inventory_transactions'), {
        rawMaterialId: formMaterial,
        type: formType,
        date: formDate,
        quantity: qty,
        rate: rateVal,
        value: totalValue,
        createdAt: serverTimestamp()
      });

      alert(`${formType === 'INWARD' ? 'Inward stock added' : 'Opening stock adjustment saved'} successfully!`);
      setFormQty('');
      setFormMaterial('');
    } catch (err) {
      console.error(err);
      alert('Failed to log stock transaction: ' + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (confirm('Are you sure you want to delete this transaction? This will recalculate stock valuation.')) {
      await deleteDoc(doc(db, 'inventory_transactions', id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const recentTransactions = useMemo(() => {
    return transactions
      .map(t => {
        const rm = rawMaterials.find(r => r.id === t.rawMaterialId);
        return {
          ...t,
          materialName: rm?.name || 'Unknown'
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [transactions, rawMaterials]);

  return (
    <div style={{ maxWidth: '100%', paddingBottom: '40px' }} className="no-select">
      {/* Styles for printing and custom Tally appearance */}
      <style>{`
        .only-print {
          display: none !important;
        }
        
        @media print {
          .only-print {
            display: block !important;
          }
          body * {
            visibility: hidden;
            background: #ffffff !important;
            color: #000000 !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .tally-table {
            border-collapse: collapse !important;
            width: 100% !important;
            color: #000000 !important;
            border: 2px solid #000000 !important;
          }
          .tally-table th, .tally-table td {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            font-size: 7.5pt !important;
            padding: 2px 4px !important;
          }
          .tally-group-row {
            background-color: #f2f2f2 !important;
            font-weight: bold !important;
          }
          .tally-total-row {
            border-top: 2px solid #000000 !important;
            border-bottom: 4px double #000000 !important;
            font-weight: bold !important;
          }
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        }
        
        .tally-table-container {
          overflow-x: auto;
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid var(--surface-high);
          border-radius: 12px;
          margin-top: 16px;
        }

        .tally-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          min-width: 1000px;
        }

        .tally-table th {
          background: var(--surface-high);
          color: var(--on-surface-variant);
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          font-size: 0.75rem;
          border-bottom: 2px solid var(--surface-high);
        }

        .tally-table td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .tally-group-row {
          background: rgba(99, 102, 241, 0.05);
          font-weight: bold;
          color: #818cf8 !important;
        }

        .tally-total-row {
          background: rgba(255, 255, 255, 0.02);
          border-top: 2px solid var(--surface-high);
          border-bottom: 4px double var(--surface-high);
          font-weight: bold;
          color: var(--on-surface);
        }

        .double-underline {
          border-bottom: 3px double var(--on-surface);
        }
      `}</style>

      {/* DASHBOARD HEADER */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 style={{ color: '#10b981', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Stock Group Summary</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Valuation Ledger Period Report</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: showLogForm ? 'var(--surface-high)' : 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: `1px solid ${showLogForm ? 'var(--surface-high)' : 'rgba(16, 185, 129, 0.2)'}`,
              fontWeight: 'bold',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {showLogForm ? <ChevronUp size={16} /> : <Plus size={16} />} 
            {showLogForm ? 'Close Entry Drawer' : 'Log Inwards & Opening'}
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <Printer size={16} /> Print Valuation PDF
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE LOGS DRAWER / TRANSACTION FORM */}
      {showLogForm && (
        <div className="card no-print" style={{ border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.02)', padding: '20px', borderRadius: '16px', marginBottom: '24px', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Form Section */}
            <form onSubmit={handleAddTransaction} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#10b981', fontWeight: 'bold' }}>Log Stock Addition</h3>
              
              <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-high)', padding: '4px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFormType('INWARD')}
                  style={{
                    flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                    background: formType === 'INWARD' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                    color: formType === 'INWARD' ? 'white' : 'var(--on-surface-variant)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Inward (Purchase)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('OPENING')}
                  style={{
                    flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                    background: formType === 'OPENING' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                    color: formType === 'OPENING' ? 'white' : 'var(--on-surface-variant)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Opening Stock Balance
                </button>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Select Raw Material</label>
                <SearchableSelect
                  options={rawMaterials.map(rm => ({ value: rm.id, label: `${rm.name} (${rm.code || '-'})` }))}
                  value={formMaterial}
                  onChange={setFormMaterial}
                  placeholder="Search material..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Quantity</label>
                  <input
                    type="number" step="0.01" placeholder="e.g. 500"
                    value={formQty} onChange={e => setFormQty(e.target.value)} required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Rate (₹/Kg or ₹/Nos)</label>
                  <input
                    type="number" step="0.01" placeholder="e.g. 15.50"
                    value={formRate} onChange={e => setFormRate(e.target.value)} required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Transaction Date</label>
                <input
                  type="date"
                  value={formDate} onChange={e => setFormDate(e.target.value)} required
                />
              </div>

              <button
                type="submit"
                disabled={formSubmitting}
                style={{
                  padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                  border: 'none', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'var(--font-display)', marginTop: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', opacity: formSubmitting ? 0.7 : 1
                }}
              >
                {formSubmitting ? 'Submitting...' : formType === 'INWARD' ? 'Add Inward Stock' : 'Set Opening Balance'}
              </button>
            </form>

            {/* Recent Transaction Log List */}
            <div style={{ flex: '1.2 1 350px', borderLeft: '1px solid var(--surface-high)', paddingLeft: '20px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>Recent Ledger Log</h3>
              
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {recentTransactions.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--surface-high)', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--on-surface)' }}>{t.materialName}</span>
                        <span style={{
                          fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                          background: t.type === 'INWARD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: t.type === 'INWARD' ? '#10b981' : '#818cf8'
                        }}>
                          {t.type}
                        </span>
                      </div>
                      <div style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem', marginTop: '2px' }}>
                        Date: {t.date} • {t.quantity} Units @ ₹{t.rate?.toFixed(2)}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ color: '#10b981' }}>₹{t.value?.toFixed(2)}</strong>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(t.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {recentTransactions.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--on-surface-variant)', fontSize: '0.9rem', opacity: 0.6 }}>
                    <AlertCircle size={28} style={{ marginBottom: '8px' }} />
                    <span>No ledger transactions found.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DYNAMIC FILTER BAR */}
      <div className="card no-print" style={{ border: '1px solid var(--surface-high)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--on-surface-variant)' }}>Period Type:</span>
          </div>

          <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '4px', borderRadius: '8px' }}>
            {['daily', 'monthly', 'yearly', 'custom'].map(type => (
              <button
                key={type}
                onClick={() => setPeriodType(type)}
                style={{
                  padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                  background: periodType === type ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                  color: periodType === type ? 'white' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s ease'
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

        </div>

        {/* Dynamic Period Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600', cursor: 'pointer', userSelect: 'none', marginRight: '8px' }}>
            <input
              type="checkbox"
              checked={includePending}
              onChange={e => setIncludePending(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#10b981'
              }}
            />
            Include Pending Review Logs
          </label>

          {periodType === 'daily' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--on-surface-variant)' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem', width: '160px' }}
              />
            </div>
          )}

          {periodType === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--on-surface-variant)' }} />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem', width: '160px' }}
              />
            </div>
          )}

          {periodType === 'yearly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--on-surface-variant)' }} />
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--surface-high)', background: 'var(--surface)', color: 'var(--on-surface)', fontSize: '0.85rem' }}
              >
                <option value="2024-25">FY 2024-25 (1-Apr-24 to 31-Mar-25)</option>
                <option value="2025-26">FY 2025-26 (1-Apr-25 to 31-Mar-26)</option>
                <option value="2026-27">FY 2026-27 (1-Apr-26 to 31-Mar-27)</option>
              </select>
            </div>
          )}

          {periodType === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem', width: '140px' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem', width: '140px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* PRINT ENVELOPE HEADER (Visible only on printing) */}
      <div id="print-area">
        <div className="only-print">
          <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #000000', paddingBottom: '16px' }}>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '18pt', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000' }}>SHON CERAMICS PVT LTD</h1>
            <p style={{ margin: '0 0 12px 0', fontSize: '10pt', color: '#000000' }}>159, GIDC, MAKARPURA, VADODARA-390010 GUJARAT</p>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '14pt', fontWeight: 'bold', textDecoration: 'underline', color: '#000000' }}>Stock Group Summary</h2>
            <p style={{ margin: 0, fontSize: '10pt', fontWeight: 'bold', color: '#000000' }}>
              Period: {dateRange.start} to {dateRange.end}
            </p>
          </div>
        </div>

        {/* LOADING INDICATOR */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '12px' }}>
            <RefreshCw size={36} className="spin-animation" style={{ color: '#10b981' }} />
            <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem' }}>Loading Inventory Ledger...</span>
          </div>
        ) : (
          /* VALUATION LEDGER TABLE VIEW */
          <div className="tally-table-container">
            <table className="tally-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ textAlign: 'left', minWidth: '220px' }}>Particulars</th>
                  <th colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Opening Balance</th>
                  <th colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Inwards</th>
                  <th colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Outwards</th>
                  <th colSpan={3} style={{ textAlign: 'center' }}>Closing Balance</th>
                </tr>
                <tr>
                  {/* Opening */}
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Quantity</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Rate</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Value</th>
                  {/* Inwards */}
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Quantity</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Rate</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Value</th>
                  {/* Outwards */}
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Quantity</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Rate</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.08)' }}>Value</th>
                  {/* Closing */}
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Quantity</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Rate</th>
                  <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {groupedReport.map(group => (
                  <Fragment key={group.name}>
                    {/* Stock Group Header */}
                    <tr className="tally-group-row">
                      <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{group.name.toUpperCase()}</td>
                      {/* Opening */}
                      <td colSpan={2}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{group.totals.opening?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {/* Inwards */}
                      <td colSpan={2}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{group.totals.inwards?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {/* Outwards */}
                      <td colSpan={2}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{group.totals.outwards?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {/* Closing */}
                      <td colSpan={2}></td>
                      <td style={{ textAlign: 'right' }}>₹{group.totals.closing?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>

                    {/* Stock Group Items */}
                    {group.items.map(item => (
                      <tr key={item.id} style={{ color: 'var(--on-surface)' }}>
                        <td style={{ textAlign: 'left', paddingLeft: '24px', fontWeight: '500' }}>{item.name}</td>
                        
                        {/* Opening */}
                        <td style={{ textAlign: 'right' }}>{item.opening.qty > 0 ? `${item.opening.qty.toFixed(2)} ${item.unit}` : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>{item.opening.qty > 0 ? `₹${item.opening.rate.toFixed(2)}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: '500', borderRight: '1px solid rgba(255,255,255,0.08)' }}>{item.opening.qty > 0 ? `₹${item.opening.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                        
                        {/* Inwards */}
                        <td style={{ textAlign: 'right' }}>{item.inwards.qty > 0 ? `${item.inwards.qty.toFixed(2)} ${item.unit}` : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>{item.inwards.qty > 0 ? `₹${item.inwards.rate.toFixed(2)}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: '500', borderRight: '1px solid rgba(255,255,255,0.08)' }}>{item.inwards.qty > 0 ? `₹${item.inwards.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                        
                        {/* Outwards */}
                        <td style={{ textAlign: 'right' }}>{item.outwards.qty > 0 ? `${item.outwards.qty.toFixed(2)} ${item.unit}` : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>{item.outwards.qty > 0 ? `₹${item.outwards.rate.toFixed(2)}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: '500', borderRight: '1px solid rgba(255,255,255,0.08)' }}>{item.outwards.qty > 0 ? `₹${item.outwards.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                        
                        {/* Closing */}
                        <td style={{ textAlign: 'right' }}>{item.closing.qty !== 0 ? `${item.closing.qty.toFixed(2)} ${item.unit}` : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>{item.closing.qty !== 0 ? `₹${item.closing.rate.toFixed(2)}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.closing.qty !== 0 ? `₹${item.closing.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}

                {/* Grand Total Row */}
                <tr className="tally-total-row">
                  <td style={{ textAlign: 'left', fontWeight: 'bold', textTransform: 'uppercase' }} className="double-underline">Grand Total</td>
                  
                  {/* Opening */}
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{grandTotals.opening?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  
                  {/* Inwards */}
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{grandTotals.inwards?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  
                  {/* Outwards */}
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' }}>₹{grandTotals.outwards?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  
                  {/* Closing */}
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'right' }}>₹{grandTotals.closing?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
