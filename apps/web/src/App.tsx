// موجّه بسيط بالعنوان (#/...) بلا مكتبة: شاشة البداية، الجلسة، لوحة الأب
// قبل عرض أي شاشة تُسوَّى الجلسات المفتوحة (تُغلق المنقطعة وتبقى القابلة للاستئناف)
import { useEffect, useState } from 'react';
import { StartScreen } from './screens/StartScreen';
import { LessonScreen } from './screens/LessonScreen';
import { ParentScreen } from './screens/ParentScreen';
import { reconcileOpenSessions } from './data/repo';

export type Route = { name: 'start' } | { name: 'lesson'; lessonCode: string } | { name: 'parent' };

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'lesson' && parts[1]) return { name: 'lesson', lessonCode: parts[1] };
  if (parts[0] === 'parent') return { name: 'parent' };
  return { name: 'start' };
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    reconcileOpenSessions()
      .catch(() => undefined)
      .finally(() => setReady(true));
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!ready) return <main className="screen screen-center"><p className="subtitle">لحظة…</p></main>;

  switch (route.name) {
    case 'lesson':
      return <LessonScreen key={route.lessonCode} lessonCode={route.lessonCode} />;
    case 'parent':
      return <ParentScreen />;
    default:
      return <StartScreen />;
  }
}
