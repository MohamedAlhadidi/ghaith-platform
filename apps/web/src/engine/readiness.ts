// جاهزية التمثيل: من بيانات الطفل نفسه نقرر هل يبقى بالحركة أم ينتقل إلى الكتابة مع اللوحة ثم بلا لوحة
// القاعدة (محسوس ← صوري ← مجرد): لا يصعد مستوى إلا بعد 4 إجابات نظيفة من آخر 5 في المستوى الحالي؛
// ويهبط مستوى إذا أخطأ في 3 من آخر 5 في مستواه الحالي. خط الأساس لا يُحتسب.
import type { AttemptEvent, RepresentationType } from './mastery';
import type { HundredSquareVariant, Readiness, ReadinessLevel } from './hundredSquare';

export interface ReadinessRules {
  window: number;
  cleanToAdvance: number;
  wrongToDrop: number;
}

export const DEFAULT_READINESS_RULES: ReadinessRules = { window: 5, cleanToAdvance: 4, wrongToDrop: 3 };

const GATED: HundredSquareVariant[] = ['ten_more_less', 'one_more_less'];
const ORDER: ReadinessLevel[] = ['concrete', 'pictorial', 'abstract'];

function levelOf(attemptsAtLevel: AttemptEvent[], rules: ReadinessRules): { advance: boolean; drop: boolean } {
  const recent = attemptsAtLevel.slice(-rules.window);
  const clean = recent.filter((a) => a.firstTryCorrect && a.hintsUsed === 0).length;
  const wrong = recent.filter((a) => !a.correct).length;
  return { advance: clean >= rules.cleanToAdvance, drop: wrong >= rules.wrongToDrop };
}

/** يحسب المستوى المسموح لكل نوع مُقيَّد من تاريخ المحاولات (مرتبة زمنيًا) */
export function computeReadiness(attempts: AttemptEvent[], rules: ReadinessRules = DEFAULT_READINESS_RULES): Readiness {
  const out: Readiness = {};
  for (const variant of GATED) {
    const own = attempts
      .filter((a) => a.variant === variant && a.source === 'app' && a.phase !== 'baseline')
      .sort((x, y) => x.clientTs - y.clientTs);
    // نعيد تشغيل القاعدة زمنيًا: نبدأ محسوسًا ونصعد أو نهبط حسب الأداء في المستوى الحالي فقط
    let level: ReadinessLevel = 'concrete';
    const buckets: Record<RepresentationType, AttemptEvent[]> = { concrete: [], pictorial: [], abstract: [] };
    for (const a of own) {
      buckets[a.representation].push(a);
      const { advance, drop } = levelOf(buckets[level], rules);
      if (a.representation === level) {
        if (advance && ORDER.indexOf(level) < ORDER.length - 1) {
          level = ORDER[ORDER.indexOf(level) + 1];
          buckets[level] = [];
        } else if (drop && ORDER.indexOf(level) > 0) {
          level = ORDER[ORDER.indexOf(level) - 1];
          buckets[level] = [];
        }
      }
    }
    out[variant] = level;
  }
  return out;
}

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  concrete: 'بالحركة على اللوحة',
  pictorial: 'بالكتابة مع اللوحة',
  abstract: 'بالكتابة بلا لوحة',
};
