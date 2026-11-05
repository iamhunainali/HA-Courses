import { useEffect, useRef, useState } from 'react';

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function VideoPlayer({ src }: { src: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [vol, setVol] = useState(1);
  const [rate, setRate] = useState(1);
  const [show, setShow] = useState(true);
  const hide = useRef<any>();

  const toggle = () => { const e = v.current!; e.paused ? e.play() : e.pause(); };
  const seek = (n: number) => { v.current!.currentTime = Math.max(0, Math.min(d, n)); };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : box.current!.requestFullscreen());
  const wake = () => { setShow(true); clearTimeout(hide.current); hide.current = setTimeout(() => setShow(false), 2500); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as any).tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') seek(v.current!.currentTime + 10);
      if (e.code === 'ArrowLeft') seek(v.current!.currentTime - 10);
      if (e.key === 'f') full();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="player" ref={box} onMouseMove={wake} onMouseLeave={() => playing && setShow(false)}>
      <video
        ref={v} src={src} autoPlay onClick={toggle} controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
        onPlay={() => { setPlaying(true); wake(); }} onPause={() => { setPlaying(false); setShow(true); }}
        onTimeUpdate={() => setT(v.current!.currentTime)} onLoadedMetadata={() => setD(v.current!.duration)}
      />
      {!playing && <button className="bigplay" onClick={toggle} aria-label="Play">▶</button>}
      <div className={'pc' + (show ? '' : ' hid')}>
        <input type="range" className="seek" min={0} max={d || 0} step={0.1} value={t} onChange={(e) => seek(+e.target.value)}
          style={{ ['--p' as any]: d ? (t / d) * 100 + '%' : '0%' }} />
        <div className="row">
          <button onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
          <button onClick={() => seek(t - 10)} title="Back 10s">⟲ 10</button>
          <button onClick={() => seek(t + 10)} title="Forward 10s">10 ⟳</button>
          <span className="time">{fmt(t)} / {fmt(d)}</span>
          <span className="sp" />
          <span title="Volume">🔊</span>
          <input type="range" className="vol" min={0} max={1} step={0.05} value={vol}
            onChange={(e) => { setVol(+e.target.value); v.current!.volume = +e.target.value; }} />
          <select value={rate} onChange={(e) => { setRate(+e.target.value); v.current!.playbackRate = +e.target.value; }}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}x</option>)}
          </select>
          <button onClick={full} title="Fullscreen">⛶</button>
        </div>
      </div>
    </div>
  );
}
