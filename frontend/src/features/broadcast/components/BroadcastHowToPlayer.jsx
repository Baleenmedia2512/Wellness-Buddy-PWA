import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { BROADCAST_HOWTO_SCENES } from '../domain/broadcast.rules';

const SCENE_MS = 4500;

/**
 * In-app how-to for BroadCast. Plays the use steps in a video frame
 * until a recorded file is supplied.
 */
export default function BroadcastHowToPlayer() {
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const scene = BROADCAST_HOWTO_SCENES[index];
  const step = index + 1;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      setIndex((current) => (current + 1) % BROADCAST_HOWTO_SCENES.length);
    }, SCENE_MS);
    return () => clearTimeout(timer);
  }, [playing, index]);

  const toggle = () => setPlaying((current) => !current);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-sm">
      <div
        className="relative aspect-video"
        role="region"
        aria-label="How to use BroadCast"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-gray-900 to-teal-950" />
        <div className="relative flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
            <span>How to use BroadCast</span>
            <span>
              {step}
              {' / '}
              {BROADCAST_HOWTO_SCENES.length}
            </span>
          </div>

          <div className="pr-10">
            <p className="text-[11px] font-semibold text-emerald-300">
              Step
              {' '}
              {step}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-white">{scene.title}</h2>
            <p className="mt-1.5 text-sm leading-snug text-gray-200">{scene.caption}</p>
          </div>

          <div className="flex gap-1" aria-hidden>
            {BROADCAST_HOWTO_SCENES.map((item, itemIndex) => (
              <span
                key={item.id}
                className={`h-1 flex-1 rounded-full ${
                  itemIndex <= index ? 'bg-emerald-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-md"
          aria-label={playing ? 'Pause how-to video' : 'Play how-to video'}
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
