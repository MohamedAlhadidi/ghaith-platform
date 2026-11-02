// موجّه بسيط بالعنوان (#/...) بلا مكتبة: شاشة البداية، الدرس، لوحة الأب
import { useEffect, useState } from 'react';
import { StartScreen } from './screens/StartScreen';
import { LessonScreen } from './screens/LessonScreen';
import { ParentScreen } from './screens/ParentScreen';
import { closeOrphanSessions } from './data/repo';

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

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    // جلسات لم تُغلق (مثلًا انتهى وقت الشاشة فجأة) تُغلق هنا بسبب "killed"
    closeOrphanSessions().catch(() => undefined);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  switch (route.name) {
    case 'lesson':
      return <LessonScreen lessonCode={route.lessonCode} />;
    case 'parent':
      return <ParentScreen />;
    default:
      return <StartScreen />;
  }
}
