// عمليات الوصول للبيانات المحلية؛ لا تعديل على الأحداث بعد كتابتها
import { ulid } from 'ulid';
import {
  db,
  DEFAULT_CHILD_ID,
  type HelpEventRecord,
  type ObservationRecord,
  type ResumeState,
  type SessionEventRecord,
  type SessionRecord,
  type SettingRecord,
} from './db';
import { assessSkill, DEFAULT_MASTERY_RULES, localDayOf, validateRules, type AttemptEvent, type MasteryRules, type SkillAssessment } from '../engine/mastery';
import type { SessionSummary } from '../avatar/insights';
import { computeReadiness } from '../engine/readiness';
import type { Readiness } from '../engine/hundredSquare';

/** ملف الطفل: ما يضبطه الأب من لوحته */
export interface ChildProfile {
  name: string;
  /** شكل الأفاتار الذي اختاره الطفل */
  avatarLook: 'explorer' | 'sailor' | 'astronaut' | null;
  /** مدة الجلسة بالدقائق (بلا مؤقت ظاهر للطفل) */
  sessionMinutes: number;
  /** صوت المتصفح المحلي للرفيق */
  voiceEnabled: boolean;
}

export const DEFAULT_PROFILE: ChildProfile = { name: 'غيث', avatarLook: null, sessionMinutes: 12, voiceEnabled: true };

export async function startSession(lessonCode: string, childId = DEFAULT_CHILD_ID): Promise<SessionRecord> {
  const now = Date.now();
  const record: SessionRecord = { id: ulid(), childId, lessonCode, startedAt: now, heartbeatAt: now, synced: 0 };
  await db.sessions.add(record);
  return record;
}

export async function heartbeat(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { heartbeatAt: Date.now() });
}

export async function endSession(sessionId: string, reason: SessionRecord['endReason'], shortened = false): Promise<void> {
  await db.sessions.update(sessionId, { endedAt: Date.now(), endReason: reason, shortened });
  await db.resume.delete('current');
}

/** المدة التي تبقى بعدها الجلسة المنقطعة قابلة للاستئناف */
export const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * عند الإقلاع: الجلسات المفتوحة تُغلق بسبب "killed"، إلا جلسة واحدة لها حالة استئناف حديثة فتبقى لتُستأنف.
 * يعيد حالة الاستئناف الصالحة إن وُجدت.
 */
export async function reconcileOpenSessions(): Promise<ResumeState | undefined> {
  const resume = await db.resume.get('current');
  const resumable = resume && Date.now() - resume.savedAt <= RESUME_WINDOW_MS ? resume : undefined;
  if (resume && !resumable) await db.resume.delete('current');
  const open = await db.sessions.filter((s) => s.endedAt === undefined).toArray();
  for (const s of open) {
    if (resumable && s.id === resumable.sessionId) continue;
    await db.sessions.update(s.id, { endedAt: s.heartbeatAt, endReason: 'killed' });
  }
  if (resumable) {
    const s = await db.sessions.get(resumable.sessionId);
    if (!s || s.endedAt !== undefined) {
      await db.resume.delete('current');
      return undefined;
    }
  }
  return resumable;
}

export async function recordAttempt(event: Omit<AttemptEvent, 'id' | 'clientTs' | 'synced' | 'localDay'>): Promise<AttemptEvent> {
  const now = Date.now();
  const full: AttemptEvent = { ...event, id: ulid(), clientTs: now, localDay: localDayOf(now), synced: 0 };
  await db.attempts.add(full);
  return full;
}

export async function recordHelp(attemptId: string, kind: HelpEventRecord['kind'], level: number): Promise<void> {
  await db.helpEvents.add({ id: ulid(), attemptId, kind, level, clientTs: Date.now(), synced: 0 });
}

export async function recordSessionEvent(sessionId: string, kind: SessionEventRecord['kind'], detailAr?: string): Promise<void> {
  await db.sessionEvents.add({ id: ulid(), sessionId, kind, detailAr, clientTs: Date.now(), synced: 0 });
}

export async function saveResume(state: Omit<ResumeState, 'key' | 'savedAt'>): Promise<void> {
  await db.resume.put({ key: 'current', savedAt: Date.now(), ...state });
}

export async function loadResume(): Promise<ResumeState | undefined> {
  return db.resume.get('current');
}

export async function clearResume(): Promise<void> {
  await db.resume.delete('current');
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const row: SettingRecord = { key, value, updatedAt: Date.now() };
  await db.settings.put(row);
}

export async function getProfile(): Promise<ChildProfile> {
  const stored = await getSetting<Partial<ChildProfile>>('childProfile', {});
  // الاسم القديم كان مفتاحًا منفصلًا
  const legacyName = await getSetting<string | null>('childName', null);
  return { ...DEFAULT_PROFILE, ...(legacyName ? { name: legacyName } : {}), ...stored };
}

export async function saveProfile(patch: Partial<ChildProfile>): Promise<ChildProfile> {
  const current = await getProfile();
  const next = { ...current, ...patch };
  await setSetting('childProfile', next);
  return next;
}

/** القواعد المحفوظة إن كانت صالحة، وإلا الافتراضية */
export async function getMasteryRules(): Promise<MasteryRules> {
  const stored = await getSetting<unknown>('masteryRules', null);
  const v = validateRules(stored);
  return v.ok ? v.rules : DEFAULT_MASTERY_RULES;
}

export async function attemptsForSkill(skillCode: string, childId = DEFAULT_CHILD_ID): Promise<AttemptEvent[]> {
  return db.attempts.where('[childId+skillCode]').equals([childId, skillCode]).toArray();
}

export async function attemptsForSession(sessionId: string): Promise<AttemptEvent[]> {
  return db.attempts.where('sessionId').equals(sessionId).toArray();
}

export async function assessSkillFromDb(skillCode: string, childId = DEFAULT_CHILD_ID): Promise<SkillAssessment> {
  const [events, rules] = await Promise.all([attemptsForSkill(skillCode, childId), getMasteryRules()]);
  return assessSkill(skillCode, events, rules);
}

/** مستوى الجاهزية الحالي لكل نوع مُقيَّد من تاريخ محاولات المهارة */
export async function readinessFromDb(skillCode: string, childId = DEFAULT_CHILD_ID): Promise<Readiness> {
  return computeReadiness(await attemptsForSkill(skillCode, childId));
}

/** هل لهذه المهارة خط أساس مسجّل (لتقرير ما إذا كانت الجلسة تبدأ به) */
export async function hasBaseline(skillCode: string, childId = DEFAULT_CHILD_ID): Promise<boolean> {
  const events = await attemptsForSkill(skillCode, childId);
  return events.some((e) => e.phase === 'baseline');
}

/** عدد الجلسات المكتملة منذ آخر خط أساس (يُعاد خط الأساس كل خمس جلسات) */
export async function sessionsSinceBaseline(skillCode: string, childId = DEFAULT_CHILD_ID): Promise<number> {
  const events = await attemptsForSkill(skillCode, childId);
  const lastBaseline = events.filter((e) => e.phase === 'baseline').reduce((m, e) => Math.max(m, e.clientTs), 0);
  const sessions = await db.sessions.where('childId').equals(childId).toArray();
  return sessions.filter((s) => s.endReason === 'completed' && s.startedAt > lastBaseline).length;
}

/** النجوم للجهد: كل سؤال أكمله (عدا خط الأساس) نجمة، وكل جلسة مكتملة ثلاث نجوم؛ لا نجوم للسرعة */
export async function countStars(childId = DEFAULT_CHILD_ID): Promise<number> {
  const attempts = await db.attempts.where('[childId+skillCode]').between([childId, ''], [childId, '￿']).toArray();
  const sessions = await db.sessions.where('childId').equals(childId).toArray();
  const fromAttempts = attempts.filter((a) => a.phase !== 'baseline' && a.source === 'app').length;
  const fromSessions = sessions.filter((s) => s.endReason === 'completed').length * 3;
  return fromAttempts + fromSessions;
}

export async function saveObservation(sessionId: string, summary: SessionSummary, childId = DEFAULT_CHILD_ID): Promise<void> {
  const record: ObservationRecord = { id: ulid(), sessionId, childId, createdAt: Date.now(), summary, synced: 0 };
  await db.observations.add(record);
}

export async function listObservations(limit = 10): Promise<ObservationRecord[]> {
  return db.observations.orderBy('createdAt').reverse().limit(limit).toArray();
}

/** تصدير كل البيانات المحلية كنسخة احتياطية */
export async function exportAll(): Promise<string> {
  const [attempts, sessions, helpEvents, sessionEvents, observations, settings] = await Promise.all([
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.helpEvents.toArray(),
    db.sessionEvents.toArray(),
    db.observations.toArray(),
    db.settings.toArray(),
  ]);
  return JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), attempts, sessions, helpEvents, sessionEvents, observations, settings }, null, 2);
}

function isRecordArray(v: unknown): v is Array<Record<string, unknown>> {
  return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string');
}

/** استيراد نسخة احتياطية: الأحداث تُدمج بالمعرّف (لا تكرار)، والإعدادات تُستبدل؛ يُرفض أي شكل غير متوقع */
export async function importAll(json: string): Promise<{ attempts: number; sessions: number }> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('الملف ليس JSON صالحًا.');
  }
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2) throw new Error('إصدار النسخة غير مدعوم.');
  if (!isRecordArray(data.attempts) || !isRecordArray(data.sessions)) throw new Error('ملف نسخة احتياطية غير صالح.');
  const attempts = data.attempts as unknown as AttemptEvent[];
  for (const a of attempts) {
    if (typeof a.sessionId !== 'string' || typeof a.skillCode !== 'string' || typeof a.clientTs !== 'number') throw new Error('محاولة غير صالحة في الملف.');
    // نسخة الإصدار 1: نكمل الحقول الناقصة بالقواعد نفسها المستخدمة في ترحيل القاعدة
    a.correct ??= a.firstTryCorrect || a.attemptsCount < 3;
    a.errorTag ??= a.firstTryCorrect ? 'none' : 'other';
    a.inputMode ??= 'numpad';
    a.firstResponseMs ??= a.responseMs;
    a.hesitationMs ??= 0;
    a.audioReplays ??= 0;
    a.hintSuggested ??= false;
    a.localDay ??= localDayOf(a.clientTs);
  }
  const sessions = data.sessions as unknown as SessionRecord[];
  const helpEvents = isRecordArray(data.helpEvents) ? (data.helpEvents as unknown as HelpEventRecord[]) : [];
  const sessionEvents = isRecordArray(data.sessionEvents) ? (data.sessionEvents as unknown as SessionEventRecord[]) : [];
  const observations = isRecordArray(data.observations) ? (data.observations as unknown as ObservationRecord[]) : [];
  const settings = Array.isArray(data.settings) ? (data.settings as SettingRecord[]).filter((s) => typeof s.key === 'string') : [];
  await db.transaction('rw', [db.attempts, db.sessions, db.helpEvents, db.sessionEvents, db.observations, db.settings], async () => {
    await db.attempts.bulkPut(attempts);
    await db.sessions.bulkPut(sessions);
    await db.helpEvents.bulkPut(helpEvents);
    await db.sessionEvents.bulkPut(sessionEvents);
    await db.observations.bulkPut(observations);
    await db.settings.bulkPut(settings);
  });
  return { attempts: attempts.length, sessions: sessions.length };
}

/** مسح تقدم الطفل محليًا (عملية إدارية من لوحة الأب فقط) */
export async function purgeProgress(): Promise<void> {
  await db.transaction('rw', [db.attempts, db.sessions, db.helpEvents, db.sessionEvents, db.observations, db.resume], async () => {
    await db.attempts.clear();
    await db.sessions.clear();
    await db.helpEvents.clear();
    await db.sessionEvents.clear();
    await db.observations.clear();
    await db.resume.clear();
  });
}

/** حالة التخزين الدائم لعرضها في لوحة الأب */
export async function describeStorage(): Promise<string> {
  if (!navigator.storage?.persisted) return 'المتصفح لا يدعم التخزين الدائم.';
  const persisted = await navigator.storage.persisted();
  const est = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
  const used = est?.usage ? `${Math.round(est.usage / 1024)} كيلوبايت` : '';
  return persisted ? `التخزين دائم (لن يحذفه المتصفح تلقائيًا). ${used}` : `التخزين غير دائم بعد: قد يحذفه المتصفح عند ضيق المساحة؛ خذ نسخة احتياطية. ${used}`;
}
