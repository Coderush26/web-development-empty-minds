'use client';

import { useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';

interface Directive {
  id: string;
  from: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'escalated';
}

interface CaptainDirectiveProps {
  directive: Directive | null;
  onAccept: () => void;
  onEscalate: (message: string) => void;
  onClose: () => void;
}

export function CaptainDirective({
  directive,
  onAccept,
  onEscalate,
  onClose,
}: CaptainDirectiveProps) {
  const [distressMessage, setDistressMessage] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  if (!directive || directive.status !== 'pending') return null;

  const handleEscalate = () => {
    if (distressMessage.trim()) {
      onEscalate(distressMessage);
      setDistressMessage('');
      setIsEscalating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-lg rounded-lg bg-slate-900 border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <h2 className="text-lg font-semibold text-white">Directive from Command</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* From field */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">From</p>
            <p className="text-white">{directive.from}</p>
          </div>

          {/* Directive content */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Directive</p>
            <p className="text-slate-100 leading-relaxed bg-slate-800/50 p-3 rounded">
              {directive.content}
            </p>
          </div>

          {/* Time */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Time</p>
            <p className="text-slate-300">{directive.timestamp.toLocaleString()}</p>
          </div>

          {/* Action buttons */}
          {!isEscalating ? (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onAccept}
                className="flex-1 px-4 py-2 rounded bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30 transition-colors font-medium"
              >
                Accept
              </button>
              <button
                onClick={() => setIsEscalating(true)}
                className="flex-1 px-4 py-2 rounded bg-red-600/20 border border-red-600/50 text-red-400 hover:bg-red-600/30 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Escalate Distress
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="bg-red-900/20 border border-red-700/50 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-semibold text-red-400">Send Distress Message</p>
                </div>
                <textarea
                  value={distressMessage}
                  onChange={(e) => setDistressMessage(e.target.value)}
                  placeholder="Describe the emergency situation..."
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-600 resize-none text-sm"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEscalating(false)}
                  className="flex-1 px-4 py-2 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEscalate}
                  disabled={!distressMessage.trim()}
                  className="flex-1 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Distress
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
