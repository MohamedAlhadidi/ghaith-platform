// لوحة الأب: خلف رمز PIN محلي (منع تغيير عرضي، ليس حماية أمنية)؛ تعرض حالة المهارة بدليلها،
// وما لاحظه الرفيق في كل جلسة، وأنماط الأخطاء مع اقتراح ورقي، والإعدادات والنسخ الاحتياطي
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { db, type ObservationRecord, type SessionRecord } from '../data/db';
import { assessSkillFromDb, describeStorage, exportAll, getMasteryRules, getProfile, getSetting, importAll, listObservations, purgeProgress, saveProfile, setSetting, type ChildProfile, DEFAULT_PROFILE } from '../data/repo';
import { HUNDRED_SQUARE_SKILL, VARIANT_LABELS, type HundredSquareVariant } from '../engine/hundredSquare';
import { SKILL_STATE_LABELS, validateRules, type AttemptEvent, type MasteryRules, type SkillAssessment } from '../engine/mastery';
import { ERROR_TAG_LABELS, ERROR_TAG_MEANING, type ErrorTag } from '../engine/errors';
import { toArabicIndic } from '../engine/answers';
import { describeAudioCapability } from '../audio/audio';
import { LESSON_L1A_01 } from '../content/lessons/L1A-01';
import { progressSinceBaseline } from '../avatar/insights';
import { AVATAR_LOOK_LABELS, type AvatarLook } from '../avatar/GhaithAvatar';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ghaith-pin:' + text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PHASE_AR = { baseline: 'خط أساس', guided: 'توجيه', independent: 'وحدك', check: 'تحقق', review: 'مراجعة' } as const;
const MODE_AR = { numpad: 'كتابة', cell: 'نقر', move: 'حركة' } as const;
const REP_AR = { concrete: 'حركة', pictorial: 'خريطة', abstract: 'بلا لوحة' } as const;
const END_AR: Record<NonNullable<SessionRecord['endReason']>, string> = { completed: 'اكتملت', stopped: 'توقفت', killed: 'انقطعت', abandoned: 'تُركت' };

const ar = toArabicIndic;

export function ParentScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState<SkillAssessment | null>(null);
  const [attempts, setAttempts] = useState<AttemptEvent[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptEvent[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [rules, setRules] = useState<MasteryRules | null>(null);
  const [rulesText, setRulesText] = useState('');
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<ChildProfile>(DEFAULT_PROFILE);
  const [storage, setStorage] = useState('');
  const [lastBackup, setLastBackup] = useState<number | null>(null);

  const load = async () => {
    const [a, list, all, s, r, p, obs, st, lb] = await Promise.all([
      assessSkillFromDb(HUNDRED_SQUARE_SKILL),
      db.attempts.orderBy('clientTs').reverse().limit(40).toArray(),
      db.attempts.toArray(),
      db.sessions.orderBy('startedAt').reverse().limit(20).toArray(),
      getMasteryRules(),
      getProfile(),
      listObservations(6),
      describeStorage(),
      getSetting<number | null>('lastBackupAt', null),
    ]);
    setAssessment(a);
    setAttempts(list);
    setAllAttempts(all);
    setSessions(s);
    setRules(r);
    setRulesText(JSON.stringify(r, null, 2));
    setProfile(p);
    setObservations(obs);
    setStorage(st);
    setLastBackup(lb);
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
        setMessage('الرمز الافتراضي 1234 مفعّل. غيّره من الإعدادات.');
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
    await setSetting('lastBackupAt', Date.now());
    setLastBackup(Date.now());
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importAll(await file.text());
      setMessage(`استُوردت ${ar(r.attempts)} محاولة و${ar(r.sessions)} جلسة.`);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const saveRules = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rulesText);
    } catch {
      setMessage('صيغة JSON غير صالحة.');
      return;
    }
    const v = validateRules(parsed);
    if (!v.ok) {
      setMessage(`القواعد مرفوضة: ${v.errorAr}`);
      return;
    }
    await setSetting('masteryRules', v.rules);
    setMessage('حُفظت قواعد الإتقان.');
    await load();
  };

  const updateProfile = async (patch: Partial<ChildProfile>) => {
    const p = await saveProfile(patch);
    setProfile(p);
    setMessage('حُفظت الإعدادات.');
  };

  if (!unlocked) {
    return (
      <main className="screen screen-center parent">
        <h1 className="title">للكبار</h1>
        <p className="subtitle">أدخل رمز الأب</p>
        <input className="pin-input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void tryUnlock()} autoFocus data-testid="pin" />
        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
        <div className="button-row">
          <button type="button" className="big-button" onClick={() => void tryUnlock()} data-testid="unlock">دخول</button>
          <button type="button" className="big-button secondary" onClick={() => navigate('/')}>رجوع</button>
        </div>
        <p className="note">هذا الرمز يمنع التغيير العرضي فقط؛ ليس حماية أمنية أمام من يسيطر على الجهاز.</p>
      </main>
    );
  }

  // أنماط الأخطاء في آخر 30 يومًا
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  const tagCounts = new Map<ErrorTag, number>();
  for (const a of allAttempts) if (a.clientTs >= since && a.phase !== 'baseline' && a.errorTag !== 'none') tagCounts.set(a.errorTag, (tagCounts.get(a.errorTag) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((x, y) => y[1] - x[1]);
  const progress = progressSinceBaseline(allAttempts);
  const backupStale = lastBackup === null || Date.now() - lastBackup > 7 * 24 * 3600 * 1000;

  return (
    <main className="screen parent">
      <div className="button-row" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="big-button secondary" onClick={() => navigate('/')}>رجوع إلى {profile.name}</button>
      </div>
      <h1 className="title">لوحة الأب</h1>
      {message && <p className="note">{message}</p>}
      {backupStale && allAttempts.length > 0 && <p className="note warn">لم تُؤخذ نسخة احتياطية منذ أسبوع أو أكثر. التقدم محفوظ في متصفح هذا الحساب فقط.</p>}

      <h2>المهارة: {LESSON_L1A_01.titleAr} ({HUNDRED_SQUARE_SKILL})</h2>
      {assessment && (
        <div className="panel" data-testid="assessment">
          <p>
            الحالة: <span className={`state-pill state-${assessment.state}`}>{SKILL_STATE_LABELS[assessment.state]}</span>
          </p>
          <p>السبب: {assessment.reasonAr}</p>
          <p>
            المحتسبة: {ar(assessment.stats.counted)} | نظيفة (من الأولى بلا تلميح): {ar(assessment.stats.cleanCorrect)} | صحيحة في النهاية: {ar(assessment.stats.eventuallyCorrect)} | التمثيلات: {ar(assessment.stats.representations)} | الأيام: {ar(assessment.stats.days)} | خط الأساس: {ar(assessment.stats.baselineCorrect)} من {ar(assessment.stats.baselineAttempts)}
          </p>
          {progress && <p><strong>{progress.textAr}</strong> <span style={{ color: 'var(--muted)' }}>({progress.evidenceAr})</span></p>}
          <p style={{ color: 'var(--muted)' }}>الحالات قرارات تشغيلية قابلة للتعديل في القواعد أدناه، وليست تشخيصًا.</p>
        </div>
      )}

      <h2>ما لاحظه رفيق</h2>
      {observations.length === 0 && <p className="note">لا ملاحظات بعد؛ تظهر بعد أول جلسة.</p>}
      {observations.map((o) => (
        <div className="panel observation" key={o.id}>
          <p className="obs-head">
            جلسة {new Date(o.createdAt).toLocaleString('ar-OM')} — {ar(o.summary.total)} أسئلة، نجوم الجهد {ar(o.summary.total - o.summary.baselineTotal)}
          </p>
          <ul>
            {o.summary.insights.map((i, idx) => (
              <li key={idx}>
                <strong>{i.textAr}</strong> <span style={{ color: 'var(--muted)' }}>({i.evidenceAr})</span>
                {i.paperAr && <div className="paper-tip">على الورق: {i.paperAr}</div>}
              </li>
            ))}
            {o.summary.insights.length === 0 && <li>جلسة قصيرة بلا ملاحظات.</li>}
          </ul>
        </div>
      ))}

      <h2>أنماط الأخطاء (آخر ٣٠ يومًا)</h2>
      {tags.length === 0 ? (
        <p className="note">لا أخطاء مسجّلة.</p>
      ) : (
        <table>
          <thead><tr><th>الخطأ</th><th>مرات</th><th>معناه</th><th>على الورق</th></tr></thead>
          <tbody>
            {tags.map(([tag, count]) => (
              <tr key={tag}>
                <td>{ERROR_TAG_LABELS[tag]}</td>
                <td>{ar(count)}</td>
                <td>{ERROR_TAG_MEANING[tag].meaningAr}</td>
                <td>{ERROR_TAG_MEANING[tag].paperAr}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <td>{s.endReason ? END_AR[s.endReason] : ''}{s.shortened ? ' (مختصرة)' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>آخر المحاولات</h2>
      <table>
        <thead><tr><th>الوقت</th><th>المرحلة</th><th>النوع</th><th>الطريقة</th><th>التمثيل</th><th>الإجابة</th><th>من الأولى</th><th>محاولات</th><th>تلميحات</th><th>الخطأ</th><th>أول فعل</th><th>تردد</th></tr></thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.clientTs).toLocaleTimeString('ar-OM')}</td>
              <td>{PHASE_AR[a.phase]}</td>
              <td>{VARIANT_LABELS[a.variant as HundredSquareVariant] ?? a.variant}</td>
              <td>{MODE_AR[a.inputMode]}</td>
              <td>{REP_AR[a.representation]}</td>
              <td>{ar(a.givenAnswer)}</td>
              <td>{a.firstTryCorrect ? '✓' : a.correct ? 'بعد محاولة' : '✗'}</td>
              <td>{ar(a.attemptsCount)}</td>
              <td>{ar(a.hintsUsed)}{a.hintSuggested ? ' (اقتُرح)' : ''}</td>
              <td>{a.errorTag === 'none' ? '' : ERROR_TAG_LABELS[a.errorTag]}</td>
              <td>{ar(Math.round(a.firstResponseMs / 1000))} ث</td>
              <td>{ar(Math.round(a.hesitationMs / 1000))} ث</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>الإعدادات</h2>
      <div className="panel settings">
        <p>
          اسم الطفل: <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /> <button type="button" onClick={() => void updateProfile({ name: profile.name })}>حفظ</button>
        </p>
        <p>
          شكل الأفاتار:{' '}
          <select value={profile.avatarLook ?? ''} onChange={(e) => void updateProfile({ avatarLook: (e.target.value || null) as AvatarLook | null })}>
            <option value="">يختاره الطفل عند البداية</option>
            {(Object.keys(AVATAR_LOOK_LABELS) as AvatarLook[]).map((l) => <option key={l} value={l}>{AVATAR_LOOK_LABELS[l]}</option>)}
          </select>
        </p>
        <p>
          مدة الجلسة (دقائق، بلا مؤقت ظاهر للطفل):{' '}
          <input type="number" min={6} max={25} value={profile.sessionMinutes} onChange={(e) => void updateProfile({ sessionMinutes: Math.min(25, Math.max(6, Number(e.target.value) || 12)) })} />
        </p>
        <p>
          <label>
            <input type="checkbox" checked={profile.voiceEnabled} onChange={(e) => void updateProfile({ voiceEnabled: e.target.checked })} /> صوت المتصفح المحلي للرفيق (النص يبقى دائمًا)
          </label>
        </p>
        <p>
          رمز جديد: <input id="newPin" type="password" inputMode="numeric" /> <button type="button" onClick={() => void changePin((document.getElementById('newPin') as HTMLInputElement).value)}>تغيير الرمز</button>
        </p>
        <p>الصوت: {describeAudioCapability()}</p>
        <p>التخزين: {storage}</p>
      </div>

      <h2>قواعد الإتقان (JSON)</h2>
      <div className="panel">
        <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={12} style={{ width: '100%', fontFamily: 'monospace', direction: 'ltr' }} />
        <div className="button-row" style={{ justifyContent: 'flex-start' }}>
          <button type="button" onClick={() => void saveRules()}>حفظ القواعد</button>
          {rules && <span style={{ color: 'var(--muted)' }}>الإصدار الحالي {ar(rules.version)}</span>}
        </div>
      </div>

      <h2>النسخ الاحتياطي</h2>
      <div className="panel button-row" style={{ justifyContent: 'flex-start' }}>
        <button type="button" onClick={() => void download()}>تنزيل نسخة احتياطية</button>
        <span style={{ color: 'var(--muted)' }}>{lastBackup ? `آخر نسخة: ${new Date(lastBackup).toLocaleDateString('ar-OM')}` : 'لم تُؤخذ نسخة بعد'}</span>
        <label>
          استيراد: <input type="file" accept="application/json" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
        <button type="button" style={{ color: 'var(--error)' }} onClick={() => { if (window.confirm(`هل تريد مسح كل تقدم ${profile.name} على هذا الجهاز؟ خذ نسخة احتياطية أولًا.`)) void purgeProgress().then(load); }}>
          مسح التقدم
        </button>
      </div>
    </main>
  );
}
