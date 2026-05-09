'use client';

import { useState, useEffect } from 'react';
import { Pause, Play } from 'lucide-react';

interface TimelineScrubberProps {
  currentTime: Date;
  onTimeChange: (time: Date) => void;
  enabled?: boolean;
}

export function TimelineScrubber({ currentTime, onTimeChange, enabled = false }: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const maxSeconds = 0;
  const minSeconds = -3600;
  const step = 30;
  const now = new Date();
  const offsetSeconds = Math.round((currentTime.getTime() - now.getTime()) / 1000);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const interval = window.setInterval(() => {
      const nextTime = new Date(Math.min(Date.now(), currentTime.getTime() + step * 1000));
      onTimeChange(nextTime);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentTime, isPlaying, onTimeChange]);

  if (!enabled) return null;

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(event.target.value);
    const newTime = new Date(now.getTime() + seconds * 1000);
    onTimeChange(newTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/90 text-slate-100 transition hover:bg-slate-700"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          <div className="flex-1">
            <input
              type="range"
              min={minSeconds}
              max={maxSeconds}
              step={step}
              value={Math.max(minSeconds, Math.min(maxSeconds, offsetSeconds))}
              onChange={handleSliderChange}
              className="w-full cursor-pointer appearance-none rounded-full bg-slate-800 h-2 accent-sky-400"
            />
          </div>

          <div className="text-right text-xs text-slate-300">
            <div>Now: {formatTime(now)}</div>
            <div>Current: {formatTime(currentTime)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
