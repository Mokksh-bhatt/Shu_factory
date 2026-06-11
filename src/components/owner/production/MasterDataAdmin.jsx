import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, query } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Plus, Trash2, Edit, Database, Settings, Check, X, Printer } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';

// Predefined catalog of common ceramic factory materials for auto-suggestions
const STANDARD_MATERIALS_CATALOG = [
  { name: 'Quartz Powder', group: 'Raw Material', unit: 'Kgs' },
  { name: 'Felspar Powder', group: 'Raw Material', unit: 'Kgs' },
  { name: 'Super China Clay', group: 'Raw Material', unit: 'Kgs' },
  { name: 'Ball Clay Powder', group: 'Raw Material', unit: 'Kgs' },
  { name: 'Barium Carbonate', group: 'Chemicals', unit: 'Kgs' },
  { name: 'Zinc Oxide', group: 'Chemicals', unit: 'Kgs' },
  { name: 'PVA', group: 'Chemicals', unit: 'Kgs' },
  { name: 'Chrome Oxide', group: 'Chemicals', unit: 'Kgs' },
  { name: 'Manganese Di Oxide', group: 'Chemicals', unit: 'Kgs' },
  { name: 'Copper Oxy Chloride', group: 'Chemicals', unit: 'Kgs' },
  { name: 'Black Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Fanta Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Coral Pink FCS Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'G Blue Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Red Oxide Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Yellow Oxide Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Cherry Red Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Havana Yellow FCS Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Lemmon Yellow Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Majenta Pink Burgandi Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Maruti Green RSB3CC Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Mettalic 7769 White Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Mettalic 7763 Yellow Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Mettalic 7741 Copper Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Pink Rose Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Red Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Red Brown BS4 Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'T Blue FCS Stain', group: 'Ceramic Stain', unit: 'Kgs' },
  { name: 'Corrugated Boxes', group: 'Packing Material', unit: 'Nos' },
  { name: 'Plastic Bags', group: 'Packing Material', unit: 'Nos' },
  { name: 'Stretch Wrapping Roll', group: 'Packing Material', unit: 'Nos' },
  { name: 'Corrugated Liners', group: 'Packing Material', unit: 'Nos' },
  { name: 'Liquid Gum For Pasting', group: 'Packing Material', unit: 'Nos' },
  { name: 'Paste Gum for Pasting', group: 'Packing Material', unit: 'Nos' },
  { name: 'Kraft Paper Roll', group: 'Packing Material', unit: 'Nos' },
  { name: 'Paper Cuttings', group: 'Packing Material', unit: 'Nos' },
  { name: 'Strapping Rolls', group: 'Packing Material', unit: 'Nos' },
  { name: 'Seals', group: 'Packing Material', unit: 'Nos' },
  { name: 'Ceramic Pebbles', group: 'Miscellenious', unit: 'Kgs' },
  { name: 'Ceramic Rollers', group: 'Miscellenious', unit: 'Nos' }
];

// Helper to generate next sequential code client-side
const generateNextCode = (items, prefix) => {
  let maxNum = 0;
  items.forEach(item => {
    if (item.code && item.code.startsWith(prefix)) {
      const numStr = item.code.substring(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

export default function MasterDataAdmin({ t }) {
  const [activeTab, setActiveTab] = useState('rawMaterials');

  const tabs = [
    { id: 'rawMaterials', label: 'Raw Materials' },
    { id: 'colours', label: 'Colours' },
    { id: 'sizes', label: 'Sizes' },
    { id: 'measurements', label: 'Units' },
    { id: 'suppliers', label: 'Suppliers' }
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Database size={24} />
        </div>
        <h2 style={{ color: '#818cf8', margin: 0, fontSize: '1.5rem' }}>Master Database</h2>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        background: 'var(--surface)', 
        padding: '6px', 
        borderRadius: '12px', 
        marginBottom: '24px', 
        overflowX: 'auto', 
        scrollbarWidth: 'none',
        flexWrap: 'nowrap',
        border: '1px solid var(--surface-high)'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--on-surface-variant)',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              flex: '1 0 auto',
              textAlign: 'center'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Panel */}
      <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {activeTab === 'rawMaterials' && <RawMaterialsMaster t={t} />}
        {activeTab === 'colours' && <ColoursMaster t={t} />}
        {activeTab === 'sizes' && <GenericMaster collectionName="production_sizes" fields={[{name: 'name', label: 'Size Name'}]} t={t} />}
        {activeTab === 'measurements' && <GenericMaster collectionName="production_measurements" fields={[{name: 'description', label: 'Description'}, {name: 'symbol', label: 'Symbol'}]} t={t} />}
        {activeTab === 'suppliers' && <GenericMaster collectionName="production_suppliers" fields={[{name: 'name', label: 'Supplier Name'}, {name: 'gst', label: 'GST No'}, {name: 'contact', label: 'Contact No'}]} t={t} />}
      </div>
    </div>
  );
}

// GENERIC MASTER for simple tables
function GenericMaster({ collectionName, fields, t }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, collectionName), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [collectionName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (Object.keys(newItem).length === 0) return;
    
    // Auto-generate sequential codes based on category
    let prefix = 'gen';
    if (collectionName === 'production_sizes') prefix = 'siz';
    else if (collectionName === 'production_measurements') prefix = 'uni';
    else if (collectionName === 'production_suppliers') prefix = 'sup';
    
    const code = generateNextCode(items, prefix);
    
    await addDoc(collection(db, collectionName), { 
      ...newItem, 
      code,
      createdAt: serverTimestamp() 
    });
    setNewItem({});
  };

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditItem(item);
  };

  const handleEditSave = async (id) => {
    await updateDoc(doc(db, collectionName, id), { ...editItem });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      await deleteDoc(doc(db, collectionName, id));
    }
  };

  return (
    <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {fields.map(f => (
          <div key={f.name}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>{f.label}</label>
            <input
              placeholder={`Enter ${f.label.toLowerCase()}`}
              value={newItem[f.name] || ''}
              onChange={e => setNewItem({...newItem, [f.name]: e.target.value})}
              required
            />
          </div>
        ))}
        <button 
          type="submit" 
          style={{ 
            padding: '12px', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '12px', 
            width: '100%', 
            marginTop: '6px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: 'white',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
          }}
        >
          <Plus size={18} /> Add Record
        </button>
      </form>

      <div style={{ overflowX: 'auto', borderTop: '1px solid var(--surface-high)', paddingTop: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--surface-high)', color: 'var(--on-surface-variant)' }}>
              <th style={{ padding: '10px 8px', width: '90px' }}>Code</th>
              {fields.map(f => <th key={f.name} style={{ padding: '10px 8px' }}>{f.label}</th>)}
              <th style={{ padding: '10px 8px', width: '60px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...items].sort((a, b) => {
              const valA = a.name || a.description || a.symbol || '';
              const valB = b.name || b.description || b.symbol || '';
              return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            }).map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                <td style={{ padding: '12px 8px', color: '#818cf8', fontWeight: 'bold' }}>{item.code || '-'}</td>
                {fields.map(f => (
                  <td key={f.name} style={{ padding: '8px' }}>
                    {editingId === item.id ? (
                      <input
                        value={editItem[f.name] || ''}
                        onChange={e => setEditItem({...editItem, [f.name]: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--surface-high)',
                          background: 'var(--surface-high)',
                          color: 'var(--on-surface)',
                          fontSize: '0.95rem'
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--on-surface)' }}>{item[f.name]}</span>
                    )}
                  </td>
                ))}
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {editingId === item.id ? (
                      <>
                        <button onClick={() => handleEditSave(item.id)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px' }}>
                          <Check size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '4px' }}>
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditStart(item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '4px' }}>
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={fields.length + 2} style={{ padding: '24px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// RAW MATERIALS MASTER
function RawMaterialsMaster({ t }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', unit: '', currentRate: '', group: '', isConsumable: false });
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState({});
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'production_raw_materials'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.name) return;
    
    // Check if duplicate name exists (case-insensitive)
    const exists = items.some(item => item.name?.trim().toLowerCase() === newItem.name.trim().toLowerCase());
    if (exists) {
      alert(`A raw material with the name "${newItem.name}" already exists!`);
      return;
    }

    const code = generateNextCode(items, 'raw');
    await addDoc(collection(db, 'production_raw_materials'), { 
      name: newItem.name.trim(),
      unit: newItem.unit,
      currentRate: parseFloat(newItem.currentRate) || 0,
      group: newItem.group || 'Raw Material',
      isConsumable: !!newItem.isConsumable,
      code,
      createdAt: serverTimestamp() 
    });
    setNewItem({ name: '', unit: '', currentRate: '', group: '', isConsumable: false });
    setSuggestions([]);
  };

  const handleNameChange = (val) => {
    setNewItem({ ...newItem, name: val });
    if (val.trim().length > 1) {
      const filtered = STANDARD_MATERIALS_CATALOG.filter(m => 
        m.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (s) => {
    setNewItem({
      name: s.name,
      unit: s.unit,
      group: s.group,
      currentRate: newItem.currentRate,
      isConsumable: newItem.isConsumable
    });
    setSuggestions([]);
  };

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditItem(item);
  };

  const handleEditSave = async (id) => {
    await updateDoc(doc(db, 'production_raw_materials', id), {
      name: editItem.name.trim(),
      group: editItem.group || 'Raw Material',
      unit: editItem.unit,
      currentRate: parseFloat(editItem.currentRate) || 0,
      isConsumable: !!editItem.isConsumable
    });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this raw material?')) return;
    
    // Check if the raw material is used in any daily production
    const prodDocs = await getDocs(query(collection(db, 'dailyProductions')));
    let isUsed = false;
    for (const d of prodDocs.docs) {
      const data = d.data();
      if (data.calculatedRawMaterials?.some(rm => rm.rawMaterialId === id)) {
        isUsed = true;
        break;
      }
      if (data.loggedConsumables?.some(rm => rm.rawMaterialId === id)) {
        isUsed = true;
        break;
      }
    }

    if (isUsed) {
      alert('Cannot delete this raw material because it is used in past production records. You can edit its name instead.');
      return;
    }

    // Check if used in recipes
    const colDocs = await getDocs(query(collection(db, 'production_colours')));
    for (const d of colDocs.docs) {
      const data = d.data();
      if (data.recipe?.some(r => r.rawMaterialId === id)) {
        isUsed = true;
        break;
      }
    }

    if (isUsed) {
      alert('Cannot delete this raw material because it is used in a colour recipe. You can edit its name instead.');
      return;
    }

    await deleteDoc(doc(db, 'production_raw_materials', id));
  };

  return (
    <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Material Name</label>
          <input 
            placeholder="e.g. Quartz Powder (type to suggest)" 
            value={newItem.name} 
            onChange={e => handleNameChange(e.target.value)} 
            required 
            style={{ width: '100%' }}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              background: 'var(--surface)',
              border: '1px solid var(--surface-high)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              marginTop: '4px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => selectSuggestion(s)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--surface-high)' : 'none',
                    color: 'var(--on-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-high)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <strong style={{ color: '#818cf8' }}>{s.name}</strong>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '4px', color: 'var(--on-surface-variant)' }}>
                    {s.group} ({s.unit})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Unit</label>
            <input placeholder="e.g. Kg" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Avg Rate (₹)</label>
            <input placeholder="e.g. 15.50" type="number" step="0.01" value={newItem.currentRate} onChange={e => setNewItem({...newItem, currentRate: e.target.value})} required />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Group</label>
          <select 
            value={newItem.group} 
            onChange={e => setNewItem({...newItem, group: e.target.value})} 
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-high)', background: 'var(--surface)', color: 'var(--on-surface)' }}
          >
            <option value="">Select Group</option>
            <option value="Raw Material">Raw Material</option>
            <option value="Ceramic Stain">Ceramic Stain</option>
            <option value="Chemicals">Chemicals</option>
            <option value="Packing Material">Packing Material</option>
            <option value="Miscellenious">Miscellaneous</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="isConsumable"
            checked={newItem.isConsumable || false} 
            onChange={e => setNewItem({...newItem, isConsumable: e.target.checked})} 
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="isConsumable" style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600', cursor: 'pointer' }}>
            Is Consumable (Shows in Consumables section during Entry)
          </label>
        </div>
        <button 
          type="submit" 
          style={{ 
            padding: '12px', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '12px', 
            width: '100%', 
            marginTop: '6px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: 'white',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
          }}
        >
          <Plus size={18} /> Add Material
        </button>
      </form>

      <div style={{ overflowX: 'auto', borderTop: '1px solid var(--surface-high)', paddingTop: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--surface-high)', color: 'var(--on-surface-variant)' }}>
              <th style={{ padding: '10px 8px', width: '90px' }}>Code</th>
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th style={{ padding: '10px 8px' }}>Group</th>
              <th style={{ padding: '10px 8px' }}>Consumable</th>
              <th style={{ padding: '10px 8px' }}>Unit</th>
              <th style={{ padding: '10px 8px' }}>Avg Rate</th>
              <th style={{ padding: '10px 8px', width: '60px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...items].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                <td style={{ padding: '12px 8px', color: '#818cf8', fontWeight: 'bold' }}>{item.code || '-'}</td>
                
                {/* Name */}
                <td style={{ padding: '8px' }}>
                  {editingId === item.id ? (
                    <input
                      value={editItem.name || ''}
                      onChange={e => setEditItem({...editItem, name: e.target.value})}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-high)', background: 'var(--surface-high)', color: 'var(--on-surface)', fontWeight: '600', fontSize: '0.95rem' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--on-surface)', fontWeight: '600' }}>{item.name}</span>
                  )}
                </td>

                {/* Group */}
                <td style={{ padding: '8px' }}>
                  {editingId === item.id ? (
                    <select
                      value={editItem.group || ''}
                      onChange={e => setEditItem({...editItem, group: e.target.value})}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-high)', background: 'var(--surface-high)', color: 'var(--on-surface)', fontSize: '0.95rem' }}
                    >
                      <option value="Raw Material">Raw Material</option>
                      <option value="Ceramic Stain">Ceramic Stain</option>
                      <option value="Chemicals">Chemicals</option>
                      <option value="Packing Material">Packing Material</option>
                      <option value="Miscellenious">Miscellaneous</option>
                    </select>
                  ) : (
                    <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>{item.group || 'Raw Material'}</span>
                  )}
                </td>

                {/* Consumable Flag */}
                <td style={{ padding: '8px' }}>
                  {editingId === item.id ? (
                    <input
                      type="checkbox"
                      checked={editItem.isConsumable || false}
                      onChange={e => setEditItem({...editItem, isConsumable: e.target.checked})}
                      style={{ width: '16px', height: '16px' }}
                    />
                  ) : (
                    <span style={{ color: item.isConsumable ? '#10b981' : 'var(--on-surface-variant)', fontWeight: item.isConsumable ? 'bold' : 'normal' }}>
                      {item.isConsumable ? 'Yes' : 'No'}
                    </span>
                  )}
                </td>

                {/* Unit */}
                <td style={{ padding: '8px' }}>
                  {editingId === item.id ? (
                    <input
                      value={editItem.unit || ''}
                      onChange={e => setEditItem({...editItem, unit: e.target.value})}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-high)', background: 'var(--surface-high)', color: 'var(--on-surface)', fontSize: '0.95rem' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--on-surface-variant)' }}>{item.unit}</span>
                  )}
                </td>

                {/* Avg Rate */}
                <td style={{ padding: '8px' }}>
                  {editingId === item.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editItem.currentRate ?? ''}
                      onChange={e => setEditItem({...editItem, currentRate: e.target.value})}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-high)', background: 'var(--surface-high)', color: 'var(--on-surface)', fontSize: '0.95rem' }}
                    />
                  ) : (
                    <span style={{ color: '#818cf8' }}>₹{item.currentRate?.toFixed(2)}</span>
                  )}
                </td>

                {/* Actions */}
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {editingId === item.id ? (
                      <>
                        <button onClick={() => handleEditSave(item.id)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px' }}>
                          <Check size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '4px' }}>
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditStart(item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '4px' }}>
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                  No materials added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// COLOURS MASTER (Recipes)
function ColoursMaster({ t }) {
  const [colours, setColours] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  const [newColour, setNewColour] = useState({ name: '', recipe: [] });
  const [selectedRm, setSelectedRm] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState('');
  
  const [editingColourId, setEditingColourId] = useState(null);
  const [selectedColours, setSelectedColours] = useState({});
  const [printingColours, setPrintingColours] = useState(null);

  const handleToggleSelect = (id) => {
    setSelectedColours(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAll = (checked) => {
    const next = {};
    if (checked) {
      colours.forEach(c => {
        next[c.id] = true;
      });
    }
    setSelectedColours(next);
  };

  const printFormulations = (coloursList) => {
    if (!coloursList || coloursList.length === 0) return;
    setPrintingColours(coloursList);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  useEffect(() => {
    const unsubCol = onSnapshot(collection(db, 'production_colours'), snap => {
      setColours(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRm = onSnapshot(collection(db, 'production_raw_materials'), snap => {
      setRawMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCol(); unsubRm(); };
  }, []);

  const addIngredient = () => {
    if (!selectedRm || !selectedPercentage) return;
    
    // Check if ingredient already in list to avoid duplicates
    if (newColour.recipe.some(ing => ing.rawMaterialId === selectedRm)) {
      alert('This material is already in the recipe.');
      return;
    }

    const rm = rawMaterials.find(r => r.id === selectedRm);
    setNewColour({
      ...newColour,
      recipe: [...newColour.recipe, { rawMaterialId: rm.id, name: rm.name, percentage: parseFloat(selectedPercentage) }]
    });
    setSelectedRm('');
    setSelectedPercentage('');
  };

  const removeIngredient = (idx) => {
    const updated = [...newColour.recipe];
    updated.splice(idx, 1);
    setNewColour({ ...newColour, recipe: updated });
  };

  const handleAddColour = async (e) => {
    e.preventDefault();
    if (!newColour.name || newColour.recipe.length === 0) return;
    
    // Validate that recipe percentage sums up to approximately 100% or is valid
    const totalPct = newColour.recipe.reduce((sum, ing) => sum + ing.percentage, 0);
    if (Math.abs(totalPct - 100) > 0.1) {
      if (!confirm(`Warning: Recipe percentages total ${totalPct.toFixed(1)}% instead of 100%. Save anyway?`)) {
        return;
      }
    }

    if (editingColourId) {
      // Edit mode: update existing document
      await updateDoc(doc(db, 'production_colours', editingColourId), {
        name: newColour.name.trim(),
        recipe: newColour.recipe
      });
      setEditingColourId(null);
      alert('Colour Recipe updated successfully!');
    } else {
      // Check for duplicate name
      const exists = colours.some(col => col.name?.trim().toLowerCase() === newColour.name.trim().toLowerCase());
      if (exists) {
        alert(`A colour recipe with the name "${newColour.name}" already exists!`);
        return;
      }

      // Create mode
      const code = generateNextCode(colours, 'col');
      await addDoc(collection(db, 'production_colours'), { 
        name: newColour.name.trim(),
        recipe: newColour.recipe,
        code,
        createdAt: serverTimestamp() 
      });
      alert('Colour Recipe saved successfully!');
    }
    setNewColour({ name: '', recipe: [] });
  };

  const handleEditStart = (c) => {
    setEditingColourId(c.id);
    setNewColour({ name: c.name, recipe: c.recipe });
    // Scroll to the top where form is located
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingColourId(null);
    setNewColour({ name: '', recipe: [] });
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) await deleteDoc(doc(db, 'production_colours', id));
  };

  if (printingColours) {
    return (
      <div className="print-report-container" style={{ padding: '20px', background: 'white', color: '#1e293b', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
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
            .recipe-card {
              border-color: #cbd5e1 !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>
        
        {/* Print controls toolbar */}
        <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--surface-high)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>Print Preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => window.print()}
              style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Trigger Print / Save PDF
            </button>
            <button 
              onClick={() => setPrintingColours(null)}
              style={{ padding: '8px 16px', background: 'var(--surface-high)', color: 'var(--on-surface)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Go Back
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', color: '#1e293b', padding: '10px' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #4f46e5', paddingBottom: '15px', marginBottom: '30px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1e1b4b', letterSpacing: '0.5px' }}>Colour Formulation Recipes</h1>
            <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '13px' }}>Shon Factory Master Database</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {printingColours.map((c, idx) => (
              <div key={idx} className="recipe-card" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', background: 'white', color: '#1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{c.name}</span>
                  <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 'bold', backgroundColor: '#e0e7ff', padding: '3px 8px', borderRadius: '4px' }}>Code: {c.code || '-'}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Raw Material / Ingredient</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>Percentage (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.recipe || []).map((r, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{r.name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 'bold', color: '#4f46e5' }}>{r.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '50px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            Printed on {new Date().toLocaleDateString()} - Shu Factory Production Management
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#818cf8', marginBottom: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>
          {editingColourId ? 'Edit Colour Recipe' : 'Add New Colour Recipe'}
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Colour Name</label>
            <input 
              placeholder="e.g. Pebble White" 
              value={newColour.name} 
              onChange={e => setNewColour({...newColour, name: e.target.value})} 
            />
          </div>
          
          <div style={{ border: '1px solid var(--surface-high)', padding: '12px', borderRadius: '12px', background: 'var(--surface-high)' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--on-surface)', fontWeight: 'bold' }}>Add Ingredients</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SearchableSelect
                options={rawMaterials.map(rm => ({ value: rm.id, label: `${rm.name} (${rm.code || '-'})` }))}
                value={selectedRm}
                onChange={setSelectedRm}
                placeholder="Search raw material..."
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="number" step="0.01" placeholder="Percentage %" 
                  value={selectedPercentage} onChange={e => setSelectedPercentage(e.target.value)} 
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={addIngredient} 
                  type="button" 
                  style={{ 
                    padding: '12px 16px', 
                    fontSize: '0.9rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#818cf8',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {newColour.recipe.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
              Recipe Mix (Total: {newColour.recipe.reduce((s, i) => s + i.percentage, 0).toFixed(1)}%)
            </label>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {newColour.recipe.map((ing, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-high)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.95rem' }}>{ing.name} (<strong style={{ color: '#818cf8' }}>{ing.percentage}%</strong>)</span>
                  <button onClick={() => removeIngredient(idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleAddColour} 
            style={{ 
              flex: 2, 
              padding: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
            }} 
            disabled={!newColour.name || newColour.recipe.length === 0}
          >
            {editingColourId ? 'Update Colour Recipe' : 'Save Colour Recipe'}
          </button>
          {editingColourId && (
            <button 
              type="button"
              onClick={handleCancelEdit} 
              style={{ 
                flex: 1, 
                padding: '12px',
                background: 'var(--surface-high)',
                color: 'var(--on-surface)',
                border: '1px solid var(--surface-high)',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 0 0', gap: '12px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--on-background)', margin: 0 }}>Existing Colours</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {colours.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--on-surface-variant)', cursor: 'pointer', marginRight: '6px' }}>
              <input 
                type="checkbox" 
                checked={colours.length > 0 && colours.every(c => selectedColours[c.id])} 
                onChange={e => handleSelectAll(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: '#818cf8' }}
              />
              Select All
            </label>
          )}

          <button
            onClick={() => {
              const toPrint = colours.filter(c => selectedColours[c.id]);
              printFormulations(toPrint);
            }}
            disabled={!colours.some(c => selectedColours[c.id])}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              background: colours.some(c => selectedColours[c.id]) ? 'rgba(99, 102, 241, 0.15)' : 'var(--surface-high)',
              color: colours.some(c => selectedColours[c.id]) ? '#818cf8' : 'var(--on-surface-variant)',
              cursor: colours.some(c => selectedColours[c.id]) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Printer size={14} /> Print Selected
          </button>

          <button
            onClick={() => printFormulations(colours)}
            disabled={colours.length === 0}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              background: colours.length > 0 ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'var(--surface-high)',
              color: colours.length > 0 ? 'white' : 'var(--on-surface-variant)',
              cursor: colours.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Printer size={14} /> Print All
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        {[...colours].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map(c => (
          <div key={c.id} className="card" style={{ border: '1px solid var(--surface-high)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ paddingTop: '4px' }}>
              <input 
                type="checkbox" 
                checked={!!selectedColours[c.id]} 
                onChange={() => handleToggleSelect(c.id)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#818cf8' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--on-surface)', fontSize: '1.1rem' }}>
                  {c.name} <span style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '6px' }}>({c.code || '-'})</span>
                </h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => printFormulations([c])} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '4px' }} title="Print formulation recipe">
                    <Printer size={16} />
                  </button>
                  <button onClick={() => handleEditStart(c)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '4px' }}>
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            <table style={{ width: '100%', fontSize: '0.9rem' }}>
              <tbody>
                {c.recipe.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                    <td style={{ color: 'var(--on-surface-variant)', padding: '6px 0' }}>{r.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#818cf8', padding: '6px 0' }}>{r.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
        {colours.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>
            No colours added yet.
          </div>
        )}
      </div>
    </div>
  );
}
