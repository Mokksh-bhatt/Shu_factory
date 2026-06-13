import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { PackageOpen, Save, Truck, Plus } from 'lucide-react';
import { useToast } from '../../Toast';

export default function RawMaterialInward({ t }) {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [recentInwards, setRecentInwards] = useState([]);
  const { showToast } = useToast();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRm, setSelectedRm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [quantity, setQuantity] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubRm = onSnapshot(collection(db, 'production_raw_materials'), s => {
      setRawMaterials(s.docs.map(d => ({id: d.id, ...d.data()})));
    });
    const unsubSuppliers = onSnapshot(collection(db, 'production_suppliers'), s => {
      setSuppliers(s.docs.map(d => ({id: d.id, ...d.data()})));
    });
    
    // Fetch recent inwards
    const qInward = query(collection(db, 'raw_material_inward'), orderBy('date', 'desc'), limit(10));
    const unsubInward = onSnapshot(qInward, s => {
      setRecentInwards(s.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => { unsubRm(); unsubSuppliers(); unsubInward(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRm || !quantity) {
      showToast('Please select a material and enter quantity', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const rm = rawMaterials.find(r => r.id === selectedRm);
      const supplier = suppliers.find(s => s.id === selectedSupplier);

      await addDoc(collection(db, 'raw_material_inward'), {
        date,
        rawMaterialId: rm.id,
        rawMaterialName: rm.name,
        unit: rm.unit || 'Kgs',
        supplierId: supplier ? supplier.id : null,
        supplierName: supplier ? supplier.name : null,
        quantity: parseFloat(quantity),
        vehicleNo: vehicleNo.trim(),
        remarks: remarks.trim(),
        createdAt: serverTimestamp()
      });

      showToast('Inward receipt saved successfully', 'success');
      
      // Reset form
      setQuantity('');
      setVehicleNo('');
      setRemarks('');
      setSelectedRm('');
      setSelectedSupplier('');
    } catch (err) {
      console.error(err);
      showToast('Error saving inward', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PackageOpen size={24} />
        </div>
        <h2 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem' }}>Raw Material Inward</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--surface-high)', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Date *</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Raw Material *</label>
            <select 
              value={selectedRm} 
              onChange={e => setSelectedRm(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
            >
              <option value="">Select Material...</option>
              {rawMaterials.map(rm => (
                <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit || 'Kgs'})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Quantity *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                required
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', minWidth: '35px' }}>
                {selectedRm ? rawMaterials.find(r => r.id === selectedRm)?.unit || 'Kgs' : 'Qty'}
              </span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Supplier</label>
            <select 
              value={selectedSupplier} 
              onChange={e => setSelectedSupplier(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
            >
              <option value="">Select Supplier (Optional)</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Vehicle / Transport No.</label>
            <input 
              type="text" 
              placeholder="e.g. GJ 06 AB 1234" 
              value={vehicleNo} 
              onChange={e => setVehicleNo(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Remarks / Challan No.</label>
            <input 
              type="text" 
              placeholder="Optional notes..." 
              value={remarks} 
              onChange={e => setRemarks(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-high)', background: 'var(--background)', color: 'var(--on-surface)' }}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="btn-primary" 
          style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? 'Saving...' : <><Save size={20} /> Save Inward Receipt</>}
        </button>
      </form>

      {/* Recent Inwards List */}
      <div>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--on-surface)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={18} /> Recent Inwards
        </h3>
        
        {recentInwards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface)', borderRadius: '16px', color: 'var(--on-surface-variant)', border: '1px dashed var(--surface-high)' }}>
            No inward records found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentInwards.map(log => (
              <div key={log.id} style={{ background: 'var(--surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--surface-high)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--on-background)', fontSize: '1.05rem', marginBottom: '4px' }}>
                    {log.rawMaterialName} <span style={{ color: '#fbbf24' }}>+{log.quantity} {log.unit}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                    {new Date(log.date).toLocaleDateString()} {log.supplierName ? `• ${log.supplierName}` : ''} {log.vehicleNo ? `• ${log.vehicleNo}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
