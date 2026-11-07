// قواعد التكيّف داخل الجلسة: قواعد مفسَّرة وثابتة، لا نموذج خفي
// المدخل: ما حدث في الجلسة حتى الآن؛ المخرج: قرار واحد أو لا شيء، مع سبب بالعربية يُحفظ ويُعرض للأب

import type { ErrorTag } from '../engine/errors';
import type { AttemptPhase, RepresentationType } from '../engine/mastery';

export interface RecentAttempt {
  phase: AttemptPhase;
  correct: boolean;
  firstTryCorrect: boolean;
  hintsUsed: number;
  errorTag: ErrorTag;
  firstResponseMs: number;
  representation: RepresentationType;
}

export type Adaptation =
  | { kind: 'auto_hint_then_easier'; reasonAr: string; tag: ErrorTag }
  | { kind: 'harder'; reasonAr: string }
  | { kind: 'suggest_stop'; reasonAr: string };

export interface AdaptRules {
  /** خطآن متتاليان بالوسم نفسه */
  sameTagStreak: number;
  /** ثلاث إجابات نظيفة سريعة متتالية */
  fastCleanStreak: number;
  /** "سريعة" = أول فعل قبل هذا الزمن */
  fastMs: number;
  /** التردد الذي بعده يقترح الرفيق تلميحًا */
  hesitationMs: number;
  /** الإرهاق: من آخر N محاولات، M خاطئة، بعد دقيقة كذا */
  fatigueWindow: number;
  fatigueWrong: number;
  fatigueAfterMinutes: number;
}

export const DEFAULT_ADAPT_RULES: AdaptRules = {
  sameTagStreak: 2,
  fastCleanStreak: 3,
  fastMs: 6000,
  hesitationMs: 8000,
  fatigueWindow: 4,
  fatigueWrong: 3,
  fatigueAfterMinutes: 8,
};

/**
 * يقرر بعد انتهاء سؤال ما إذا كان السؤال التالي يحتاج تعديلًا.
 * يُستدعى في مرحلتي "موجّه" و"مستقل" فقط؛ التحقق وخط الأساس لا يتكيفان.
 */
export function decideAdaptation(recent: RecentAttempt[], elapsedMinutes: number, rules: AdaptRules = DEFAULT_ADAPT_RULES): Adaptation | null {
  const practice = recent.filter((a) => a.phase === 'guided' || a.phase === 'independent');
  if (practice.length === 0) return null;

  // الإرهاق أولًا: تراجع واضح بعد وقت كافٍ
  const window = practice.slice(-rules.fatigueWindow);
  if (elapsedMinutes >= rules.fatigueAfterMinutes && window.length >= rules.fatigueWindow && window.filter((a) => !a.correct).length >= rules.fatigueWrong) {
    return { kind: 'suggest_stop', reasonAr: `${window.filter((a) => !a.correct).length} أخطاء في آخر ${window.length} أسئلة بعد ${Math.round(elapsedMinutes)} دقائق` };
  }

  // خطآن متتاليان من النوع نفسه (لا يُحتسب الخطأ "أخرى")
  const lastTwo = practice.slice(-rules.sameTagStreak);
  if (lastTwo.length === rules.sameTagStreak && lastTwo.every((a) => !a.firstTryCorrect && a.errorTag !== 'none' && a.errorTag !== 'other' && a.errorTag === lastTwo[0].errorTag)) {
    return { kind: 'auto_hint_then_easier', reasonAr: `خطآن متتاليان من نوع "${lastTwo[0].errorTag}"`, tag: lastTwo[0].errorTag };
  }

  // ثلاث إجابات نظيفة سريعة متتالية في المرحلة المستقلة
  const independent = practice.filter((a) => a.phase === 'independent');
  const lastN = independent.slice(-rules.fastCleanStreak);
  if (lastN.length === rules.fastCleanStreak && lastN.every((a) => a.firstTryCorrect && a.hintsUsed === 0 && a.firstResponseMs <= rules.fastMs) && lastN.some((a) => a.representation !== 'abstract')) {
    return { kind: 'harder', reasonAr: `${rules.fastCleanStreak} إجابات صحيحة سريعة متتالية بلا تلميح` };
  }

  return null;
}
