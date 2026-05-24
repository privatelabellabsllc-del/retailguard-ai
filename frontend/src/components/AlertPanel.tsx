/**
 * AlertPanel — The slide-in side panel when an offender/blacklisted person is detected.
 * 
 * Shows:
 * - Person's photo and identity match details
 * - Live camera tracking
 * - Previous theft video
 * - 3 action buttons: Contact Authorities 🚔 | Let Go 🤚 | Blacklist ⛔
 * - Plus: Monitor 👁️ | Show Video to Customer 📺
 */
import { useState } from 'react';
import { 
  X, Phone, Ban, HandMetal, Eye, Monitor, AlertTriangle, 
  Shield, User, MapPin, Clock, Video, ChevronDown
} from 'lucide-react';
import { acknowledgeAlert, takeAlertAction } from '../services/api';
import type { Alert } from '../types';

interface AlertPanelProps {
  alert: Alert;
  onClose: () => void;
  onAction: () => void;
}

export default function AlertPanel({ alert, onClose, onAction }: AlertPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showAuthorities, setShowAuthorities] = useState(false);

  const isCritical = alert.priority === 'critical' || alert.alert_type === 'blacklisted_entered';
  const isThief = alert.person_status === 'thief' || alert.person_status === 'blacklisted';

  const handleAction = async (action: string) => {
    if (action === 'call_police') {
      setShowAuthorities(true);
      return;
    }
    
    if (['blacklist', 'confront'].includes(action) && !showConfirm) {
      setShowConfirm(action);
      return;
    }

    setActionLoading(action);
    try {
      await takeAlertAction(alert.id, { action, notes: notes || undefined });
      onAction();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
      setShowConfirm(null);
    }
  };

  const threatColor = {
    0: 'text-gray-500',
    1: 'text-yellow-600',
    2: 'text-orange-400',
    3: 'text-red-600',
    4: 'text-red-500',
  }[alert.person_threat_level] || 'text-gray-500';

  return (
    <>
      <div className={`alert-panel ${isCritical ? 'alert-critical' : ''}`}>
        {/* Header */}
        <div className={`p-4 border-b border-gray-200 ${isCritical ? 'bg-red-950/50' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
              <h2 className="font-bold text-lg">{alert.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{alert.message}</p>
        </div>

        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Person Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-4">
              {/* Portrait */}
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                {alert.best_portrait_path ? (
                  <img src={alert.best_portrait_path} alt="Subject" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-600" />
                )}
              </div>
              
              {/* Details */}
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-lg">
                  {alert.person_display_name || 'Unknown Individual'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    alert.person_status === 'blacklisted' ? 'badge-danger' :
                    alert.person_status === 'thief' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {alert.person_status === 'blacklisted' ? '⛔ BLACKLISTED' :
                     alert.person_status === 'thief' ? '⚠️ CONFIRMED THIEF' :
                     '👁️ PERSON OF INTEREST'}
                  </span>
                </div>
                <p className={`text-sm font-medium ${threatColor}`}>
                  Threat Level: {'🔴'.repeat(alert.person_threat_level)}{'⚪'.repeat(4 - alert.person_threat_level)}
                </p>
                <p className="text-sm text-gray-500">
                  {alert.person_total_thefts} confirmed theft{alert.person_total_thefts !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Match Confidence */}
          {alert.match_confidence && (
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Identity Match</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Confidence</span>
                  <span className={`font-bold ${
                    alert.match_confidence > 0.9 ? 'text-green-600' :
                    alert.match_confidence > 0.8 ? 'text-yellow-600' : 'text-orange-400'
                  }`}>
                    {(alert.match_confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      alert.match_confidence > 0.9 ? 'bg-green-500' :
                      alert.match_confidence > 0.8 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${alert.match_confidence * 100}%` }}
                  />
                </div>
                {alert.match_details && (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    {alert.match_details.face_score != null && (
                      <div className="bg-gray-100/60 p-2 rounded">
                        <span className="text-gray-500">Face</span>
                        <span className="float-right font-medium">{(alert.match_details.face_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {alert.match_details.body_score != null && (
                      <div className="bg-gray-100/60 p-2 rounded">
                        <span className="text-gray-500">Body</span>
                        <span className="float-right font-medium">{(alert.match_details.body_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {alert.match_details.gait_score != null && (
                      <div className="bg-gray-100/60 p-2 rounded">
                        <span className="text-gray-500">Gait</span>
                        <span className="float-right font-medium">{(alert.match_details.gait_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {alert.match_details.height_match != null && (
                      <div className="bg-gray-100/60 p-2 rounded">
                        <span className="text-gray-500">Height</span>
                        <span className="float-right font-medium">{alert.match_details.height_match ? '✅' : '❌'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Previous Theft Video */}
          {alert.reference_clip_url && (
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                <Video className="w-4 h-4" /> Previous Theft Recording
              </h4>
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  src={alert.reference_clip_url}
                  controls
                  className="w-full"
                  poster="/video-poster.jpg"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Evidence from last confirmed theft incident
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="p-4 border-b border-gray-200">
            <label className="text-sm font-medium text-gray-500 mb-1 block">Action Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this encounter..."
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              rows={2}
            />
          </div>

          {/* === ACTION BUTTONS === */}
          <div className="p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Take Action</h4>
            
            {/* Primary actions — the 3 main buttons */}
            <div className="grid grid-cols-1 gap-2">
              {/* 🚔 CONTACT AUTHORITIES */}
              <button
                onClick={() => handleAction('call_police')}
                disabled={actionLoading !== null}
                className="flex items-center gap-3 w-full bg-red-600 hover:bg-red-700 text-gray-900 px-4 py-3 rounded-lg font-bold text-base transition-colors disabled:opacity-50"
              >
                <Phone className="w-5 h-5" />
                🚔 Contact Authorities
                <Shield className="w-5 h-5 ml-auto" />
              </button>

              {/* 🤚 LET THEM GO */}
              <button
                onClick={() => handleAction('let_go')}
                disabled={actionLoading !== null}
                className="flex items-center gap-3 w-full bg-gray-200 hover:bg-gray-600 text-gray-900 px-4 py-3 rounded-lg font-medium text-base transition-colors disabled:opacity-50"
              >
                <HandMetal className="w-5 h-5" />
                🤚 Let Them Go
              </button>

              {/* ⛔ BLACKLIST */}
              <button
                onClick={() => handleAction('blacklist')}
                disabled={actionLoading !== null}
                className="flex items-center gap-3 w-full bg-orange-600 hover:bg-orange-700 text-gray-900 px-4 py-3 rounded-lg font-bold text-base transition-colors disabled:opacity-50"
              >
                <Ban className="w-5 h-5" />
                ⛔ Blacklist This Person
              </button>
            </div>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleAction('monitor')}
                disabled={actionLoading !== null}
                className="btn-outline flex items-center gap-2 justify-center text-sm"
              >
                <Eye className="w-4 h-4" /> Monitor
              </button>
              <button
                onClick={() => handleAction('confront')}
                disabled={actionLoading !== null}
                className="btn-outline flex items-center gap-2 justify-center text-sm"
              >
                <Monitor className="w-4 h-4" /> Show Video
              </button>
            </div>
          </div>

          {/* Confirmation dialog */}
          {showConfirm && (
            <div className="p-4 mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-500 mb-3">
                {showConfirm === 'blacklist'
                  ? 'Are you sure you want to BLACKLIST this person? They will be flagged on every future visit.'
                  : 'This will display the theft video on the customer-facing screen. Proceed?'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConfirm(null); handleAction(showConfirm); }}
                  className="btn-warning text-sm"
                >
                  Yes, Confirm
                </button>
                <button onClick={() => setShowConfirm(null)} className="btn-outline text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Authorities Overlay */}
      {showAuthorities && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center">
          <div className="bg-white border-2 border-red-600 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-gray-900" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">CONTACT AUTHORITIES</h2>
            <p className="text-gray-500 mb-6">
              An evidence package with video, photos, and physical description has been prepared and is ready to share with law enforcement.
            </p>
            <button
              onClick={async () => {
                setShowAuthorities(false);
                await handleAction('call_police');
              }}
              className="block w-full bg-red-600 hover:bg-red-700 text-white text-xl font-bold py-4 rounded-xl mb-3 transition-colors"
            >
              🚔 Log as Authorities Contacted
            </button>
            <button
              onClick={() => setShowAuthorities(false)}
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
