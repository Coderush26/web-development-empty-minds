'use client';

import { AlertTriangle, Heart, Wrench, Shield } from 'lucide-react';

interface AiAnalysis {
  severity: string;
  issueType: string;
  injuryCount?: number | null;
  damageEstimate?: string | null;
  recommendedAction: string;
  summary: string;
}

interface AiAnalysisCardProps {
  analysis: AiAnalysis;
}

export function AiAnalysisCard({ analysis }: AiAnalysisCardProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴' };
      case 'high':
        return { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-400', icon: '🟠' };
      case 'medium':
        return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: '🟡' };
      default:
        return { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-400', icon: '🔵' };
    }
  };

  const styles = getSeverityStyles(analysis.severity);

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <Shield className={`w-4 h-4 ${styles.text}`} />
        <h4 className={`text-sm font-bold ${styles.text} uppercase tracking-wider`}>
          AI Analysis
        </h4>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles.bg} ${styles.text} border ${styles.border}`}>
          {analysis.severity}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-slate-400 text-xs font-semibold uppercase">Issue Type</span>
          <p className="text-white font-semibold flex items-center gap-2 mt-0.5">
            <Wrench className="w-3.5 h-3.5 text-slate-400" />
            {analysis.issueType}
          </p>
        </div>

        <div>
          <span className="text-slate-400 text-xs font-semibold uppercase">Summary</span>
          <p className="text-slate-200 mt-0.5">{analysis.summary}</p>
        </div>

        {analysis.injuryCount != null && analysis.injuryCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-red-300 font-semibold text-xs">
              {analysis.injuryCount} {analysis.injuryCount === 1 ? 'injury' : 'injuries'} reported
            </span>
          </div>
        )}

        {analysis.damageEstimate && (
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase">Damage Estimate</span>
            <p className="text-orange-300 font-semibold mt-0.5">{analysis.damageEstimate}</p>
          </div>
        )}

        <div className={`px-3 py-2 rounded-lg ${styles.bg} border ${styles.border}`}>
          <span className="text-slate-400 text-xs font-semibold uppercase block mb-1">
            Recommended Action
          </span>
          <p className={`${styles.text} font-semibold text-xs`}>
            {analysis.recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
}
