import { useState } from 'react';
import { Package, Plus, Database, FileText, ClipboardList, FileSpreadsheet, Printer } from 'lucide-react';
import DailyProductionForm from './production/DailyProductionForm';
import MasterDataAdmin from './production/MasterDataAdmin';
import ProductionReports from './production/ProductionReports';
import StockSummaryReport from './production/StockSummaryReport';
import ProductionSummaryReport from './production/ProductionSummaryReport';
import MonthlyProductionGrid from './production/MonthlyProductionGrid';

export default function OwnerProductionView({ t }) {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'reviews', 'reports', 'summaryReport', 'stockSummary', 'master'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '6px', 
        background: 'var(--surface-high)', 
        padding: '6px', 
        borderRadius: '16px'
      }}>
        <button
          onClick={() => setActiveTab('daily')}
          style={{
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
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
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
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
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'reports' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'reports' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <FileText size={16} /> History
        </button>
        <button
          onClick={() => setActiveTab('summaryReport')}
          style={{
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'summaryReport' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'summaryReport' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <Printer size={16} /> Summary
        </button>
        <button
          onClick={() => setActiveTab('stockSummary')}
          style={{
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'stockSummary' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'stockSummary' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <FileSpreadsheet size={16} /> Stock
        </button>
        <button
          onClick={() => setActiveTab('monthlyGrid')}
          style={{
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'monthlyGrid' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'monthlyGrid' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <Database size={16} /> Grid
        </button>
        <button
          onClick={() => setActiveTab('master')}
          style={{
            padding: '8px 10px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'master' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'master' ? 'white' : 'var(--on-surface-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <Database size={16} /> Master
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '16px', padding: '16px' }}>
        {activeTab === 'daily' && <DailyProductionForm t={t} />}
        {activeTab === 'reviews' && <ProductionReports t={t} filterStatus="PENDING_APPROVAL" />}
        {activeTab === 'reports' && <ProductionReports t={t} filterStatus="APPROVED" />}
        {activeTab === 'summaryReport' && <ProductionSummaryReport t={t} />}
        {activeTab === 'monthlyGrid' && <MonthlyProductionGrid t={t} />}
        {activeTab === 'stockSummary' && <StockSummaryReport t={t} />}
        {activeTab === 'master' && <MasterDataAdmin t={t} />}
      </div>
    </div>
  );
}
