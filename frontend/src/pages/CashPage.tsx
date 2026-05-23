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
  sale: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Sale' },
  refund: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'Refund' },
  'no-sale': { bg: 'bg-red-500/15', text: 'text-red-400', label: 'No-Sale' },
};

const severityColor: Record<string, string> = {
  low: 'border-amber-300/40 bg-amber-500/10',
  medium: 'border-orange-300/40 bg-orange-500/10',
  high: 'border-red-300/40 bg-red-500/10',
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
      if (newPin.length >= 4) {
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

  // Lock icon for PIN screens
  const LockIcon = () => (
    <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );

  // Money icon
  const MoneyIcon = () => (
    <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );

  // ── PIN Entry Gate ──
  if (!authenticated) {
    if (needsSetup) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-xs text-center space-y-8">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <LockIcon />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Set Your PIN</h2>
              <p className="text-sm text-[#86868B] mt-1">
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
                      i < current.length ? 'bg-blue-500 scale-100' : 'bg-gray-200 scale-75'
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
                      ? 'bg-gray-100 hover:bg-gray-200 text-[#86868B] text-lg'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={handleSetupPin}
              disabled={(setupStep === 'enter' ? setupPin.length : setupConfirm.length) < 4}
              className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium text-sm hover:bg-blue-400 shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              {setupStep === 'enter' ? 'Next' : 'Confirm'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center space-y-8">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <MoneyIcon />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Cash Management</h2>
            <p className="text-sm text-[#86868B] mt-1">Enter your PIN to continue</p>
          </div>

          {/* PIN dots */}
          <div
            className={`flex justify-center gap-3 ${
              shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
            }`}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? pinError
                      ? 'bg-red-400 scale-100'
                      : 'bg-emerald-500 scale-100'
                    : 'bg-gray-200 scale-75'
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
                    ? 'bg-gray-100 hover:bg-gray-200 text-[#86868B] text-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {verifying && (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
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
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Cash Management</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Track every cash transaction — register counts, safe drops, and discrepancies. PIN-protected for accountability.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0 ml-6">
            {!session || session.status !== 'active' ? (
              <button
                onClick={handleOpenSession}
                className="px-6 py-3 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-500/20 transition-all duration-200 active:scale-95"
              >
                Open Session
              </button>
            ) : (
              <button
                onClick={handleCloseSession}
                className="px-6 py-3 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95"
              >
                Close Session
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Session Panel */}
          {session && session.status === 'active' ? (
            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-lg font-semibold text-gray-900">Active Session</h2>
                </div>
                <span className="text-sm text-[#86868B] font-mono">{elapsed}</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{session.registerId || '—'}</p>
                  <p className="text-xs text-[#86868B] mt-1">Register</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(session.openingAmount || 0)}</p>
                  <p className="text-xs text-[#86868B] mt-1">Opening</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(session.currentTotal || 0)}</p>
                  <p className="text-xs text-[#86868B] mt-1">Running Total</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${variance < 0 ? 'bg-red-500/10' : variance > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                      <svg className={`w-5 h-5 ${variance < 0 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${variance < 0 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {variance < 0 ? '−' : variance > 0 ? '+' : ''}{formatCurrency(Math.abs(variance))}
                  </p>
                  <p className="text-xs text-[#86868B] mt-1">Variance</p>
                </div>
              </div>

              {/* Summary bar */}
              <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#86868B] mb-0.5">Expected</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(session.expectedTotal || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#86868B] mb-0.5">Actual</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(session.currentTotal || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#86868B] mb-0.5">Variance</p>
                  <p className={`text-sm font-semibold ${variance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {variance < 0 ? '−' : '+'}{formatCurrency(Math.abs(variance))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">No Active Session</p>
              <p className="text-sm text-[#86868B] mt-1">Open a session to start tracking cash</p>
            </div>
          )}

          {/* Transaction Log */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Log</h2>
            {transactions.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 text-center text-[#86868B] text-sm">
                No transactions yet
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Description</th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const badge = txBadge[tx.type] || txBadge.sale;
                      return (
                        <tr
                          key={tx.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#636366]">{tx.description}</td>
                          <td className="px-5 py-4 text-right">
                            <span
                              className={`text-sm font-semibold ${
                                tx.type === 'refund' || tx.type === 'no-sale' ? 'text-red-500' : 'text-gray-900'
                              }`}
                            >
                              {tx.type === 'refund' ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-[#86868B]">{formatTime(tx.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cash Alerts */}
          {alerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cash Alerts</h2>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-2xl px-5 py-3.5 flex items-center justify-between ${
                      severityColor[alert.severity] || severityColor.low
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-orange-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-sm text-gray-900">{alert.message}</span>
                    </div>
                    <span className="text-xs text-[#86868B]">{formatTime(alert.timestamp)}</span>
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
