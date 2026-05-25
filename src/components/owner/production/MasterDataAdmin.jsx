import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Plus, Trash2, Edit, Database, Settings } from 'lucide-react';

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
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                <td style={{ padding: '12px 8px', color: '#818cf8', fontWeight: 'bold' }}>{item.code || '-'}</td>
                {fields.map(f => <td key={f.name} style={{ padding: '12px 8px', color: 'var(--on-surface)' }}>{item[f.name]}</td>)}
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
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
  const [newItem, setNewItem] = useState({ name: '', unit: '', currentRate: '', group: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'production_raw_materials'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.name) return;
    const code = generateNextCode(items, 'raw');
    await addDoc(collection(db, 'production_raw_materials'), { 
      name: newItem.name,
      unit: newItem.unit,
      currentRate: parseFloat(newItem.currentRate) || 0,
      group: newItem.group || 'Raw Material',
      code,
      createdAt: serverTimestamp() 
    });
    setNewItem({ name: '', unit: '', currentRate: '', group: '' });
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) await deleteDoc(doc(db, 'production_raw_materials', id));
  };

  return (
    <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Material Name</label>
          <input placeholder="e.g. Quartz Powder" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
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
              <th style={{ padding: '10px 8px' }}>Unit</th>
              <th style={{ padding: '10px 8px' }}>Avg Rate</th>
              <th style={{ padding: '10px 8px', width: '60px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-high)' }}>
                <td style={{ padding: '12px 8px', color: '#818cf8', fontWeight: 'bold' }}>{item.code || '-'}</td>
                <td style={{ padding: '12px 8px', color: 'var(--on-surface)', fontWeight: '600' }}>{item.name}</td>
                <td style={{ padding: '12px 8px', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>{item.group || 'Raw Material'}</td>
                <td style={{ padding: '12px 8px', color: 'var(--on-surface-variant)' }}>{item.unit}</td>
                <td style={{ padding: '12px 8px', color: '#818cf8' }}>₹{item.currentRate?.toFixed(2)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
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
    
    // Auto-generate sequential color code
    const code = generateNextCode(colours, 'col');
    
    await addDoc(collection(db, 'production_colours'), { 
      name: newColour.name,
      recipe: newColour.recipe,
      code,
      createdAt: serverTimestamp() 
    });
    setNewColour({ name: '', recipe: [] });
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) await deleteDoc(doc(db, 'production_colours', id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ border: '1px solid var(--surface-high)' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#818cf8', marginBottom: '16px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px' }}>Add New Colour Recipe</h3>
        
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
              <select value={selectedRm} onChange={e => setSelectedRm(e.target.value)}>
                <option value="">Select Raw Material</option>
                {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
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
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Recipe Mix</label>
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

        <button 
          onClick={handleAddColour} 
          style={{ 
            width: '100%', 
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
          Save Colour Recipe
        </button>
      </div>

      <h3 style={{ fontSize: '1.2rem', color: 'var(--on-background)', margin: '8px 0 0 0' }}>Existing Colours</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {colours.map(c => (
          <div key={c.id} className="card" style={{ border: '1px solid var(--surface-high)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: 'var(--on-surface)', fontSize: '1.1rem' }}>
                {c.name} <span style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '6px' }}>({c.code || '-'})</span>
              </h4>
              <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
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
