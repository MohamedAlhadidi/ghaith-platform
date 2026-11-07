// مراجعة الصوت في لوحة الأب: كل المقاطع المسجّلة بزر تشغيل وحالة "مراجَع"، حتى يسمع الأب النطق قبل غيث
import { useEffect, useMemo, useState } from 'react';
import { allLines, totalChars, type AudioLine, type LineGroup } from '../audio/lines';
import { clipCount, hasClip, say } from '../audio/audio';
import { getSetting, setSetting } from '../data/repo';
import { toArabicIndic } from '../engine/answers';

const GROUP_AR: Record<LineGroup, string> = { companion: 'جمل الرفيق', model: 'شاشات الشرح', phrase: 'مقاطع الأسئلة والتلميحات', feedback: 'التغذية الراجعة', number: 'الأعداد', ui: 'الواجهة' };

export function AudioReview({ childName }: { childName: string }) {
  const lines = useMemo(() => allLines(childName), [childName]);
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [group, setGroup] = useState<LineGroup>('companion');
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const have = new Set<string>();
      for (const l of lines) if (await hasClip(l.id)) have.add(l.id);
      setAvailable(have);
      setCount(await clipCount());
      setReviewed(new Set(await getSetting<string[]>('audioReviewed', [])));
    })();
  }, [lines]);

  const toggle = async (id: string) => {
    const next = new Set(reviewed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setReviewed(next);
    await setSetting('audioReviewed', [...next]);
  };

  const shown = lines.filter((l) => l.group === group);
  const missing = lines.filter((l) => !available.has(l.id)).length;
  return (
    <div className="panel">
      <p>
        المقاطع: {toArabicIndic(lines.length)} ({toArabicIndic(totalChars(lines))} حرفًا) | المسجّلة: {toArabicIndic(count)} | الناقصة: {toArabicIndic(missing)} | المراجَعة: {toArabicIndic(reviewed.size)}
      </p>
      {missing === lines.length && <p className="note warn">لا ملفات مسجّلة بعد. شغّل أداة التوليد: <code>npx tsx tools/audio/generate.ts</code> بعد وضع مفتاح Azure في <code>tools/audio/.env</code>.</p>}
      <div className="button-row" style={{ justifyContent: 'flex-start' }}>
        {(Object.keys(GROUP_AR) as LineGroup[]).map((g) => (
          <button type="button" key={g} onClick={() => setGroup(g)} style={{ opacity: g === group ? 1 : 0.6 }}>
            {GROUP_AR[g]} ({toArabicIndic(lines.filter((l) => l.group === g).length)})
          </button>
        ))}
      </div>
      <table>
        <thead><tr><th>المعرّف</th><th>النص</th><th>الملف</th><th>تشغيل</th><th>مراجَع</th></tr></thead>
        <tbody>
          {shown.map((l: AudioLine) => (
            <tr key={l.id}>
              <td style={{ direction: 'ltr', textAlign: 'left', fontFamily: 'monospace', fontSize: 14 }}>{l.id}</td>
              <td>{l.textAr}</td>
              <td>{available.has(l.id) ? '✓' : '—'}</td>
              <td><button type="button" onClick={() => void say(l.textAr, l.id)}>🔊</button></td>
              <td><input type="checkbox" checked={reviewed.has(l.id)} onChange={() => void toggle(l.id)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
