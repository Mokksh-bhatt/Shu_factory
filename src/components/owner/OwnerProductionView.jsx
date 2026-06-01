import { useState } from 'react';
import { Package, Plus, Database, FileText, ClipboardList, FileSpreadsheet } from 'lucide-react';
import DailyProductionForm from './production/DailyProductionForm';
import MasterDataAdmin from './production/MasterDataAdmin';
import ProductionReports from './production/ProductionReports';
import StockSummaryReport from './production/StockSummaryReport';

export default function OwnerProductionView({ t }) {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'reviews', 'reports', 'master', 'stockSummary'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        background: 'var(--surface-high)', 
        padding: '6px', 
        borderRadius: '16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexWrap: 'nowrap'
      }}>
        <button
          onClick={() => setActiveTab('daily')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'daily' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'daily' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <Plus size={16} /> Entry
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'reviews' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'reviews' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <ClipboardList size={16} /> Reviews
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'reports' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'reports' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <FileText size={16} /> History
        </button>
        <button
          onClick={() => setActiveTab('stockSummary')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'stockSummary' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'stockSummary' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <FileSpreadsheet size={16} /> Stock Summary
        </button>
        <button
          onClick={() => setActiveTab('master')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'master' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'master' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <Database size={16} /> Master Data
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '16px', padding: '16px' }}>
        {activeTab === 'daily' && <DailyProductionForm t={t} />}
        {activeTab === 'reviews' && <ProductionReports t={t} filterStatus="PENDING_APPROVAL" />}
        {activeTab === 'reports' && <ProductionReports t={t} filterStatus="APPROVED" />}
        {activeTab === 'stockSummary' && <StockSummaryReport t={t} />}
        {activeTab === 'master' && <MasterDataAdmin t={t} />}
      </div>
    </div>
  );
}
