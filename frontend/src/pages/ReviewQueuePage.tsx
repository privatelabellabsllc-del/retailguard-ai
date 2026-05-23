/**
 * ReviewQueuePage — Where clerks review AI-detected incidents.
 * Shows video clips and lets clerks click: Theft ✅ | Not Theft ❌ | Unsure 🤷
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, CheckCircle, XCircle, HelpCircle, Clock,
  AlertTriangle, ChevronRight, Video, User
} from 'lucide-react';
import { getPendingIncidents, getIncidents, reviewIncident } from '../services/api';
import type { Incident } from '../types';

export default function ReviewQueuePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [estimatedItem, setEstimatedItem] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await getIncidents(params);
      setIncidents(res.data);
      if (res.data.length > 0 && !selectedIncident) {
        setSelectedIncident(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIncidents(); }, [filter]);

  const handleReview = async (action: string) => {
    if (!selectedIncident) return;
    setReviewLoading(true);
    try {
      await reviewIncident(selectedIncident.id, {
        action,
        notes: notes || undefined,
        estimated_item: estimatedItem || undefined,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : undefined,
      });
      
      // Remove from list and select next
      const remaining = incidents.filter((i) => i.id !== selectedIncident.id);
      setIncidents(remaining);
      setSelectedIncident(remaining[0] || null);
      setNotes('');
      setEstimatedItem('');
      setEstimatedValue('');
    } catch (err) {
      console.error(err);
    } finally {
      setReviewLoading(false);
    }
  };

  const severityColor = (s: string) => ({
    low: 'text-blue-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  }[s] || 'text-gray-400');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Incident Review Queue</h1>
        <div className="flex gap-2">
          {['pending', 'theft', 'not_theft', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f === 'pending' ? '⏳ Pending' :
               f === 'theft' ? '🔴 Theft' :
               f === 'not_theft' ? '✅ Cleared' : '📋 All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Incident List */}
        <div className="lg:col-span-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : incidents.length === 0 ? (
            <div className="card text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-400">No incidents to review! 🎉</p>
            </div>
          ) : (
            incidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedIncident?.id === inc.id
                    ? 'bg-blue-900/20 border-blue-700'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`w-4 h-4 ${severityColor(inc.severity)}`} />
                  <span className="text-sm font-medium capitalize">{inc.incident_type.replace('_', ' ')}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {(inc.ai_confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {inc.ai_description || 'Suspicious activity detected'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <span className="text-xs text-gray-600">
                    {new Date(inc.detected_at).toLocaleString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Incident Detail / Review Panel */}
        <div className="lg:col-span-2 overflow-y-auto">
          {selectedIncident ? (
            <div className="card space-y-4">
              {/* Video Player */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Video className="w-4 h-4" /> Evidence Clip
                </h3>
                {selectedIncident.clips.length > 0 ? (
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      key={selectedIncident.clips[0].id}
                      src={selectedIncident.clips[0].clip_url}
                      controls
                      autoPlay
                      className="w-full max-h-[400px]"
                    />
                    <div className="flex items-center gap-4 p-2 bg-gray-900 text-xs text-gray-500">
                      <span>Duration: {selectedIncident.clips[0].duration_seconds.toFixed(1)}s</span>
                      {selectedIncident.clips[0].key_moment_offset && (
                        <span className="text-amber-400">
                          ⚡ Key moment at {selectedIncident.clips[0].key_moment_offset.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
                    No video clip available
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">AI Analysis</h4>
                  <p className="text-sm">{selectedIncident.ai_description || 'No description'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Detection</h4>
                  <p className="text-sm capitalize">{selectedIncident.incident_type.replace('_', ' ')}</p>
                  <p className={`text-sm font-medium ${severityColor(selectedIncident.severity)}`}>
                    {selectedIncident.severity} severity · {(selectedIncident.ai_confidence * 100).toFixed(0)}% confidence
                  </p>
                </div>
              </div>

              {/* Person info */}
              {selectedIncident.person_id && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">
                      {selectedIncident.person_display_name || 'Unknown Person'}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{selectedIncident.person_status}</p>
                  </div>
                  <Link
                    to={`/person/${selectedIncident.person_id}`}
                    className="ml-auto text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View Profile <ChevronRight className="w-4 h-4 inline" />
                  </Link>
                </div>
              )}

              {/* Review fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Estimated Item Stolen</label>
                  <input
                    type="text"
                    value={estimatedItem}
                    onChange={(e) => setEstimatedItem(e.target.value)}
                    placeholder="e.g., Candy bar, Beer 6-pack"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this incident..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-blue-500"
                  rows={2}
                />
              </div>

              {/* === REVIEW BUTTONS === */}
              {selectedIncident.review_status === 'pending' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleReview('theft')}
                    disabled={reviewLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-base transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    🔴 THEFT
                  </button>
                  <button
                    onClick={() => handleReview('not_theft')}
                    disabled={reviewLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-base transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    ✅ NOT THEFT
                  </button>
                  <button
                    onClick={() => handleReview('unsure')}
                    disabled={reviewLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium text-base transition-colors disabled:opacity-50"
                  >
                    <HelpCircle className="w-5 h-5" />
                    🤷 UNSURE
                  </button>
                </div>
              )}

              {selectedIncident.review_status !== 'pending' && (
                <div className={`p-3 rounded-lg text-center font-medium ${
                  selectedIncident.review_status === 'theft'
                    ? 'bg-red-900/30 text-red-400'
                    : 'bg-green-900/30 text-green-400'
                }`}>
                  Reviewed: {selectedIncident.review_status.replace('_', ' ').toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-20 text-gray-500">
              Select an incident to review
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
