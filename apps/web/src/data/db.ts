// قاعدة البيانات المحلية (IndexedDB عبر Dexie): التقدم أحداث إلحاق فقط، والإعدادات مفاتيح بسيطة
import Dexie, { type EntityTable } from 'dexie';
import type { AttemptEvent } from '../engine/mastery';
import type { SessionSummary } from '../avatar/insights';
import type { AppliedAdaptation } from '../session/planner';
import type { Readiness } from '../engine/hundredSquare';

export interface SessionRecord {
  id: string; // ULID
  childId: string;
  lessonCode: string;
  startedAt: number;
  endedAt?: number;
  /** completed: أنهى كل الأسئلة؛ stopped: أوقفها الطفل أو الرفيق؛ killed: انقطعت؛ abandoned: تُركت */
  endReason?: 'completed' | 'stopped' | 'abandoned' | 'killed';
  /** هل اختُصرت بسبب الوقت */
  shortened?: boolean;
  heartbeatAt: number;
  synced: 0 | 1;
}

export interface HelpEventRecord {
  id: string;
  attemptId: string;
  kind: 'hint' | 'audio_replay';
  level: number;
  clientTs: number;
  synced: 0 | 1;
}

/** أحداث الجلسة غير المرتبطة بإجابة: تردد، تكيّف، توقف، استئناف */
export interface SessionEventRecord {
  id: string;
  sessionId: string;
  kind: 'hesitation' | 'adaptation' | 'pause' | 'resume' | 'stop' | 'over_time' | 'worked_example';
  detailAr?: string;
  clientTs: number;
  synced: 0 | 1;
}

/** ملاحظات الرفيق لجلسة واحدة، تُحسب عند النهاية وتُحفظ كما هي */
export interface ObservationRecord {
  id: string;
  sessionId: string;
  childId: string;
  createdAt: number;
  summary: SessionSummary;
  synced: 0 | 1;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** حالة جلسة جارية لاستئنافها إن أُغلق التطبيق فجأة */
export interface ResumeState {
  key: 'current';
  sessionId: string;
  lessonCode: string;
  includeBaseline: boolean;
  /** المرحلة الحالية: شرح (رقم الشاشة) أو سؤال (رقمه في الخطة) */
  stage: { kind: 'model' | 'question'; index: number };
  earned: number;
  adaptations: AppliedAdaptation[];
  /** مستوى الجاهزية الذي بُنيت به الخطة (ليُعاد بناؤها بالشكل نفسه) */
  readiness?: Readiness;
  savedAt: number;
}

export class GhaithDb extends Dexie {
  attempts!: EntityTable<AttemptEvent, 'id'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  helpEvents!: EntityTable<HelpEventRecord, 'id'>;
  sessionEvents!: EntityTable<SessionEventRecord, 'id'>;
  observations!: EntityTable<ObservationRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  resume!: EntityTable<ResumeState, 'key'>;

  constructor() {
    super('ghaith-learning');
    // الإصدار 1 (لا يُعدَّل): المخطط الأول
    this.version(1).stores({
      attempts: 'id, skillCode, sessionId, clientTs, synced, [childId+skillCode]',
      sessions: 'id, childId, startedAt, synced',
      helpEvents: 'id, attemptId, synced',
      settings: 'key',
      resume: 'key',
    });
    // الإصدار 2: حقول المراقبة في المحاولات، وأحداث الجلسة، وملاحظات الرفيق
    this.version(2)
      .stores({
        attempts: 'id, skillCode, sessionId, clientTs, synced, phase, [childId+skillCode]',
        sessions: 'id, childId, startedAt, synced',
        helpEvents: 'id, attemptId, synced',
        sessionEvents: 'id, sessionId, kind, clientTs',
        observations: 'id, sessionId, childId, createdAt',
        settings: 'key',
        resume: 'key',
      })
      .upgrade(async (tx) => {
        // المحاولات القديمة: "صحيحة في النهاية" تُستنتج من أن السؤال انتهى قبل استنفاد المحاولات الثلاث
        await tx
          .table('attempts')
          .toCollection()
          .modify((a: Partial<AttemptEvent> & { firstTryCorrect: boolean; attemptsCount: number; clientTs: number; responseMs: number }) => {
            a.correct ??= a.firstTryCorrect || a.attemptsCount < 3;
            a.errorTag ??= a.firstTryCorrect ? 'none' : 'other';
            a.inputMode ??= 'numpad';
            a.firstResponseMs ??= a.responseMs;
            a.hesitationMs ??= 0;
            a.audioReplays ??= 0;
            a.hintSuggested ??= false;
            const d = new Date(a.clientTs);
            const p = (n: number) => String(n).padStart(2, '0');
            a.localDay ??= `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
          });
        // حالة الاستئناف القديمة لا تُفهم بالشكل الجديد
        await tx.table('resume').clear();
      });
  }
}

export const db = new GhaithDb();

export const DEFAULT_CHILD_ID = 'ghaith';
