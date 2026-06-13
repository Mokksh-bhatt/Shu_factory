import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Shield, Settings } from 'lucide-react';
import OwnerSettingsView from '../owner/OwnerSettingsView';

export default function UnifiedAdminView({ onBack, t, context }) {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <button 
          onClick={onBack}
          style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>Admin</h2>
      </header>

      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
        <Shield size={64} style={{ marginBottom: '16px', color: 'var(--surface-high)' }} />
        <p>Admin Settings Area</p>
        <p style={{ fontSize: '0.85rem' }}>User management and global settings will go here.</p>
      </div>
    </motion.div>
  );
}
