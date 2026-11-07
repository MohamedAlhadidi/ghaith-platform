// ملاحظات الرفيق للأب: تلخيص جلسة واحدة (أو مقارنة جلسات) إلى جمل عربية بسيطة مع الدليل الرقمي
// لا تشخيص ولا مقارنة بأطفال آخرين؛ كل جملة تستند إلى أرقام تُعرض بجانبها

import { ERROR_TAG_LABELS, ERROR_TAG_MEANING, type ErrorTag } from '../engine/errors';
import type { AttemptEvent, RepresentationType } from '../engine/mastery';
import { toArabicIndic } from '../engine/answers';

const ar = toArabicIndic;

export interface SessionInsight {
  /** جملة واحدة قصيرة للأب */
  textAr: string;
  /** الأرقام التي بُنيت عليها */
  evidenceAr: string;
  /** اقتراح عملي على الورق إن وُجد */
  paperAr?: string;
  kind: 'accuracy' | 'error_pattern' | 'hesitation' | 'hints' | 'representation' | 'fatigue' | 'baseline' | 'adaptation';
}

export interface SessionSummary {
  sessionId: string;
  total: number;
  countedTotal: number;
  countedClean: number;
  countedCorrect: number;
  baselineTotal: number;
  baselineCorrect: number;
  hintsTotal: number;
  meanFirstResponseMs: number;
  maxHesitationMs: number;
  hesitations: number;
  topErrors: Array<{ tag: ErrorTag; count: number }>;
  byRepresentation: Array<{ representation: RepresentationType; total: number; correct: number }>;
  adaptations: string[];
  insights: SessionInsight[];
}

const REP_AR: Record<RepresentationType, string> = { concrete: 'بالحركة على اللوحة', pictorial: 'باللوحة', abstract: 'بلا لوحة' };

function pct(a: number, b: number): string {
  return b === 0 ? '—' : `${ar(Math.round((100 * a) / b))}٪`;
}

/** يلخص محاولات جلسة واحدة */
export function summarizeSession(sessionId: string, attempts: AttemptEvent[], firstHalfSecondHalf = true): SessionSummary {
  const own = attempts.filter((a) => a.sessionId === sessionId).sort((a, b) => a.clientTs - b.clientTs);
  const baseline = own.filter((a) => a.phase === 'baseline');
  const counted = own.filter((a) => a.phase === 'independent' || a.phase === 'check');
  const practice = own.filter((a) => a.phase !== 'baseline');

  const errorCounts = new Map<ErrorTag, number>();
  for (const a of practice) if (a.errorTag !== 'none') errorCounts.set(a.errorTag, (errorCounts.get(a.errorTag) ?? 0) + 1);
  const topErrors = [...errorCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count);

  const reps = new Map<RepresentationType, { total: number; correct: number }>();
  for (const a of practice) {
    const r = reps.get(a.representation) ?? { total: 0, correct: 0 };
    r.total++;
    if (a.firstTryCorrect) r.correct++;
    reps.set(a.representation, r);
  }
  const byRepresentation = [...reps.entries()].map(([representation, v]) => ({ representation, ...v }));

  const meanFirst = practice.length ? practice.reduce((s, a) => s + a.firstResponseMs, 0) / practice.length : 0;
  const maxHes = practice.reduce((m, a) => Math.max(m, a.hesitationMs), 0);
  const hesitations = practice.filter((a) => a.hintSuggested).length;
  const adaptations = practice.map((a) => a.adaptation).filter((x): x is string => Boolean(x));

  const insights: SessionInsight[] = [];
  const clean = counted.filter((a) => a.firstTryCorrect && a.hintsUsed === 0).length;
  const correct = counted.filter((a) => a.correct).length;

  if (baseline.length > 0) {
    const bc = baseline.filter((a) => a.correct).length;
    insights.push({ kind: 'baseline', textAr: `قبل الدرس أصاب ${ar(bc)} من ${ar(baseline.length)} وحده.`, evidenceAr: `خط الأساس ${pct(bc, baseline.length)}` });
  }
  if (counted.length > 0) {
    insights.push({
      kind: 'accuracy',
      textAr: clean === counted.length ? 'حلّ كل أسئلة "وحدك" من الأولى بلا تلميح.' : `حلّ ${ar(clean)} من ${ar(counted.length)} من الأولى بلا تلميح، و${ar(correct)} في النهاية.`,
      evidenceAr: `نظيفة ${pct(clean, counted.length)}، صحيحة في النهاية ${pct(correct, counted.length)}`,
    });
  }
  if (topErrors.length > 0 && topErrors[0].count >= 2) {
    const t = topErrors[0];
    const m = ERROR_TAG_MEANING[t.tag];
    insights.push({ kind: 'error_pattern', textAr: `تكرر خطأ "${ERROR_TAG_LABELS[t.tag]}": ${m.meaningAr}`, evidenceAr: `${ar(t.count)} مرات`, paperAr: m.paperAr });
  }
  if (practice.length > 0 && hesitations > 0) {
    insights.push({ kind: 'hesitation', textAr: `تردد طويلًا في ${ar(hesitations)} أسئلة قبل أي فعل.`, evidenceAr: `أطول تردد ${ar(Math.round(maxHes / 1000))} ثانية، متوسط أول فعل ${ar(Math.round(meanFirst / 1000))} ثوانٍ` });
  }
  const hintsTotal = practice.reduce((s, a) => s + a.hintsUsed, 0);
  if (hintsTotal > 0) {
    insights.push({ kind: 'hints', textAr: `استخدم ${ar(hintsTotal)} تلميحات في الجلسة.`, evidenceAr: `على ${ar(practice.filter((a) => a.hintsUsed > 0).length)} أسئلة` });
  }
  if (byRepresentation.length >= 2) {
    const sorted = [...byRepresentation].filter((r) => r.total >= 2).sort((x, y) => y.correct / y.total - x.correct / x.total);
    if (sorted.length >= 2 && sorted[0].correct / sorted[0].total - sorted[sorted.length - 1].correct / sorted[sorted.length - 1].total >= 0.4) {
      insights.push({
        kind: 'representation',
        textAr: `أسهل عليه ${REP_AR[sorted[0].representation]}، وأصعب ${REP_AR[sorted[sorted.length - 1].representation]}.`,
        evidenceAr: sorted.map((r) => `${REP_AR[r.representation]} ${pct(r.correct, r.total)}`).join('، '),
      });
    }
  }
  if (firstHalfSecondHalf && practice.length >= 6) {
    const half = Math.floor(practice.length / 2);
    const a1 = practice.slice(0, half).filter((a) => a.correct).length / half;
    const a2 = practice.slice(half).filter((a) => a.correct).length / (practice.length - half);
    if (a1 - a2 >= 0.4) {
      insights.push({ kind: 'fatigue', textAr: 'تراجعت الدقة في النصف الثاني من الجلسة.', evidenceAr: `النصف الأول ${pct(Math.round(a1 * half), half)}، الثاني ${pct(Math.round(a2 * (practice.length - half)), practice.length - half)}` });
    }
  }
  if (adaptations.length > 0) {
    insights.push({ kind: 'adaptation', textAr: `عدّل الرفيق المسار ${ar(adaptations.length)} مرات أثناء الجلسة.`, evidenceAr: adaptations.join('؛ ') });
  }

  return {
    sessionId,
    total: own.length,
    countedTotal: counted.length,
    countedClean: clean,
    countedCorrect: correct,
    baselineTotal: baseline.length,
    baselineCorrect: baseline.filter((a) => a.correct).length,
    hintsTotal,
    meanFirstResponseMs: meanFirst,
    maxHesitationMs: maxHes,
    hesitations,
    topErrors,
    byRepresentation,
    adaptations,
    insights,
  };
}

/** مقارنة بين خط الأساس الأول وآخر مرحلة تحقق: هل تغيّر شيء؟ */
export function progressSinceBaseline(attempts: AttemptEvent[]): { textAr: string; evidenceAr: string } | null {
  const baseline = attempts.filter((a) => a.phase === 'baseline').sort((a, b) => a.clientTs - b.clientTs);
  const checks = attempts.filter((a) => a.phase === 'check').sort((a, b) => a.clientTs - b.clientTs);
  if (baseline.length === 0 || checks.length === 0) return null;
  const firstSession = baseline[0].sessionId;
  const b = baseline.filter((a) => a.sessionId === firstSession);
  const lastSession = checks[checks.length - 1].sessionId;
  const c = checks.filter((a) => a.sessionId === lastSession);
  const bAcc = b.filter((a) => a.correct).length / b.length;
  const cAcc = c.filter((a) => a.firstTryCorrect).length / c.length;
  const diff = Math.round((cAcc - bAcc) * 100);
  const textAr = diff >= 20 ? 'تحسّن واضح عن خط الأساس.' : diff <= -20 ? 'أقل من خط الأساس؛ راجع الجلسة مع الطفل.' : 'قريب من خط الأساس حتى الآن.';
  return { textAr, evidenceAr: `خط الأساس ${pct(b.filter((a) => a.correct).length, b.length)} ← آخر تحقق ${pct(c.filter((a) => a.firstTryCorrect).length, c.length)}` };
}
