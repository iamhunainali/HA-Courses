import { token } from '../api';
import VideoPlayer from './VideoPlayer';

// YouTube / Vimeo / Google Drive link embed hota hai, direct mp4 link apne player mein chalta hai
export function embedOf(url: string): { kind: 'iframe' | 'file'; src: string } {
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1` };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
  m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return { kind: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` };
  return { kind: 'file', src: url };
}

export default function LectureVideo({ lesson }: { lesson: any }) {
  if (lesson.videoUrl) {
    const e = embedOf(lesson.videoUrl);
    if (e.kind === 'iframe')
      return <div className="player"><iframe src={e.src} title={lesson.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>;
    return <VideoPlayer src={e.src} />;
  }
  return <VideoPlayer src={`/api/stream/${lesson.id}?token=${token()}`} />;
}
