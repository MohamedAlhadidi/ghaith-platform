// محرك الإتقان: طيّ حتمي لأحداث المحاولات إلى حالة مهارة قابلة للتفسير وإعادة الحساب

import type { ErrorTag } from './errors';
import type { InputMode } from './question';

export type SkillState =
  | 'not_assessed' // لم يُقيَّم بعد
  | 'needs_support' // حاول ولم يصب بعد: يحتاج جلوس الأب معه
  | 'learning_with_help' // يتعلم بمساعدة
  | 'independent' // يحل مستقلًا
  | 'retained' // يحتفظ بالمهارة في المراجعة
  | 'needs_review'; // يحتاج مراجعة جديدة

export const SKILL_STATE_LABELS: Record<SkillState, string> = {
  not_assessed: 'لم يُقيَّم بعد',
  needs_support: 'يحتاج دعمًا مباشرًا',
  learning_with_help: 'يتعلم بمساعدة',
  independent: 'يحل مستقلًا',
  retained: 'يحتفظ بالمهارة',
  needs_review: 'يحتاج مراجعة جديدة',
};

export type RepresentationType = 'concrete' | 'pictorial' | 'abstract';
export type AttemptPhase = 'baseline' | 'guided' | 'independent' | 'check' | 'review';
export type AttemptSource = 'app' | 'parent_obs' | 'paper';

/** حدث محاولة واحد كما يُخزَّن (إلحاق فقط، لا يُعدَّل) */
export interface AttemptEvent {
  id: string; // ULID من العميل
  sessionId: string;
  childId: string;
  skillCode: string;
  templateCode: string;
  variant: string;
  seed: number;
  representation: RepresentationType;
  inputMode: InputMode;
  phase: AttemptPhase;
  source: AttemptSource;
  givenAnswer: string;
  /** هل أصاب في النهاية (ولو بعد محاولات) */
  correct: boolean;
  firstTryCorrect: boolean;
  attemptsCount: number;
  hintsUsed: number;
  /** وسم الخطأ الأول (أو none إن أصاب من الأولى) */
  errorTag: ErrorTag;
  /** الزمن الكلي للسؤال؛ للعرض لا للحكم */
  responseMs: number;
  /** الزمن حتى أول فعل (نقرة أو رقم) */
  firstResponseMs: number;
  /** أطول فترة بلا فعل داخل السؤال */
  hesitationMs: number;
  audioReplays: number;
  /** هل اقترح الرفيق تلميحًا بسبب التردد */
  hintSuggested: boolean;
  /** سبب تعديل هذا السؤال إن جاء من تكيّف (أسهل/أصعب) */
  adaptation?: string;
  /** اليوم المحلي YYYY-MM-DD لحساب "يومان مختلفان" */
  localDay: string;
  isReview: boolean;
  clientTs: number; // ميلي ثانية منذ 1970
  synced: 0 | 1;
}

/** قواعد الإتقان كإعدادات قابلة للتعديل من لوحة الأب؛ قرارات تشغيلية لا معايير تشخيصية */
export interface MasteryRules {
  version: number;
  /** حجم نافذة آخر المحاولات المحتسبة */
  window: number;
  independent: {
    /** أقل عدد محاولات محتسبة قبل الحكم بالاستقلال (نافذة كاملة) */
    minCounted: number;
    /** عدد الإجابات النظيفة (من الأولى وبلا تلميح) المطلوبة داخل النافذة */
    minCleanCorrect: number;
    minDistinctRepresentations: number;
    /** على الأقل يومان مختلفان */
    minDistinctDays: number;
  };
  needsReview: {
    /** نسبة نجاح المراجعة التي دونها تعود المهارة إلى "يحتاج مراجعة" */
    minReviewSuccessRatio: number;
  };
  reviewIntervalsDays: number[];
}

export const DEFAULT_MASTERY_RULES: MasteryRules = {
  version: 2,
  window: 10,
  independent: { minCounted: 10, minCleanCorrect: 8, minDistinctRepresentations: 2, minDistinctDays: 2 },
  needsReview: { minReviewSuccessRatio: 0.6 },
  reviewIntervalsDays: [1, 3, 7, 14, 30],
};

/** يتحقق من صلاحية قواعد مستوردة من لوحة الأب (JSON) ويعيد رسالة الخطأ بالعربية */
export function validateRules(input: unknown): { ok: true; rules: MasteryRules } | { ok: false; errorAr: string } {
  const r = input as Partial<MasteryRules> | null;
  if (!r || typeof r !== 'object') return { ok: false, errorAr: 'القواعد ليست كائن JSON.' };
  const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  if (!int(r.version, 1, 1000)) return { ok: false, errorAr: 'version يجب أن يكون عددًا صحيحًا.' };
  if (!int(r.window, 3, 50)) return { ok: false, errorAr: 'window بين 3 و50.' };
  const i = r.independent;
  if (!i || !int(i.minCounted, 1, 50) || !int(i.minCleanCorrect, 1, 50) || !int(i.minDistinctRepresentations, 1, 3) || !int(i.minDistinctDays, 1, 10)) {
    return { ok: false, errorAr: 'قيم independent غير صالحة.' };
  }
  if (i.minCounted > (r.window as number)) return { ok: false, errorAr: 'minCounted لا يتجاوز window.' };
  if (i.minCleanCorrect > i.minCounted) return { ok: false, errorAr: 'minCleanCorrect لا يتجاوز minCounted.' };
  const n = r.needsReview;
  if (!n || typeof n.minReviewSuccessRatio !== 'number' || n.minReviewSuccessRatio < 0 || n.minReviewSuccessRatio > 1) return { ok: false, errorAr: 'minReviewSuccessRatio بين 0 و1.' };
  if (!Array.isArray(r.reviewIntervalsDays) || r.reviewIntervalsDays.length === 0 || !r.reviewIntervalsDays.every((d) => int(d, 1, 365))) {
    return { ok: false, errorAr: 'reviewIntervalsDays قائمة أيام صحيحة.' };
  }
  return { ok: true, rules: r as MasteryRules };
}

export interface SkillAssessment {
  skillCode: string;
  state: SkillState;
  /** شرح للأب: لماذا هذه الحالة */
  reasonAr: string;
  /** المحاولات التي بُني عليها الحكم */
  evidenceIds: string[];
  stats: {
    counted: number;
    /** صحيحة من الأولى وبلا تلميح */
    cleanCorrect: number;
    /** صحيحة في النهاية */
    eventuallyCorrect: number;
    hintsTotal: number;
    representations: number;
    days: number;
    sessions: number;
    reviewAttempts: number;
    reviewCorrect: number;
    baselineAttempts: number;
    baselineCorrect: number;
  };
  rulesVersion: number;
}

/** هل المحاولة "نظيفة": صحيحة من الأولى وبلا أي تلميح */
export function isCleanCorrect(e: AttemptEvent): boolean {
  return e.firstTryCorrect && e.hintsUsed === 0;
}

/**
 * يحسب حالة مهارة واحدة من كل أحداثها.
 * تُحتسب محاولات التطبيق في مرحلتي "مستقل" و"تحقق" فقط؛ التوجيه وخط الأساس لا يُحتسبان، والمراجعة تُقيَّم على حدة.
 */
export function assessSkill(skillCode: string, events: AttemptEvent[], rules: MasteryRules = DEFAULT_MASTERY_RULES): SkillAssessment {
  const own = events.filter((e) => e.skillCode === skillCode && e.source === 'app').sort((a, b) => a.clientTs - b.clientTs || a.id.localeCompare(b.id));
  const baseline = own.filter((e) => e.phase === 'baseline');
  const practice = own.filter((e) => e.phase !== 'baseline');
  const reviews = practice.filter((e) => e.isReview);
  const counted = practice.filter((e) => !e.isReview && (e.phase === 'independent' || e.phase === 'check')).slice(-rules.window);

  const stats = {
    counted: counted.length,
    cleanCorrect: counted.filter(isCleanCorrect).length,
    eventuallyCorrect: counted.filter((e) => e.correct).length,
    hintsTotal: counted.reduce((s, e) => s + e.hintsUsed, 0),
    representations: new Set(counted.map((e) => e.representation)).size,
    days: new Set(counted.map((e) => e.localDay)).size,
    sessions: new Set(counted.map((e) => e.sessionId)).size,
    reviewAttempts: reviews.length,
    reviewCorrect: reviews.filter((e) => e.firstTryCorrect).length,
    baselineAttempts: baseline.length,
    baselineCorrect: baseline.filter((e) => e.correct).length,
  };
  const base = { skillCode, evidenceIds: counted.map((e) => e.id), stats, rulesVersion: rules.version };

  if (practice.length === 0) {
    return { ...base, state: 'not_assessed', reasonAr: baseline.length > 0 ? `خط أساس فقط: ${stats.baselineCorrect} من ${baseline.length}.` : 'لا توجد محاولات بعد.' };
  }

  if (reviews.length > 0) {
    const ratio = stats.reviewCorrect / reviews.length;
    if (ratio < rules.needsReview.minReviewSuccessRatio) {
      return { ...base, state: 'needs_review', reasonAr: `نجح في ${stats.reviewCorrect} من ${reviews.length} أسئلة مراجعة، وهذا أقل من الحد.` };
    }
  }

  const meetsIndependent =
    counted.length >= rules.independent.minCounted &&
    stats.cleanCorrect >= rules.independent.minCleanCorrect &&
    stats.representations >= rules.independent.minDistinctRepresentations &&
    stats.days >= rules.independent.minDistinctDays;

  if (meetsIndependent) {
    if (reviews.length > 0) {
      return { ...base, state: 'retained', reasonAr: `يحل مستقلًا ونجح في المراجعة (${stats.reviewCorrect} من ${reviews.length}).` };
    }
    return { ...base, state: 'independent', reasonAr: `${stats.cleanCorrect} من ${counted.length} صحيحة من الأولى بلا تلميح، في ${stats.days} أيام وبـ${stats.representations} تمثيل.` };
  }

  const anyCorrect = practice.some((e) => e.correct);
  if (!anyCorrect) {
    return { ...base, state: 'needs_support', reasonAr: `${practice.length} محاولات بلا إصابة بعد. يُفضَّل أن يجلس الأب معه في الجلسة القادمة.` };
  }

  const missing: string[] = [];
  if (counted.length < rules.independent.minCounted) missing.push(`${rules.independent.minCounted - counted.length} محاولات مستقلة أخرى`);
  if (counted.length >= rules.independent.minCounted && stats.cleanCorrect < rules.independent.minCleanCorrect) missing.push(`دقة أعلى بلا تلميح (${stats.cleanCorrect} من ${counted.length})`);
  if (stats.days < rules.independent.minDistinctDays) missing.push('جلسة في يوم آخر');
  if (stats.representations < rules.independent.minDistinctRepresentations) missing.push('تمثيل مختلف');
  return { ...base, state: 'learning_with_help', reasonAr: `يحل بمساعدة. ينقصه: ${missing.join('، ')}.` };
}

/** موعد المراجعة التالية بالأيام حسب عدد المراجعات الناجحة المتتالية */
export function nextReviewDelayDays(successStreak: number, rules: MasteryRules = DEFAULT_MASTERY_RULES): number {
  const idx = Math.min(Math.max(successStreak, 0), rules.reviewIntervalsDays.length - 1);
  return rules.reviewIntervalsDays[idx];
}

/** اليوم المحلي بصيغة YYYY-MM-DD */
export function localDayOf(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
