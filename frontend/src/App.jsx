import React, { useState, useEffect } from 'react';
import { 
  Activity, Scale, RefreshCw, CheckCircle2, AlertCircle, Settings, 
  ArrowRight, ShieldCheck, Zap, History, Database, Flame, Droplets, 
  Dumbbell, HeartPulse, User, Lock, Key, ChevronRight, X 
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [config, setConfig] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('measurements');
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form State
  const [renphoEmail, setRenphoEmail] = useState('');
  const [renphoPassword, setRenphoPassword] = useState('');
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminMfa, setGarminMfa] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  
  // Status Messages
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [testRenphoStatus, setTestRenphoStatus] = useState(null);
  const [testGarminStatus, setTestGarminStatus] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [cfgRes, measRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/config`).then(r => r.json()),
        fetch(`${API_BASE}/measurements`).then(r => r.json()).catch(() => ({ measurements: [] })),
        fetch(`${API_BASE}/logs`).then(r => r.json()).catch(() => ({ logs: [] }))
      ]);

      setConfig(cfgRes);
      setRenphoEmail(cfgRes.renpho_email || '');
      setGarminEmail(cfgRes.garmin_email || '');
      setWeightUnit(cfgRes.weight_unit || 'kg');

      if (measRes.status === 'success') {
        setMeasurements(measRes.measurements || []);
      }
      if (logsRes.status === 'success') {
        setLogs(logsRes.logs || []);
      }

      // If credentials missing, pop open settings
      if (!cfgRes.has_renpho_creds || !cfgRes.has_garmin_creds) {
        setShowSettings(true);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setStatusMsg({ type: 'error', text: 'Failed to connect to backend server. Make sure FastAPI server is running on port 8000.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const payload = {
        renpho_email: renphoEmail,
        renpho_password: renphoPassword,
        garmin_email: garminEmail,
        garmin_password: garminPassword,
        weight_unit: weightUnit
      };

      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.status === 'success') {
        setStatusMsg({ type: 'success', text: 'Settings saved successfully!' });
        fetchInitialData();
        setShowSettings(false);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to save settings: ' + err.message });
    }
  };

  const testRenphoLogin = async () => {
    setTestRenphoStatus({ loading: true, msg: 'Testing Renpho login...' });
    try {
      const res = await fetch(`${API_BASE}/test-renpho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: renphoEmail, password: renphoPassword })
      }).then(r => r.json());

      if (res.status === 'success') {
        setTestRenphoStatus({ success: true, msg: res.message });
      } else {
        setTestRenphoStatus({ error: true, msg: res.detail || 'Renpho authentication failed.' });
      }
    } catch (err) {
      setTestRenphoStatus({ error: true, msg: 'Error testing Renpho: ' + err.message });
    }
  };

  const testGarminLogin = async () => {
    setTestGarminStatus({ loading: true, msg: 'Testing Garmin Connect login...' });
    try {
      const res = await fetch(`${API_BASE}/test-garmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: garminEmail, password: garminPassword, mfa_code: garminMfa })
      }).then(r => r.json());

      if (res.status === 'success') {
        setTestGarminStatus({ success: true, msg: res.message });
      } else if (res.status === 'mfa_required') {
        setTestGarminStatus({ mfa: true, msg: res.message });
      } else {
        setTestGarminStatus({ error: true, msg: res.detail || 'Garmin authentication failed.' });
      }
    } catch (err) {
      setTestGarminStatus({ error: true, msg: 'Error testing Garmin: ' + err.message });
    }
  };

  const handleSyncLatest = async () => {
    setSyncing(true);
    setStatusMsg({ type: 'info', text: 'Syncing latest Renpho weigh-in to Garmin Connect...' });
    try {
      const res = await fetch(`${API_BASE}/sync/latest`, { method: 'POST' }).then(r => r.json());
      if (res.status === 'success') {
        setStatusMsg({ type: 'success', text: res.message });
      } else if (res.status === 'skipped') {
        setStatusMsg({ type: 'warning', text: res.message });
      } else {
        setStatusMsg({ type: 'error', text: res.detail || 'Sync failed.' });
      }
      fetchInitialData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Sync error: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleBatchSync = async () => {
    setSyncing(true);
    setStatusMsg({ type: 'info', text: 'Batch syncing unsynced Renpho history...' });
    try {
      const res = await fetch(`${API_BASE}/sync/batch`, { method: 'POST' }).then(r => r.json());
      if (res.status === 'completed') {
        setStatusMsg({ type: 'success', text: res.summary });
      } else {
        setStatusMsg({ type: 'error', text: res.detail || 'Batch sync failed.' });
      }
      fetchInitialData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Batch sync error: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingle = async (m) => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurement: m })
      }).then(r => r.json());

      if (res.status === 'success') {
        setStatusMsg({ type: 'success', text: `Synced weigh-in from ${m.timestamp_iso.slice(0, 10)} (${m.weight_kg} kg) to Garmin!` });
      } else {
        setStatusMsg({ type: 'error', text: res.detail || 'Sync failed.' });
      }
      fetchInitialData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Sync single error: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const latest = measurements.length > 0 ? measurements[0] : null;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px' }}>
      
      {/* Top Navbar */}
      <header className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scale size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Renpho <span className="gradient-text">➔ Garmin</span> Sync
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Automated Body Composition Data Transfer</p>
          </div>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`badge ${config?.has_renpho_creds ? 'badge-success' : 'badge-warning'}`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: config?.has_renpho_creds ? '#34d399' : '#fbbf24' }}></span>
            Renpho: {config?.has_renpho_creds ? 'Connected' : 'Setup Required'}
          </div>

          <div className={`badge ${config?.has_garmin_creds ? 'badge-success' : 'badge-warning'}`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: config?.has_garmin_creds ? '#34d399' : '#fbbf24' }}></span>
            Garmin: {config?.has_garmin_creds ? 'Connected' : 'Setup Required'}
          </div>

          <button className="secondary-btn" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            Config
          </button>
        </div>
      </header>

      {/* Alert banner if message */}
      {statusMsg.text && (
        <div className={`glass-panel`} style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: statusMsg.type === 'error' ? 'rgba(244,63,94,0.4)' : statusMsg.type === 'success' ? 'rgba(16,185,129,0.4)' : 'var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {statusMsg.type === 'error' && <AlertCircle size={20} color="#f43f5e" />}
            {statusMsg.type === 'success' && <CheckCircle2 size={20} color="#10b981" />}
            {statusMsg.type === 'info' && <RefreshCw size={20} className="spin" color="#06b6d4" />}
            <span style={{ fontSize: '0.92rem' }}>{statusMsg.text}</span>
          </div>
          <X size={18} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setStatusMsg({ type: '', text: '' })} />
        </div>
      )}

      {/* Main Grid Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>QUICK SYNC</span>
              <Zap size={18} color="#06b6d4" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Sync Newest Measurement</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Pushes the latest scale entry from Renpho to Garmin Connect.</p>
          </div>
          <button className="gradient-btn" style={{ marginTop: '16px' }} onClick={handleSyncLatest} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Latest Now'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>HISTORICAL BACKFILL</span>
              <History size={18} color="#a855f7" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Batch Sync All History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Scans all past Renpho weigh-ins and uploads unsynced ones.</p>
          </div>
          <button className="secondary-btn" style={{ marginTop: '16px', background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.3)', color: '#d8b4fe' }} onClick={handleBatchSync} disabled={syncing}>
            <Database size={16} />
            {syncing ? 'Processing...' : 'Backfill Unsynced Data'}
          </button>
        </div>
      </div>

      {/* Latest Weigh-In Stats Overview Cards */}
      {latest && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#06b6d4" />
              Latest Renpho Measurement Overview
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Recorded: {new Date(latest.timestamp_iso).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {/* Weight */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>WEIGHT</span>
                <Scale size={18} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {weightUnit === 'lbs' ? `${latest.weight_lbs} lbs` : `${latest.weight_kg} kg`}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                {weightUnit === 'lbs' ? `(${latest.weight_kg} kg)` : `(${latest.weight_lbs} lbs)`}
              </span>
            </div>

            {/* Body Fat % */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>BODY FAT</span>
                <Flame size={18} color="#f43f5e" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fb7185' }}>
                {latest.percent_fat > 0 ? `${latest.percent_fat}%` : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Body Fat Percentage</span>
            </div>

            {/* Muscle Mass */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>MUSCLE MASS</span>
                <Dumbbell size={18} color="#a855f7" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc' }}>
                {latest.muscle_mass_kg > 0 ? `${latest.muscle_mass_kg} kg` : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Skeletal Muscle</span>
            </div>

            {/* BMI */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>BMI</span>
                <HeartPulse size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>
                {latest.bmi > 0 ? latest.bmi : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Body Mass Index</span>
            </div>

            {/* Hydration */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>HYDRATION</span>
                <Droplets size={18} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {latest.percent_hydration > 0 ? `${latest.percent_hydration}%` : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Body Water %</span>
            </div>

            {/* Visceral Fat */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>VISCERAL FAT</span>
                <Activity size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24' }}>
                {latest.visceral_fat > 0 ? latest.visceral_fat : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Visceral Rating</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
        <button 
          className="secondary-btn" 
          style={{ background: activeTab === 'measurements' ? 'rgba(6, 182, 212, 0.15)' : 'transparent', borderColor: activeTab === 'measurements' ? '#06b6d4' : 'transparent', color: activeTab === 'measurements' ? '#38bdf8' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('measurements')}
        >
          <Scale size={16} /> Weigh-in History ({measurements.length})
        </button>

        <button 
          className="secondary-btn" 
          style={{ background: activeTab === 'logs' ? 'rgba(6, 182, 212, 0.15)' : 'transparent', borderColor: activeTab === 'logs' ? '#06b6d4' : 'transparent', color: activeTab === 'logs' ? '#38bdf8' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('logs')}
        >
          <History size={16} /> Activity & Sync Logs ({logs.length})
        </button>
      </div>

      {/* Tab Content: Measurements */}
      {activeTab === 'measurements' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Weight</th>
                  <th>Body Fat %</th>
                  <th>Muscle Mass</th>
                  <th>BMI</th>
                  <th>Water %</th>
                  <th>Garmin Sync Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {measurements.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No weigh-ins loaded yet. Click <strong>Config</strong> to add Renpho credentials.
                    </td>
                  </tr>
                ) : (
                  measurements.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{new Date(m.timestamp_iso).toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: '#38bdf8' }}>
                        {weightUnit === 'lbs' ? `${m.weight_lbs} lbs` : `${m.weight_kg} kg`}
                      </td>
                      <td>{m.percent_fat > 0 ? `${m.percent_fat}%` : '-'}</td>
                      <td>{m.muscle_mass_kg > 0 ? `${m.muscle_mass_kg} kg` : '-'}</td>
                      <td>{m.bmi > 0 ? m.bmi : '-'}</td>
                      <td>{m.percent_hydration > 0 ? `${m.percent_hydration}%` : '-'}</td>
                      <td>
                        {m.synced ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} /> Synced to Garmin
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <AlertCircle size={12} /> Pending Sync
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="secondary-btn" 
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          onClick={() => handleSyncSingle(m)}
                          disabled={syncing}
                        >
                          <ArrowRight size={14} /> Sync
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Logs */}
      {activeTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No sync events logged yet.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', borderLeft: `4px solid ${log.type.includes('SUCCESS') ? '#10b981' : log.type.includes('SKIP') ? '#f59e0b' : '#38bdf8'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{log.type}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 500 }}>{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Account & Sync Settings</h2>
              <X size={22} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(false)} />
            </div>

            {/* Renpho Credentials */}
            <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} color="#06b6d4" /> Renpho Credentials
              </h3>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Renpho App Email</label>
                <input className="input-field" type="email" value={renphoEmail} onChange={e => setRenphoEmail(e.target.value)} placeholder="your_renpho_email@example.com" />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Renpho Password</label>
                <input className="input-field" type="password" value={renphoPassword} onChange={e => setRenphoPassword(e.target.value)} placeholder="Password" />
              </div>

              <button className="secondary-btn" style={{ fontSize: '0.82rem', padding: '8px 14px' }} onClick={testRenphoLogin}>
                Test Renpho Connection
              </button>

              {testRenphoStatus && (
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: testRenphoStatus.success ? '#34d399' : '#fb7185' }}>
                  {testRenphoStatus.msg}
                </div>
              )}
            </div>

            {/* Garmin Credentials */}
            <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#a855f7" /> Garmin Connect Credentials
              </h3>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Garmin Account Email</label>
                <input className="input-field" type="email" value={garminEmail} onChange={e => setGarminEmail(e.target.value)} placeholder="your_garmin_email@example.com" />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Garmin Password</label>
                <input className="input-field" type="password" value={garminPassword} onChange={e => setGarminPassword(e.target.value)} placeholder="Password" />
              </div>

              {testGarminStatus?.mfa && (
                <div style={{ marginBottom: '12px', background: 'rgba(245,158,11,0.15)', padding: '12px', borderRadius: '8px' }}>
                  <label style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Garmin 2FA / MFA Code</label>
                  <input className="input-field" type="text" value={garminMfa} onChange={e => setGarminMfa(e.target.value)} placeholder="Enter 6-digit MFA Code" />
                </div>
              )}

              <button className="secondary-btn" style={{ fontSize: '0.82rem', padding: '8px 14px' }} onClick={testGarminLogin}>
                Test Garmin Connection
              </button>

              {testGarminStatus && (
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: testGarminStatus.success ? '#34d399' : testGarminStatus.mfa ? '#fbbf24' : '#fb7185' }}>
                  {testGarminStatus.msg}
                </div>
              )}
            </div>

            {/* Display Preferences */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Preferred Weight Display Unit</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="secondary-btn" style={{ flex: 1, justifyContent: 'center', background: weightUnit === 'kg' ? 'rgba(6,182,212,0.2)' : 'transparent', borderColor: weightUnit === 'kg' ? '#06b6d4' : 'var(--border-light)' }} onClick={() => setWeightUnit('kg')}>
                  Kilograms (kg)
                </button>
                <button className="secondary-btn" style={{ flex: 1, justifyContent: 'center', background: weightUnit === 'lbs' ? 'rgba(6,182,212,0.2)' : 'transparent', borderColor: weightUnit === 'lbs' ? '#06b6d4' : 'var(--border-light)' }} onClick={() => setWeightUnit('lbs')}>
                  Pounds (lbs)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="secondary-btn" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="gradient-btn" onClick={handleSaveSettings}>Save & Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
