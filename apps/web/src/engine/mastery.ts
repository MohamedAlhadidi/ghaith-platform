// محرك الإتقان: طيّ حتمي لأحداث المحاولات إلى حالة مهارة قابلة للتفسير وإعادة الحساب

export type SkillState =
  | 'not_assessed' // لم يُقيَّم بعد
  | 'learning_with_help' // يتعلم بمساعدة
  | 'independent' // يحل مستقلًا
  | 'retained' // يحتفظ بالمهارة في المراجعة
  | 'needs_review'; // يحتاج مراجعة جديدة

export const SKILL_STATE_LABELS: Record<SkillState, string> = {
  not_assessed: 'لم يُقيَّم بعد',
  learning_with_help: 'يتعلم بمساعدة',
  independent: 'يحل مستقلًا',
  retained: 'يحتفظ بالمهارة',
  needs_review: 'يحتاج مراجعة جديدة',
};

export type RepresentationType = 'concrete' | 'pictorial' | 'abstract';
export type AttemptPhase = 'guided' | 'independent' | 'check' | 'review';
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
  phase: AttemptPhase;
  source: AttemptSource;
  givenAnswer: string;
  firstTryCorrect: boolean;
  attemptsCount: number;
  hintsUsed: number;
  responseMs: number; // للعرض فقط، ليس معيارًا
  isReview: boolean;
  clientTs: number; // ميلي ثانية منذ 1970
  synced: 0 | 1;
}

/** قواعد الإتقان كإعدادات قابلة للتعديل من لوحة الأب؛ قرارات تشغيلية لا معايير تشخيصية */
export interface MasteryRules {
  version: number;
  /** حجم نافذة آخر المحاولات المستقلة المحتسبة */
  window: number;
  /** أقل عدد محاولات قبل إصدار أي حكم */
  minAttempts: number;
  independent: {
    minFirstTryCorrect: number;
    maxHintsTotal: number;
    minDistinctRepresentations: number;
    /** على الأقل جلستان مختلفتان */
    minDistinctSessions: number;
  };
  needsReview: {
    /** نسبة نجاح المراجعة التي دونها تعود المهارة إلى "يحتاج مراجعة" */
    minReviewSuccessRatio: number;
  };
  reviewIntervalsDays: number[];
}

export const DEFAULT_MASTERY_RULES: MasteryRules = {
  version: 1,
  window: 10,
  minAttempts: 3,
  independent: { minFirstTryCorrect: 8, maxHintsTotal: 0, minDistinctRepresentations: 2, minDistinctSessions: 2 },
  needsReview: { minReviewSuccessRatio: 0.6 },
  reviewIntervalsDays: [1, 3, 7, 14, 30],
};

export interface SkillAssessment {
  skillCode: string;
  state: SkillState;
  /** شرح للأب: لماذا هذه الحالة */
  reasonAr: string;
  /** المحاولات التي بُني عليها الحكم */
  evidenceIds: string[];
  stats: {
    counted: number;
    firstTryCorrect: number;
    hintsTotal: number;
    representations: number;
    sessions: number;
    reviewAttempts: number;
    reviewCorrect: number;
  };
  rulesVersion: number;
}

/**
 * يحسب حالة مهارة واحدة من كل أحداثها (مرتبة زمنيًا).
 * تُحتسب فقط محاولات التطبيق في مرحلتي "مستقل" و"تحقق"؛ محاولات التوجيه لا تُحتسب، ومحاولات المراجعة تُقيَّم على حدة.
 */
export function assessSkill(skillCode: string, events: AttemptEvent[], rules: MasteryRules = DEFAULT_MASTERY_RULES): SkillAssessment {
  const own = events.filter((e) => e.skillCode === skillCode && e.source === 'app').sort((a, b) => a.clientTs - b.clientTs || a.id.localeCompare(b.id));
  const reviews = own.filter((e) => e.isReview);
  const counted = own.filter((e) => !e.isReview && (e.phase === 'independent' || e.phase === 'check')).slice(-rules.window);
  const anyCorrect = own.some((e) => e.firstTryCorrect || e.attemptsCount > 1);

  const stats = {
    counted: counted.length,
    firstTryCorrect: counted.filter((e) => e.firstTryCorrect).length,
    hintsTotal: counted.reduce((s, e) => s + e.hintsUsed, 0),
    representations: new Set(counted.map((e) => e.representation)).size,
    sessions: new Set(counted.map((e) => e.sessionId)).size,
    reviewAttempts: reviews.length,
    reviewCorrect: reviews.filter((e) => e.firstTryCorrect).length,
  };
  const base = { skillCode, evidenceIds: counted.map((e) => e.id), stats, rulesVersion: rules.version };

  if (own.length === 0) {
    return { ...base, state: 'not_assessed', reasonAr: 'لا توجد محاولات بعد.' };
  }

  // المراجعة اللاحقة لها الأولوية في الحكم إن وُجدت
  if (reviews.length > 0) {
    const ratio = stats.reviewCorrect / reviews.length;
    if (ratio < rules.needsReview.minReviewSuccessRatio) {
      return { ...base, state: 'needs_review', reasonAr: `نجح في ${stats.reviewCorrect} من ${reviews.length} أسئلة مراجعة، وهذا أقل من الحد.` };
    }
  }

  const meetsIndependent =
    counted.length >= rules.minAttempts &&
    stats.firstTryCorrect >= Math.min(rules.independent.minFirstTryCorrect, counted.length) &&
    stats.hintsTotal <= rules.independent.maxHintsTotal &&
    stats.representations >= rules.independent.minDistinctRepresentations &&
    stats.sessions >= rules.independent.minDistinctSessions;

  if (meetsIndependent) {
    if (reviews.length > 0) {
      return { ...base, state: 'retained', reasonAr: `يحل مستقلًا ونجح في المراجعة (${stats.reviewCorrect} من ${reviews.length}).` };
    }
    return { ...base, state: 'independent', reasonAr: `${stats.firstTryCorrect} من ${counted.length} صحيحة من المحاولة الأولى بلا تلميح، في ${stats.sessions} جلسات وبـ${stats.representations} تمثيل.` };
  }

  if (anyCorrect) {
    const missing: string[] = [];
    if (counted.length < rules.minAttempts) missing.push('محاولات مستقلة أكثر');
    if (stats.hintsTotal > rules.independent.maxHintsTotal) missing.push('حل بلا تلميحات');
    if (stats.sessions < rules.independent.minDistinctSessions) missing.push('جلسة ثانية في يوم آخر');
    if (stats.representations < rules.independent.minDistinctRepresentations) missing.push('تمثيل مختلف');
    return { ...base, state: 'learning_with_help', reasonAr: `يحل بمساعدة. ينقصه: ${missing.join('، ') || 'دقة أعلى من المحاولة الأولى'}.` };
  }

  return { ...base, state: 'not_assessed', reasonAr: 'لم تُسجَّل إجابة صحيحة بعد.' };
}

/** موعد المراجعة التالية بالأيام حسب عدد المراجعات الناجحة المتتالية */
export function nextReviewDelayDays(successStreak: number, rules: MasteryRules = DEFAULT_MASTERY_RULES): number {
  const idx = Math.min(Math.max(successStreak, 0), rules.reviewIntervalsDays.length - 1);
  return rules.reviewIntervalsDays[idx];
}
