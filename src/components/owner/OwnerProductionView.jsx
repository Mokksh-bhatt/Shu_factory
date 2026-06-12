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
      {/* Premium Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        background: 'var(--surface-high)', 
        padding: '6px', 
        borderRadius: '16px',
        overflowX: 'auto',
        scrollbarWidth: 'none', /* Firefox */
        WebkitOverflowScrolling: 'touch',
        border: '1px solid #333'
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          .prod-tab-btn {
            flex: 1 0 auto;
            padding: 10px 16px;
            border-radius: 12px;
            border: none;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            white-space: nowrap;
          }
          .prod-tab-btn.active {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          .prod-tab-btn.inactive {
            background: transparent;
            color: var(--on-surface-variant);
          }
          .prod-tab-btn.inactive:hover {
            background: rgba(255, 255, 255, 0.05);
            color: white;
          }
        `}} />
        <button
          onClick={() => setActiveTab('daily')}
          className={`prod-tab-btn ${activeTab === 'daily' ? 'active' : 'inactive'}`}
        >
          <Plus size={16} /> Entry
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`prod-tab-btn ${activeTab === 'reviews' ? 'active' : 'inactive'}`}
        >
          <ClipboardList size={16} /> Reviews
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`prod-tab-btn ${activeTab === 'reports' ? 'active' : 'inactive'}`}
        >
          <FileText size={16} /> History
        </button>
        <button
          onClick={() => setActiveTab('summaryReport')}
          className={`prod-tab-btn ${activeTab === 'summaryReport' ? 'active' : 'inactive'}`}
        >
          <Printer size={16} /> Summary
        </button>
        <button
          onClick={() => setActiveTab('stockSummary')}
          className={`prod-tab-btn ${activeTab === 'stockSummary' ? 'active' : 'inactive'}`}
        >
          <FileSpreadsheet size={16} /> Stock
        </button>
        <button
          onClick={() => setActiveTab('monthlyGrid')}
          className={`prod-tab-btn ${activeTab === 'monthlyGrid' ? 'active' : 'inactive'}`}
        >
          <Database size={16} /> Grid
        </button>
        <button
          onClick={() => setActiveTab('master')}
          className={`prod-tab-btn ${activeTab === 'master' ? 'active' : 'inactive'}`}
        >
          <Package size={16} /> Master
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
