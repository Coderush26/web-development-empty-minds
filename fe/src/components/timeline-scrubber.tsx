'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface TimelineScrubberProps {
  currentTime: Date;
  onTimeChange: (time: Date) => void;
  minTime?: Date;
  maxTime?: Date;
  enabled?: boolean;
}

export function TimelineScrubber({
  currentTime,
  onTimeChange,
  minTime = new Date(Date.now() - 3600000), // 1 hour ago
  maxTime = new Date(),
  enabled = false,
}: TimelineScrubberProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  const totalDuration = maxTime.getTime() - minTime.getTime();
  const currentPosition = currentTime.getTime() - minTime.getTime();
  const percentage = (currentPosition / totalDuration) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercentage = parseFloat(e.target.value);
    const newTime = new Date(minTime.getTime() + (newPercentage / 100) * totalDuration);
    onTimeChange(newTime);
  };

  const handleReset = () => {
    onTimeChange(maxTime);
  };

  const handleStepBack = () => {
    const newTime = new Date(Math.max(minTime.getTime(), currentTime.getTime() - 60000));
    onTimeChange(newTime);
  };

  const handleStepForward = () => {
    const newTime = new Date(Math.min(maxTime.getTime(), currentTime.getTime() + 60000));
    onTimeChange(newTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="absolute bottom-24 left-72 right-0 z-30">
      <div className="mx-6 px-4 py-3 rounded-lg bg-slate-900/95 backdrop-blur border border-slate-700">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Fleet Timeline</h3>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              {isOpen ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Timeline content */}
          {isOpen && (
            <div className="space-y-3">
              {/* Time display */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{formatTime(minTime)}</span>
                <span className="text-white font-medium">{formatTime(currentTime)}</span>
                <span className="text-slate-400">{formatTime(maxTime)}</span>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStepBack}
                  className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                  title="Step back 1 minute"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={handleSliderChange}
                  className="flex-1 h-2 rounded-lg bg-slate-800 cursor-pointer accent-blue-500"
                />

                <button
                  onClick={handleStepForward}
                  className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                  title="Step forward 1 minute"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleReset}
                  className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                  title="Return to current time"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Info text */}
              <p className="text-xs text-slate-400">
                Drag the slider to review fleet positions at different times
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
