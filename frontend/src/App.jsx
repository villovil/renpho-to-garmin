import React, { useState, useEffect } from 'react';
import { 
  Activity, Scale, RefreshCw, CheckCircle2, AlertCircle, Settings, 
  ArrowRight, ShieldCheck, Zap, History, Database, Flame, Droplets, 
  Dumbbell, HeartPulse, User, Lock, Key, ChevronRight, X, LogOut 
} from 'lucide-react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:8000/api'
  : '/api';

export default function App() {
  const [config, setConfig] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('measurements');
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form State with LocalStorage initialization
  const [renphoEmail, setRenphoEmail] = useState(() => localStorage.getItem('renpho_email') || '');
  const [renphoPassword, setRenphoPassword] = useState(() => localStorage.getItem('renpho_password') || '');
  const [garminEmail, setGarminEmail] = useState(() => localStorage.getItem('garmin_email') || '');
  const [garminPassword, setGarminPassword] = useState(() => localStorage.getItem('garmin_password') || '');
  const [garminMfa, setGarminMfa] = useState('');
  const [rememberCreds, setRememberCreds] = useState(() => localStorage.getItem('remember_creds') !== 'false');
  const [weightUnit, setWeightUnit] = useState(() => localStorage.getItem('weight_unit') || 'kg');
  
  // Status Messages
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [testRenphoStatus, setTestRenphoStatus] = useState(null);
  const [testGarminStatus, setTestGarminStatus] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const getAuthPayload = () => ({
    renpho_email: renphoEmail,
    renpho_password: renphoPassword,
    garmin_email: garminEmail,
    garmin_password: garminPassword,
    mfa_code: garminMfa
  });

  const saveLocalCreds = (rEmail, rPw, gEmail, gPw, remember, unit) => {
    if (remember) {
      if (rEmail) localStorage.setItem('renpho_email', rEmail);
      if (rPw) localStorage.setItem('renpho_password', rPw);
      if (gEmail) localStorage.setItem('garmin_email', gEmail);
      if (gPw) localStorage.setItem('garmin_password', gPw);
      localStorage.setItem('remember_creds', 'true');
    } else {
      localStorage.removeItem('renpho_email');
      localStorage.removeItem('renpho_password');
      localStorage.removeItem('garmin_email');
      localStorage.removeItem('garmin_password');
      localStorage.setItem('remember_creds', 'false');
    }
    if (unit) localStorage.setItem('weight_unit', unit);
  };

  const handleClearCreds = () => {
    setRenphoEmail('');
    setRenphoPassword('');
    setGarminEmail('');
    setGarminPassword('');
    setGarminMfa('');
    localStorage.removeItem('renpho_email');
    localStorage.removeItem('renpho_password');
    localStorage.removeItem('garmin_email');
    localStorage.removeItem('garmin_password');
    setStatusMsg({ type: 'info', text: 'Cleared saved credentials from this browser.' });
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const cfgRes = await fetch(`${API_BASE}/config`).then(r => r.json()).catch(() => ({}));
      setConfig(cfgRes);

      if (!renphoEmail && cfgRes.renpho_email) setRenphoEmail(cfgRes.renpho_email);
      if (!garminEmail && cfgRes.garmin_email) setGarminEmail(cfgRes.garmin_email);
      if (!weightUnit && cfgRes.weight_unit) setWeightUnit(cfgRes.weight_unit);

      // Attempt fetching measurements using available credentials
      const currentAuth = {
        renpho_email: renphoEmail || cfgRes.renpho_email || '',
        renpho_password: renphoPassword || '',
        garmin_email: garminEmail || cfgRes.garmin_email || '',
        garmin_password: garminPassword || ''
      };

      const [measRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/measurements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentAuth)
        }).then(r => r.json()).catch(() => ({ measurements: [] })),

        fetch(`${API_BASE}/logs`).then(r => r.json()).catch(() => ({ logs: [] }))
      ]);

      if (measRes.status === 'success') {
        setMeasurements(measRes.measurements || []);
      }
      if (logsRes.status === 'success') {
        setLogs(logsRes.logs || []);
      }

      const hasRenpho = Boolean(currentAuth.renpho_email && (currentAuth.renpho_password || cfgRes.has_renpho_creds));
      const hasGarmin = Boolean(currentAuth.garmin_email && (currentAuth.garmin_password || cfgRes.has_garmin_creds));

      if (!hasRenpho || !hasGarmin) {
        setShowSettings(true);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      saveLocalCreds(renphoEmail, renphoPassword, garminEmail, garminPassword, rememberCreds, weightUnit);
      
      const payload = {
        renpho_email: renphoEmail,
        renpho_password: renphoPassword,
        garmin_email: garminEmail,
        garmin_password: garminPassword,
        weight_unit: weightUnit
      };

      await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});

      setStatusMsg({ type: 'success', text: 'Credentials updated for session!' });
      fetchInitialData();
      setShowSettings(false);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to update settings: ' + err.message });
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
    if (!renphoEmail || !garminEmail) {
      setShowSettings(true);
      setStatusMsg({ type: 'warning', text: 'Please enter your Renpho and Garmin credentials first.' });
      return;
    }

    setSyncing(true);
    setStatusMsg({ type: 'info', text: 'Syncing latest Renpho weigh-in to Garmin Connect...' });
    try {
      saveLocalCreds(renphoEmail, renphoPassword, garminEmail, garminPassword, rememberCreds, weightUnit);
      const res = await fetch(`${API_BASE}/sync/latest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthPayload())
      }).then(r => r.json());

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
    if (!renphoEmail || !garminEmail) {
      setShowSettings(true);
      setStatusMsg({ type: 'warning', text: 'Please enter your Renpho and Garmin credentials first.' });
      return;
    }

    setSyncing(true);
    setStatusMsg({ type: 'info', text: 'Batch syncing unsynced Renpho history...' });
    try {
      saveLocalCreds(renphoEmail, renphoPassword, garminEmail, garminPassword, rememberCreds, weightUnit);
      const res = await fetch(`${API_BASE}/sync/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthPayload())
      }).then(r => r.json());

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
    if (!renphoEmail || !garminEmail) {
      setShowSettings(true);
      setStatusMsg({ type: 'warning', text: 'Please enter your Renpho and Garmin credentials first.' });
      return;
    }

    setSyncing(true);
    try {
      saveLocalCreds(renphoEmail, renphoPassword, garminEmail, garminPassword, rememberCreds, weightUnit);
      const res = await fetch(`${API_BASE}/sync/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...getAuthPayload(),
          measurement: m
        })
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

        {/* Status Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className={`badge ${renphoEmail ? 'badge-success' : 'badge-warning'}`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: renphoEmail ? '#34d399' : '#fbbf24' }}></span>
            Renpho: {renphoEmail ? 'Set' : 'Required'}
          </div>

          <div className={`badge ${garminEmail ? 'badge-success' : 'badge-warning'}`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: garminEmail ? '#34d399' : '#fbbf24' }}></span>
            Garmin: {garminEmail ? 'Set' : 'Required'}
          </div>

          <button className="secondary-btn" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            Accounts
          </button>

          {(renphoEmail || garminEmail) && (
            <button className="secondary-btn" style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#fb7185' }} onClick={handleClearCreds} title="Clear saved credentials from browser">
              <LogOut size={16} />
              Clear Saved
            </button>
          )}
        </div>
      </header>

      {/* Alert banner if message */}
      {statusMsg.text && (
        <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: statusMsg.type === 'error' ? 'rgba(244,63,94,0.4)' : statusMsg.type === 'success' ? 'rgba(16,185,129,0.4)' : 'var(--border-light)' }}>
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
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>HISTORICAL SYNC</span>
              <History size={18} color="#a855f7" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Batch Sync All History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Syncs all unsynced past weigh-ins chronologically.</p>
          </div>
          <button className="secondary-btn" style={{ marginTop: '16px', justifyContent: 'center' }} onClick={handleBatchSync} disabled={syncing}>
            <Database size={16} />
            {syncing ? 'Syncing...' : 'Run Batch Sync'}
          </button>
        </div>

        {/* Latest Reading Highlight Card */}
        <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#06b6d4', fontWeight: 700 }}>LATEST WEIGH-IN</span>
            <Activity size={18} color="#38bdf8" />
          </div>

          {latest ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                  {weightUnit === 'lbs' ? latest.weight_lbs : latest.weight_kg}
                </span>
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{weightUnit}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {new Date(latest.timestamp_iso).toLocaleString()}
              </p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                {latest.percent_fat > 0 && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>Fat: {latest.percent_fat}%</span>}
                {latest.muscle_mass_kg > 0 && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>Muscle: {latest.muscle_mass_kg}kg</span>}
                {latest.bmi > 0 && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>BMI: {latest.bmi}</span>}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              {renphoEmail ? 'Click "Sync Latest" to fetch measurements.' : 'Configure credentials to view latest weigh-in.'}
            </p>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '20px', gap: '24px' }}>
        <button 
          onClick={() => setActiveTab('measurements')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 4px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            color: activeTab === 'measurements' ? '#06b6d4' : 'var(--text-muted)',
            borderBottom: activeTab === 'measurements' ? '2px solid #06b6d4' : '2px solid transparent'
          }}
        >
          Scale Entries ({measurements.length})
        </button>

        <button 
          onClick={() => setActiveTab('logs')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 4px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            color: activeTab === 'logs' ? '#06b6d4' : 'var(--text-muted)',
            borderBottom: activeTab === 'logs' ? '2px solid #06b6d4' : '2px solid transparent'
          }}
        >
          Activity Log ({logs.length})
        </button>
      </div>

      {/* Tab Content: Measurements */}
      {activeTab === 'measurements' && (
        <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <RefreshCw size={28} className="spin" color="#06b6d4" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>Loading scale measurements...</p>
            </div>
          ) : measurements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Scale size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>No Renpho measurements found.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Make sure your Renpho account email & password are entered correctly.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px' }}>Date & Time</th>
                  <th style={{ padding: '12px' }}>Weight</th>
                  <th style={{ padding: '12px' }}>Body Fat</th>
                  <th style={{ padding: '12px' }}>Muscle Mass</th>
                  <th style={{ padding: '12px' }}>BMI</th>
                  <th style={{ padding: '12px' }}>Garmin Sync</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px 12px', fontWeight: 600 }}>
                      {new Date(m.timestamp_iso).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 12px', fontWeight: 800, color: '#38bdf8' }}>
                      {weightUnit === 'lbs' ? `${m.weight_lbs} lbs` : `${m.weight_kg} kg`}
                    </td>
                    <td style={{ padding: '14px 12px' }}>{m.percent_fat > 0 ? `${m.percent_fat}%` : '-'}</td>
                    <td style={{ padding: '14px 12px' }}>{m.muscle_mass_kg > 0 ? `${m.muscle_mass_kg} kg` : '-'}</td>
                    <td style={{ padding: '14px 12px' }}>{m.bmi > 0 ? m.bmi : '-'}</td>
                    <td style={{ padding: '14px 12px' }}>
                      {m.synced ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.82rem', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Synced
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                      <button 
                        className="secondary-btn" 
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                        onClick={() => handleSyncSingle(m)}
                        disabled={syncing}
                      >
                        Push to Garmin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Account & Sync Settings</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Stateless & Private: Credentials are only used for your sync session.
                </p>
              </div>
              <X size={22} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(false)} />
            </div>

            {/* Renpho Credentials */}
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
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
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
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

            {/* Privacy & Browser Storage Preference */}
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500 }}>
                <input type="checkbox" checked={rememberCreds} onChange={e => setRememberCreds(e.target.checked)} style={{ accentColor: '#06b6d4', width: '16px', height: '16px' }} />
                Remember credentials in this browser (localStorage)
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                If unchecked, credentials will be cleared when you close the browser tab.
              </p>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <button className="secondary-btn" style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#fb7185' }} onClick={handleClearCreds}>
                Clear Saved Credentials
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="secondary-btn" onClick={() => setShowSettings(false)}>Cancel</button>
                <button className="gradient-btn" onClick={handleSaveSettings}>Save & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
