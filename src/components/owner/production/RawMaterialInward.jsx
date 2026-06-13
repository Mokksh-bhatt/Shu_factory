import { motion } from 'framer-motion';
import { PackageOpen } from 'lucide-react';

export default function RawMaterialInward() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-high)', marginBottom: '16px' }}>
        <PackageOpen size={40} color="var(--primary)" />
      </div>
      <h3 style={{ margin: '0 0 8px', color: 'var(--on-background)' }}>Raw Material Inward</h3>
      <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
        This module will be implemented soon to track incoming inventory.
      </p>
    </motion.div>
  );
}
