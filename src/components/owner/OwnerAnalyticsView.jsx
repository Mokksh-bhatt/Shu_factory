import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, CheckCircle, Clock, Users, Briefcase } from 'lucide-react';

export default function OwnerAnalyticsView({ tasks, workers, departments, getDepartmentLabel, t }) {
  const stats = useMemo(() => {
    const safeWorkers = workers || [];
    const safeTasks = tasks || [];
    const safeDepts = departments || [];

    const totalWorkers = safeWorkers.length;
    const totalTasks = safeTasks.length;
    const completedTasks = safeTasks.filter(task => task.status === 'DONE').length;
    const pendingTasks = safeTasks.filter(task => task.status === 'PENDING').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Group tasks by the worker's category
    const workerCategoryMap = {};
    safeWorkers.forEach(w => {
      if (w?.name) {
        workerCategoryMap[w.name.toLowerCase().trim()] = w.category || 'General';
      }
    });

    const tasksByDept = {};
    const completedByDept = {};
    safeDepts.forEach(dept => {
      tasksByDept[dept] = 0;
      completedByDept[dept] = 0;
    });

    safeTasks.forEach(task => {
      const workerName = task.workerName?.toLowerCase().trim();
      const dept = workerCategoryMap[workerName] || 'General';
      tasksByDept[dept] = (tasksByDept[dept] || 0) + 1;
      if (task.status === 'DONE') {
        completedByDept[dept] = (completedByDept[dept] || 0) + 1;
      }
    });

    const workersByDept = {};
    safeDepts.forEach(dept => {
      workersByDept[dept] = safeWorkers.filter(w => (w.category || 'General') === dept).length;
    });

    // Top performers - workers with the most completed tasks
    const workerCompletions = {};
    safeTasks.filter(t => t.status === 'DONE').forEach(task => {
      const name = task.workerName || 'Unknown';
      workerCompletions[name] = (workerCompletions[name] || 0) + 1;
    });
    const topPerformers = Object.entries(workerCompletions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalWorkers, totalTasks, completedTasks, pendingTasks, completionRate, tasksByDept, completedByDept, workersByDept, topPerformers };
  }, [tasks, workers, departments]);

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: '16px',
    padding: '20px',
    flex: '1 1 calc(50% - 8px)',
    minWidth: '140px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  };

  const statNumberStyle = {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'var(--on-surface)',
    margin: 0
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{ background: 'var(--primary-container)', padding: '10px', borderRadius: '12px', color: 'var(--primary)' }}>
          <BarChart2 size={24} />
        </div>
        <h3 style={{ margin: 0, color: 'var(--on-background)', fontSize: '1.2rem' }}>
          {t('factoryAnalytics') || 'Factory Analytics'}
        </h3>
      </div>

      {/* Main Stat Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--on-surface-variant)' }}>
            <CheckCircle size={18} color="var(--success, #10b981)" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('completionRate') || 'Completion Rate'}</span>
          </div>
          <p style={statNumberStyle}>{stats.completionRate}%</p>
          <div style={{ width: '100%', height: '6px', background: 'var(--surface-high)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${stats.completionRate}%`, height: '100%', background: 'var(--success, #10b981)', transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            {stats.completedTasks} / {stats.totalTasks} {t('tasks').toLowerCase()}
          </span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--on-surface-variant)' }}>
            <Clock size={18} color="var(--warning, #f59e0b)" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('pendingTasks') || 'Pending Tasks'}</span>
          </div>
          <p style={statNumberStyle}>{stats.pendingTasks}</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            {t('outOfTotal') || 'Out of'} {stats.totalTasks} {t('tasks').toLowerCase()}
          </span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--on-surface-variant)' }}>
            <Users size={18} color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('totalWorkers') || 'Total Workers'}</span>
          </div>
          <p style={statNumberStyle}>{stats.totalWorkers}</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            {workers.filter(w => w.online).length} online
          </span>
        </div>
      </div>

      {/* Top Performers */}
      {stats.topPerformers.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--on-surface-variant)' }}>🏆 Top Performers</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.topPerformers.map(([name, count], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: i === 0 ? 'var(--success)' : 'var(--surface-high)', color: i === 0 ? 'white' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: '0.95rem', color: 'var(--on-surface)', fontWeight: '500' }}>{name}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>{count} ✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Breakdown */}
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--on-surface-variant)' }}>
          <Briefcase size={18} />
          <h4 style={{ margin: 0, fontSize: '1rem' }}>{t('departmentBreakdown') || 'Department Breakdown'}</h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {departments.map(dept => {
            const taskCount = stats.tasksByDept[dept] || 0;
            const doneCount = stats.completedByDept[dept] || 0;
            if (taskCount === 0 && (stats.workersByDept[dept] || 0) === 0) return null;

            const percent = stats.totalTasks > 0 ? (taskCount / stats.totalTasks) * 100 : 0;

            return (
              <div key={dept}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--on-surface)' }}>{getDepartmentLabel(dept)}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                    {doneCount}/{taskCount} done | {stats.workersByDept[dept] || 0} {t('workers').toLowerCase()}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--surface-high)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </motion.div>
  );
}
