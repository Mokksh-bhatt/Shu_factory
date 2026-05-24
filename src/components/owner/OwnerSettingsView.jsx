import { useState } from 'react';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '../Toast';
import ConfirmModal from '../ConfirmModal';


export default function OwnerSettingsView({
  workers,
  admins = [],
  createWorkerAccount,
  createAdminAccount,
  deleteAdmin,
  updateWorker,
  deleteWorker,
  updateWorkerPassword,
  departments,
  getDepartmentLabel,
  language,
  setLanguage,
  languageOptions,
  notificationsEnabled,
  setNotificationsEnabled,
  logout,
  t,
  initialTab = 'workers'
}) {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPassword, setNewWorkerPassword] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('General');
  const [createdCreds, setCreatedCreds] = useState(null);
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [confirmDeleteWorker, setConfirmDeleteWorker] = useState(null);

  // Admin state
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [createdAdminCreds, setCreatedAdminCreds] = useState(null);
  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState(null);

  const handleCreateWorker = async () => {
    try {
      const created = await createWorkerAccount({
        name: newWorkerName,
        password: newWorkerPassword,
        category: newWorkerDept,
      });
      setCreatedCreds(created);
      setNewWorkerName('');
      setNewWorkerPassword('');
      setNewWorkerDept('General');
      showToast(t('workerCreated'), 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleCreateAdmin = async () => {
    try {
      const created = await createAdminAccount({
        name: newAdminName,
        password: newAdminPassword,
      });
      setCreatedAdminCreds(created);
      setNewAdminName('');
      setNewAdminPassword('');
      showToast('Admin account created!', 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const copyCredentials = async () => {
    if (!createdCreds) return;
    const text = `${t('labelName')}: ${createdCreds.name}\n${t('labelPassword')}: ${createdCreds.password}\n${t('department')}: ${getDepartmentLabel(createdCreds.category)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showToast(text, 'info');
    }
  };

  const copyAdminCredentials = async () => {
    if (!createdAdminCreds) return;
    const text = `Admin Name: ${createdAdminCreds.name}\nPassword: ${createdAdminCreds.password}\nRole: Admin (Owner Access)`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied!', 'success');
    } catch {
      showToast(text, 'info');
    }
  };

  const handlePasswordUpdate = async (workerId) => {
    const next = (passwordDrafts[workerId] || '').trim();
    try {
      await updateWorkerPassword(workerId, next);
      setPasswordDrafts((prev) => ({ ...prev, [workerId]: '' }));
      showToast(t('workerPasswordUpdated'), 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleDeleteWorker = async (workerId, name) => {
    setConfirmDeleteWorker({ id: workerId, name });
  };

  const doDeleteWorker = async () => {
    if (!confirmDeleteWorker) return;
    const { id } = confirmDeleteWorker;
    setConfirmDeleteWorker(null);
    try {
      await deleteWorker(id);
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const doDeleteAdmin = async () => {
    if (!confirmDeleteAdmin) return;
    const { id } = confirmDeleteAdmin;
    setConfirmDeleteAdmin(null);
    try {
      await deleteAdmin(id);
      showToast('Admin deleted', 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '60vh' }}>

      {/* Tab Header */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('workers')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: activeTab === 'workers' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'workers' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Workers
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: activeTab === 'admins' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'admins' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Admins
        </button>
      </div>

      {activeTab === 'workers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={20} /> Worker Management
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', margin: '4px 0 0' }}>Create and manage worker accounts here.</p>
          </div>

          <div className="card" style={{ display: 'grid', gap: '10px', background: 'var(--background)' }}>
            <strong>{t('createWorkerAccount')}</strong>
            <input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder={t('workerName')} />
            <input type="text" value={newWorkerPassword} onChange={(e) => setNewWorkerPassword(e.target.value)} placeholder={t('passwordPin')} />
            <select value={newWorkerDept} onChange={(e) => setNewWorkerDept(e.target.value)}>
              {(departments || []).map((dept) => (
                <option key={dept} value={dept}>
                  {getDepartmentLabel(dept)}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleCreateWorker}>
              {t('createAccount')}
            </button>

            {createdCreds && (
              <div style={{ background: 'var(--surface-high)', borderRadius: '10px', padding: '10px', fontSize: '0.9rem' }}>
                <strong>{t('credentialsToShare')}</strong>
                <div style={{ marginTop: '6px' }}>
                  <div>{t('labelName')}: {createdCreds.name}</div>
                  <div>{t('labelPassword')}: {createdCreds.password}</div>
                  <div>{t('department')}: {getDepartmentLabel(createdCreds.category)}</div>
                </div>
                <button className="btn-secondary" style={{ marginTop: '8px' }} onClick={copyCredentials}>
                  {t('copy')}
                </button>
              </div>
            )}
          </div>

          {(workers || []).map((worker) => (
            <div key={worker.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--background)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{worker.name}</h4>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: worker.online ? 'var(--success)' : 'var(--on-surface-variant)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {worker.deviceId && (
                    <button
                      onClick={async () => {
                        try {
                          await updateWorker(worker.id, { deviceId: null });
                          showToast(t('deviceUnlocked', { name: worker.name }), 'success');
                        } catch (err) {
                          showToast(err.message, 'error');
                        }
                      }}
                      style={{ padding: '6px 12px', background: 'var(--surface-high)', color: 'var(--on-background)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      {t('unlockDevice')}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteWorker(worker.id, worker.name)}
                    style={{ background: 'none', border: 'none', color: 'var(--error)' }}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--surface-high)', paddingTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--on-surface)' }}>
                  <input 
                    type="checkbox" 
                    checked={worker.hasProductionAccess || false} 
                    onChange={(e) => updateWorker(worker.id, { hasProductionAccess: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <strong>Grant Production Log Access</strong>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('newPassword')}</label>
                  <input
                    type="text"
                    value={passwordDrafts[worker.id] || ''}
                    onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [worker.id]: e.target.value }))}
                    placeholder={t('newPassword')}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                  />
                  <button className="btn-secondary" style={{ marginTop: '8px', width: '100%' }} onClick={() => handlePasswordUpdate(worker.id)}>
                    {t('updatePassword')}
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('department')}</label>
                  <select
                    value={worker.category || 'General'}
                    onChange={(e) => updateWorker(worker.id, { category: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                  >
                    {(departments || []).map((dept) => (
                      <option key={dept} value={dept}>
                        {getDepartmentLabel(dept)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {(!workers || workers.length === 0) && <p style={{ color: 'var(--on-surface-variant)' }}>{t('noWorkersYet')}</p>}
        </div>
      )}

      {activeTab === 'admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: 'var(--warning, #f59e0b)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={20} /> Admin Management
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', margin: '0 0 12px' }}>
              Create admin accounts with full owner-level access.
            </p>
          </div>

          <div className="card" style={{ display: 'grid', gap: '10px', background: 'var(--background)', borderLeft: '3px solid var(--warning, #f59e0b)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={16} /> Create Admin Account
            </strong>
            <input
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="Admin name"
              style={{ padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
            />
            <input
              type="text"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="Admin password"
              style={{ padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
            />
            <button
              className="btn-primary"
              onClick={handleCreateAdmin}
              style={{ background: 'var(--warning, #f59e0b)', color: '#000' }}
            >
              Create Admin
            </button>

            {createdAdminCreds && (
              <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: '10px', padding: '10px', fontSize: '0.9rem', border: '1px solid rgba(245,158,11,0.3)' }}>
                <strong>Admin Credentials</strong>
                <div style={{ marginTop: '6px' }}>
                  <div>Name: {createdAdminCreds.name}</div>
                  <div>Password: {createdAdminCreds.password}</div>
                  <div>Role: Admin (Owner Access)</div>
                </div>
                <button className="btn-secondary" style={{ marginTop: '8px' }} onClick={copyAdminCredentials}>
                  {t('copy')}
                </button>
              </div>
            )}
          </div>

          {(admins || []).map((admin) => (
            <div
              key={admin.id}
              className="card"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--background)', borderLeft: '3px solid var(--warning, #f59e0b)',
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>{admin.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--warning, #f59e0b)' }}>Admin • Owner Access</div>
              </div>
              <button
                onClick={() => setConfirmDeleteAdmin({ id: admin.id, name: admin.name })}
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {(!admins || admins.length === 0) && <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>No other admins created.</p>}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteWorker}
        title={t('delete')}
        message={t('deleteWorkerConfirm', { name: confirmDeleteWorker?.name || '' })}
        confirmText={t('delete')}
        cancelText={t('cancel') || 'Cancel'}
        danger={true}
        onCancel={() => setConfirmDeleteWorker(null)}
        onConfirm={doDeleteWorker}
      />
      <ConfirmModal
        open={!!confirmDeleteAdmin}
        title="Delete Admin"
        message={`Are you sure you want to delete admin "${confirmDeleteAdmin?.name || ''}"? They will lose all owner access.`}
        confirmText="Delete"
        cancelText={t('cancel') || 'Cancel'}
        danger={true}
        onCancel={() => setConfirmDeleteAdmin(null)}
        onConfirm={doDeleteAdmin}
      />
    </section>
  );
}
