import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit3, Printer, CheckCircle } from 'lucide-react';

import DailyProductionForm from '../owner/production/DailyProductionForm';
import MasterDataAdmin from '../owner/production/MasterDataAdmin';
import RawMaterialInward from '../owner/production/RawMaterialInward';

import ProductionSummaryReport from '../owner/production/ProductionSummaryReport';
import MonthlyProductionGrid from '../owner/production/MonthlyProductionGrid';
import StockSummaryReport from '../owner/production/StockSummaryReport';
import ProductionReports from '../owner/production/ProductionReports';

export default function UnifiedProductionView({ onBack, t, context }) {
  const [activeTab, setActiveTab] = useState('entry'); // 'entry', 'prints', 'review'
  
  // Entry Sub-tabs
  const [entryTab, setEntryTab] = useState('daily'); // 'daily', 'master', 'inward'
  
  // Prints Sub-tabs
  const [printsTab, setPrintsTab] = useState('summary'); // 'entry_summary', 'summary', 'grid', 'stock'

  // Review Sub-tabs
  const [reviewTab, setReviewTab] = useState('history'); // 'history', 'pending'

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <button 
          onClick={onBack}
          style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>Production</h2>
      </header>

      {/* Top Level Navigation */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-high)', padding: '6px', borderRadius: '16px' }}>
        <button 
          onClick={() => setActiveTab('entry')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'entry' ? 'var(--primary)' : 'transparent', color: activeTab === 'entry' ? 'white' : 'var(--on-surface)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer' }}
        >
          <Edit3 size={18} /> Entry
        </button>
        <button 
          onClick={() => setActiveTab('prints')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'prints' ? 'var(--primary)' : 'transparent', color: activeTab === 'prints' ? 'white' : 'var(--on-surface)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer' }}
        >
          <Printer size={18} /> Prints
        </button>
        <button 
          onClick={() => setActiveTab('review')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'review' ? 'var(--primary)' : 'transparent', color: activeTab === 'review' ? 'white' : 'var(--on-surface)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease', cursor: 'pointer' }}
        >
          <CheckCircle size={18} /> Review
        </button>
      </div>

      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* ENTRY SECTION */}
        {activeTab === 'entry' && (
          <>
            <div style={{ display: 'flex', gap: '8px', padding: '12px', borderBottom: '1px solid var(--surface-high)' }}>
              {['daily', 'master', 'inward'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setEntryTab(tab)}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: entryTab === tab ? 'var(--primary)' : 'transparent', background: entryTab === tab ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-high)', color: entryTab === tab ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {tab === 'daily' ? 'Daily Logs' : tab === 'master' ? 'Master Data' : 'RM Inward'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {entryTab === 'daily' && <DailyProductionForm t={t} />}
              {entryTab === 'master' && <MasterDataAdmin t={t} />}
              {entryTab === 'inward' && <RawMaterialInward t={t} />}
            </div>
          </>
        )}

        {/* PRINTS SECTION */}
        {activeTab === 'prints' && (
          <>
            <div style={{ display: 'flex', gap: '8px', padding: '12px', borderBottom: '1px solid var(--surface-high)', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { id: 'entry_summary', label: 'Entry Summary' },
                { id: 'summary', label: 'Consum + Prod' },
                { id: 'grid', label: 'Day Wise Grid' },
                { id: 'stock', label: 'Stock Valuation' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setPrintsTab(tab.id)}
                  style={{ whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: printsTab === tab.id ? 'var(--primary)' : 'transparent', background: printsTab === tab.id ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-high)', color: printsTab === tab.id ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {printsTab === 'entry_summary' && <ProductionReports t={t} filterStatus="ALL" />}
              {printsTab === 'summary' && <ProductionSummaryReport t={t} />}
              {printsTab === 'grid' && <MonthlyProductionGrid t={t} />}
              {printsTab === 'stock' && <StockSummaryReport t={t} />}
            </div>
          </>
        )}

        {/* REVIEW SECTION */}
        {activeTab === 'review' && (
          <>
            <div style={{ display: 'flex', gap: '8px', padding: '12px', borderBottom: '1px solid var(--surface-high)' }}>
              {['history', 'pending'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setReviewTab(tab)}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: reviewTab === tab ? 'var(--primary)' : 'transparent', background: reviewTab === tab ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-high)', color: reviewTab === tab ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {tab === 'history' ? 'History (Approved)' : 'Pending Approvals'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {reviewTab === 'history' && <ProductionReports t={t} filterStatus="APPROVED" />}
              {reviewTab === 'pending' && <ProductionReports t={t} filterStatus="PENDING_APPROVAL" />}
            </div>
          </>
        )}

      </div>
    </motion.div>
  );
}
