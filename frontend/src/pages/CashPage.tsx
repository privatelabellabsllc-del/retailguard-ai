import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

interface CashSession {
  id: string;
  registerId: string;
  openingAmount: number;
  currentTotal: number;
  expectedTotal: number;
  startedAt: string;
  status: 'active' | 'closed';
}

interface Transaction {
  id: string;
  type: 'sale' | 'refund' | 'no-sale';
  amount: number;
  description: string;
  timestamp: string;
}

interface CashAlert {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
  transactionId?: string;
}

const txBadge: Record<string, { bg: string; text: string; label: string }> = {
  sale: { bg: 'bg-green-500/20', text: 'text-green-600', label: 'Sale' },
  refund: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Refund' },
  'no-sale': { bg: 'bg-red-500/20', text: 'text-red-600', label: 'No-Sale' },
};

const severityColor: Record<string, string> = {
  low: 'border-yellow-500/30 bg-yellow-500/10',
  medium: 'border-orange-500/30 bg-orange-500/10',
  high: 'border-red-500/30 bg-red-500/10',
};

export default function CashPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [verifying, setVerifying] = useState(false);

  const [session, setSession] = useState<CashSession | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<CashAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PIN pad digits
  const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  const handlePinPress = async (key: string) => {
    if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1));
      setPinError(false);
      return;
    }
    if (key === '' || pin.length >= 8) return;

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length >= 4) {
      // Auto-verify at 4+ digits — user can also keep entering up to 8
      // We'll try verify at 4, 5, 6, 7, 8
      if (newPin.length >= 4) {
        // Small delay for UX
        setTimeout(() => tryVerify(newPin), 150);
      }
    }
  };

  const tryVerify = async (pinValue: string) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await api.cash.verifyPin(pinValue);
      if (res.success || res.data?.success || res.verified) {
        setAuthenticated(true);
        fetchCashData();
      } else if (res.needsSetup) {
        setNeedsSetup(true);
      } else {
        triggerShake();
      }
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.needsSetup) {
        setNeedsSetup(true);
      } else {
        triggerShake();
      }
    } finally {
      setVerifying(false);
    }
  };

  const triggerShake = () => {
    setPinError(true);
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      setPin('');
      setPinError(false);
    }, 600);
  };

  const handleSetupPin = async () => {
    if (setupStep === 'enter') {
      if (setupPin.length < 4) return;
      setSetupStep('confirm');
      return;
    }
    if (setupConfirm !== setupPin) {
      triggerShake();
      setSetupConfirm('');
      setSetupStep('enter');
      setSetupPin('');
      return;
    }
    try {
      await api.cash.setPin(setupPin);
      setNeedsSetup(false);
      setAuthenticated(true);
      fetchCashData();
    } catch (err) {
      console.error('Failed to set PIN', err);
    }
  };

  const fetchCashData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessRes, alertRes] = await Promise.all([
        api.cash.sessions(),
        api.cash.alerts(),
      ]);
      const sessions = sessRes.data || sessRes;
      const activeSession = Array.isArray(sessions)
        ? sessions.find((s: CashSession) => s.status === 'active')
        : sessions;
      setSession(activeSession || null);
      setTransactions(activeSession?.transactions || []);
      setAlerts(alertRes.data || alertRes || []);
    } catch (err) {
      console.error('Failed to fetch cash data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (session?.startedAt && session.status === 'active') {
      const update = () => {
        const diff = Date.now() - new Date(session.startedAt).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [session]);

  const handleOpenSession = async () => {
    try {
      await api.cash.openSession();
      fetchCashData();
    } catch (err) {
      console.error('Failed to open session', err);
    }
  };

  const handleCloseSession = async () => {
    try {
      await api.cash.closeSession(session?.id);
      if (timerRef.current) clearInterval(timerRef.current);
      fetchCashData();
    } catch (err) {
      console.error('Failed to close session', err);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // ── PIN Entry Gate ──
  if (!authenticated) {
    if (needsSetup) {
      return (
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 flex items-center justify-center">
          <div className="w-full max-w-xs text-center space-y-8">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
                🔐
              </div>
              <h2 className="text-xl font-semibold">Set Your PIN</h2>
              <p className="text-sm text-gray-900/40 mt-1">
                {setupStep === 'enter' ? 'Enter a 4-8 digit PIN' : 'Confirm your PIN'}
              </p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: 8 }).map((_, i) => {
                const current = setupStep === 'enter' ? setupPin : setupConfirm;
                return (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${
                      i < current.length ? 'bg-blue-400 scale-100' : 'bg-white/10 scale-75'
                    }`}
                  />
                );
              })}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {padKeys.map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === '') return;
                    if (setupStep === 'enter') {
                      if (key === '⌫') setSetupPin((p) => p.slice(0, -1));
                      else if (setupPin.length < 8) setSetupPin((p) => p + key);
                    } else {
                      if (key === '⌫') setSetupConfirm((p) => p.slice(0, -1));
                      else if (setupConfirm.length < 8) setSetupConfirm((p) => p + key);
                    }
                  }}
                  disabled={key === ''}
                  className={`h-14 rounded-2xl text-xl font-medium transition-all duration-150 active:scale-90 ${
                    key === ''
                      ? 'invisible'
                      : key === '⌫'
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-gray-900/60 text-lg'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] text-gray-900'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={handleSetupPin}
              disabled={(setupStep === 'enter' ? setupPin.length : setupConfirm.length) < 4}
              className="w-full py-3 rounded-xl bg-blue-500 text-gray-900 font-medium text-sm hover:bg-blue-600 transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
            >
              {setupStep === 'enter' ? 'Next' : 'Confirm'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F5F5F7] text-gray-900 flex items-center justify-center">
        <div className="w-full max-w-xs text-center space-y-8">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center text-2xl mx-auto mb-4">
              💰
            </div>
            <h2 className="text-xl font-semibold">Cash Management</h2>
            <p className="text-sm text-gray-900/40 mt-1">Enter your PIN to continue</p>
          </div>

          {/* PIN dots */}
          <div
            className={`flex justify-center gap-3 transition-transform ${
              shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
            }`}
            style={
              shaking
                ? {
                    animation: 'shake 0.5s ease-in-out',
                  }
                : {}
            }
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? pinError
                      ? 'bg-red-400 scale-100'
                      : 'bg-white scale-100'
                    : 'bg-white/10 scale-75'
                }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {padKeys.map((key, i) => (
              <button
                key={i}
                onClick={() => handlePinPress(key)}
                disabled={key === '' || verifying}
                className={`h-14 rounded-2xl text-xl font-medium transition-all duration-150 active:scale-90 ${
                  key === ''
                    ? 'invisible'
                    : key === '⌫'
                    ? 'bg-white/[0.06] hover:bg-white/[0.1] text-gray-900/60 text-lg'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-gray-900'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {verifying && (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            </div>
          )}

          {/* Inject shake keyframes */}
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
              20%, 40%, 60%, 80% { transform: translateX(8px); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ── Authenticated Cash Dashboard ──
  const variance = session ? (session.currentTotal || 0) - (session.expectedTotal || 0) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Cash Management</h1>
        <div className="flex gap-3">
          {!session || session.status !== 'active' ? (
            <button
              onClick={handleOpenSession}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-gray-900 text-sm font-medium rounded-full transition-all duration-200 active:scale-95"
            >
              Open Session
            </button>
          ) : (
            <button
              onClick={handleCloseSession}
              className="px-5 py-2.5 bg-red-500/80 hover:bg-red-500 text-gray-900 text-sm font-medium rounded-full transition-all duration-200 active:scale-95"
            >
              Close Session
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-8 pb-8 space-y-6">
          {/* Active Session Panel */}
          {session && session.status === 'active' ? (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <h2 className="text-lg font-semibold">Active Session</h2>
                </div>
                <span className="text-sm text-gray-900/40 font-mono">{elapsed}</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-xs text-gray-900/40 uppercase tracking-wider mb-1">Register</p>
                  <p className="text-xl font-bold">{session.registerId || '—'}</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-xs text-gray-900/40 uppercase tracking-wider mb-1">Opening</p>
                  <p className="text-xl font-bold">{formatCurrency(session.openingAmount || 0)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-xs text-gray-900/40 uppercase tracking-wider mb-1">Running Total</p>
                  <p className="text-xl font-bold">{formatCurrency(session.currentTotal || 0)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-xs text-gray-900/40 uppercase tracking-wider mb-1">Variance</p>
                  <p className={`text-xl font-bold ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {variance < 0 ? '−' : variance > 0 ? '+' : ''}{formatCurrency(Math.abs(variance))}
                  </p>
                </div>
              </div>

              {/* Summary bar */}
              <div className="mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-900/40 mb-0.5">Expected</p>
                  <p className="text-sm font-semibold">{formatCurrency(session.expectedTotal || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-900/40 mb-0.5">Actual</p>
                  <p className="text-sm font-semibold">{formatCurrency(session.currentTotal || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-900/40 mb-0.5">Variance</p>
                  <p className={`text-sm font-semibold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {variance < 0 ? '−' : '+'}{formatCurrency(Math.abs(variance))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-lg font-medium text-gray-900/60">No Active Session</p>
              <p className="text-sm text-gray-900/30 mt-1">Open a session to start tracking cash</p>
            </div>
          )}

          {/* Transaction Log */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900/90">Transaction Log</h2>
            {transactions.length === 0 ? (
              <div className="bg-white/[0.05] rounded-2xl p-8 text-center text-gray-900/30 text-sm">
                No transactions yet
              </div>
            ) : (
              <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {transactions.map((tx) => {
                  const badge = txBadge[tx.type] || txBadge.sale;
                  return (
                    <div
                      key={tx.id}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <span className="text-sm text-gray-900/70">{tx.description}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-sm font-semibold ${
                            tx.type === 'refund' || tx.type === 'no-sale' ? 'text-red-600' : 'text-gray-900/90'
                          }`}
                        >
                          {tx.type === 'refund' ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                        <span className="text-xs text-gray-900/30">{formatTime(tx.timestamp)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cash Alerts */}
          {alerts.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-900/90">Cash Alerts</h2>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-xl px-5 py-3.5 flex items-center justify-between ${
                      severityColor[alert.severity] || severityColor.low
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        {alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟠' : '🟡'}
                      </span>
                      <span className="text-sm text-gray-900/80">{alert.message}</span>
                    </div>
                    <span className="text-xs text-gray-900/30">{formatTime(alert.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
