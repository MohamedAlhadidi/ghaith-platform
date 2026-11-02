// لوحة الأب: خلف رمز PIN محلي (منع تغيير عرضي، ليس حماية أمنية)، تعرض حالة المهارة بدليلها وتصدّر البيانات
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { db } from '../data/db';
import { assessSkillFromDb, exportAll, getMasteryRules, getSetting, importAll, purgeProgress, setSetting } from '../data/repo';
import { HUNDRED_SQUARE_SKILL, describeMatcher } from '../engine/hundredSquare';
import { SKILL_STATE_LABELS, type AttemptEvent, type MasteryRules, type SkillAssessment } from '../engine/mastery';
import { toArabicIndic } from '../engine/answers';
import { describeAudioCapability } from '../audio/audio';
import { LESSON_L1A_01 } from '../content/lessons/L1A-01';
import type { SessionRecord } from '../data/db';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ghaith-pin:' + text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PHASE_AR = { guided: 'توجيه', independent: 'مستقل', check: 'تحقق', review: 'مراجعة' } as const;

export function ParentScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState<SkillAssessment | null>(null);
  const [attempts, setAttempts] = useState<AttemptEvent[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [rules, setRules] = useState<MasteryRules | null>(null);
  const [rulesText, setRulesText] = useState('');
  const [message, setMessage] = useState('');
  const [childName, setChildName] = useState('غيث');

  const load = async () => {
    const [a, list, s, r, name] = await Promise.all([
      assessSkillFromDb(HUNDRED_SQUARE_SKILL),
      db.attempts.orderBy('clientTs').reverse().limit(40).toArray(),
      db.sessions.orderBy('startedAt').reverse().limit(20).toArray(),
      getMasteryRules(),
      getSetting<string>('childName', 'غيث'),
    ]);
    setAssessment(a);
    setAttempts(list);
    setSessions(s);
    setRules(r);
    setRulesText(JSON.stringify(r, null, 2));
    setChildName(name);
  };

  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked]);

  const tryUnlock = async () => {
    const stored = await getSetting<string | null>('parentPinHash', null);
    const hash = await sha256(pin);
    if (stored === null) {
      // أول استخدام: الرمز الافتراضي 1234 يُثبَّت ويُنصح بتغييره
      if (pin === '1234') {
        await setSetting('parentPinHash', hash);
        setUnlocked(true);
        setMessage('الرمز الافتراضي 1234 مفعّل. غيّره من الأسفل.');
      } else setError('الرمز الافتراضي هو 1234 في أول استخدام.');
      return;
    }
    if (stored === hash) setUnlocked(true);
    else setError('رمز غير صحيح.');
  };

  const changePin = async (newPin: string) => {
    if (!/^\d{4,6}$/.test(newPin)) {
      setMessage('الرمز من 4 إلى 6 أرقام.');
      return;
    }
    await setSetting('parentPinHash', await sha256(newPin));
    setMessage('تم تغيير الرمز.');
  };

  const download = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ghaith-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importAll(await file.text());
      setMessage(`استُوردت ${toArabicIndic(r.attempts)} محاولة و${toArabicIndic(r.sessions)} جلسة.`);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const saveRules = async () => {
    try {
      const parsed = JSON.parse(rulesText) as MasteryRules;
      await setSetting('masteryRules', parsed);
      setMessage('حُفظت قواعد الإتقان.');
      await load();
    } catch {
      setMessage('صيغة JSON غير صالحة.');
    }
  };

  if (!unlocked) {
    return (
      <main className="screen screen-center parent">
        <h1 className="title">للكبار</h1>
        <p className="subtitle">أدخل رمز الأب</p>
        <input className="pin-input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void tryUnlock()} autoFocus />
        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
        <div className="button-row">
          <button type="button" className="big-button" onClick={() => void tryUnlock()}>دخول</button>
          <button type="button" className="big-button secondary" onClick={() => navigate('/')}>رجوع</button>
        </div>
        <p className="note">هذا الرمز يمنع التغيير العرضي فقط؛ ليس حماية أمنية أمام من يسيطر على الجهاز.</p>
      </main>
    );
  }

  return (
    <main className="screen parent">
      <div className="button-row" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="big-button secondary" onClick={() => navigate('/')}>رجوع إلى غيث</button>
      </div>
      <h1 className="title">لوحة الأب</h1>
      {message && <p className="note">{message}</p>}

      <h2>المهارة: {LESSON_L1A_01.titleAr} ({HUNDRED_SQUARE_SKILL})</h2>
      {assessment && (
        <div className="panel">
          <p>
            الحالة: <span className={`state-pill state-${assessment.state}`}>{SKILL_STATE_LABELS[assessment.state]}</span>
          </p>
          <p>السبب: {assessment.reasonAr}</p>
          <p>
            المحاولات المحتسبة: {toArabicIndic(assessment.stats.counted)} | صحيحة من الأولى: {toArabicIndic(assessment.stats.firstTryCorrect)} | التلميحات: {toArabicIndic(assessment.stats.hintsTotal)} | التمثيلات: {toArabicIndic(assessment.stats.representations)} | الجلسات: {toArabicIndic(assessment.stats.sessions)}
          </p>
          <p style={{ color: 'var(--muted)' }}>الحالات قرارات تشغيلية قابلة للتعديل في القواعد أدناه، وليست تشخيصًا.</p>
        </div>
      )}

      <h2>الجلسات الأخيرة</h2>
      <table>
        <thead><tr><th>البداية</th><th>الدرس</th><th>النهاية</th><th>السبب</th></tr></thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.startedAt).toLocaleString('ar-OM')}</td>
              <td>{s.lessonCode}</td>
              <td>{s.endedAt ? new Date(s.endedAt).toLocaleTimeString('ar-OM') : 'مفتوحة'}</td>
              <td>{s.endReason === 'completed' ? 'اكتملت' : s.endReason === 'killed' ? 'انقطعت' : s.endReason === 'abandoned' ? 'تُركت' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>آخر المحاولات (رصدها التطبيق)</h2>
      <table>
        <thead><tr><th>الوقت</th><th>المرحلة</th><th>النوع</th><th>التمثيل</th><th>الإجابة</th><th>من الأولى</th><th>محاولات</th><th>تلميحات</th><th>ثوانٍ</th></tr></thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.clientTs).toLocaleTimeString('ar-OM')}</td>
              <td>{PHASE_AR[a.phase]}</td>
              <td>{a.variant}</td>
              <td>{a.representation === 'pictorial' ? 'صوري' : a.representation === 'abstract' ? 'مجرد' : 'محسوس'}</td>
              <td>{toArabicIndic(a.givenAnswer)}</td>
              <td>{a.firstTryCorrect ? '✓' : '✗'}</td>
              <td>{toArabicIndic(a.attemptsCount)}</td>
              <td>{toArabicIndic(a.hintsUsed)}</td>
              <td>{toArabicIndic(Math.round(a.responseMs / 1000))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>الإعدادات</h2>
      <div className="panel">
        <p>
          اسم الطفل: <input value={childName} onChange={(e) => setChildName(e.target.value)} /> <button type="button" onClick={() => void setSetting('childName', childName).then(() => setMessage('حُفظ الاسم.'))}>حفظ</button>
        </p>
        <p>
          رمز جديد: <input id="newPin" type="password" inputMode="numeric" /> <button type="button" onClick={() => void changePin((document.getElementById('newPin') as HTMLInputElement).value)}>تغيير الرمز</button>
        </p>
        <p>الصوت: {describeAudioCapability()}</p>
        <p>مثال على مطابقة مفتوحة: {describeMatcher({ kind: 'set', values: [31, 32, 33] })}</p>
      </div>

      <h2>قواعد الإتقان (JSON)</h2>
      <div className="panel">
        <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={12} style={{ width: '100%', fontFamily: 'monospace', direction: 'ltr' }} />
        <div className="button-row" style={{ justifyContent: 'flex-start' }}>
          <button type="button" onClick={() => void saveRules()}>حفظ القواعد</button>
          {rules && <span style={{ color: 'var(--muted)' }}>الإصدار الحالي {toArabicIndic(rules.version)}</span>}
        </div>
      </div>

      <h2>النسخ الاحتياطي</h2>
      <div className="panel button-row" style={{ justifyContent: 'flex-start' }}>
        <button type="button" onClick={() => void download()}>تنزيل نسخة احتياطية</button>
        <label>
          استيراد: <input type="file" accept="application/json" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
        <button type="button" style={{ color: 'var(--error)' }} onClick={() => { if (window.confirm('هل تريد مسح كل تقدم غيث على هذا الجهاز؟ خذ نسخة احتياطية أولًا.')) void purgeProgress().then(load); }}>
          مسح التقدم
        </button>
      </div>
    </main>
  );
}
