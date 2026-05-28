'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  url: string
  mime: string
  filename: string
}

export default function VideoThumbnail({ url, mime, filename }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        if (canvasRef.current) {
          canvasRef.current.width = video.videoWidth || 160;
          canvasRef.current.height = video.videoHeight || 120;
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
            setLoaded(true);
          }
        }
      } catch(e) {}
      video.remove();
    };

    video.onerror = () => { video.remove(); };

    return () => { video.remove(); };
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
      {loaded ? (
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', display: 'flex', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>{filename}</div>
    </div>
  );
}
