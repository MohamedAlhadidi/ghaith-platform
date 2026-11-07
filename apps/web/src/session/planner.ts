// مخطط الجلسة: يبني قائمة أسئلة حتمية من رمز الدرس ومعرّف الجلسة، بلا تكرار، مع تغطية الأنواع عبر الجلسات
// بنية الجلسة: خط أساس (أول مرة) ← شرح ← موجّه بتلاشٍ (محلول ← تلميح ← بلا) ← وحدك ← تحقق
import { createRng, seedFromString } from '../engine/rng';
import { easierEntry, generateFromEntry, harderEntry, PHASE_POOLS, type PoolEntry } from '../engine/hundredSquare';
import type { GeneratedQuestion } from '../engine/question';
import type { LessonDefinition } from '../content/lessons/L1A-01';
import type { Adaptation } from '../avatar/adapt';

export type PlanPhase = 'baseline' | 'guided' | 'independent' | 'check';

/** درجة الدعم في المرحلة الموجّهة: الرفيق يحل أمامه، أو تلميح أول تلقائي، أو بلا دعم */
export type Support = 'worked' | 'hint1' | 'none';

export interface PlannedQuestion {
  phase: PlanPhase;
  /** الترتيب داخل القائمة الكاملة */
  index: number;
  question: GeneratedQuestion;
  entry: PoolEntry;
  hintsAllowed: boolean;
  /** فورية في الموجّه والمستقل، مؤجلة في التحقق، محايدة في خط الأساس */
  feedback: 'immediate' | 'delayed' | 'neutral';
  support: Support;
  /** سبب التكيّف إن كان هذا السؤال نتيجة تعديل */
  adaptation?: string;
}

/** تعديل مطبَّق على الخطة (يُحفظ ليُعاد تطبيقه عند الاستئناف) */
export interface AppliedAdaptation {
  atIndex: number;
  kind: Adaptation['kind'];
  reasonAr: string;
}

export interface PlanOptions {
  includeBaseline: boolean;
}

/** مفتاح تكرار: النوع + الإجابة المتوقعة، حتى لا يظهر السؤال نفسه مرتين في جلسة واحدة */
function dedupeKey(q: GeneratedQuestion): string {
  const m = q.matcher;
  const expected = m.kind === 'exact' ? String(m.value) : m.kind === 'set' ? m.values.join(',') : `${m.min}-${m.max}`;
  return `${q.variant}:${expected}`;
}

function generateUnique(lesson: LessonDefinition, sessionId: string, phase: string, i: number, entry: PoolEntry, seen: Set<string>, salt = ''): GeneratedQuestion {
  let attempt = 0;
  let q: GeneratedQuestion;
  do {
    const seed = seedFromString(`${lesson.code}:${sessionId}:${phase}:${i}:${attempt}${salt}`);
    q = generateFromEntry(entry, seed);
    attempt++;
  } while (seen.has(dedupeKey(q)) && attempt < 30);
  seen.add(dedupeKey(q));
  return q;
}

/** يختار عناصر من المجمع بخلط حتمي، ويضمن وجود تمثيل حسي وتمثيل مجرد عند الطلب */
function chooseEntries(pool: PoolEntry[], count: number, seed: number, ensureMix: boolean): PoolEntry[] {
  const rng = createRng(seed);
  const shuffled = rng.shuffle(pool);
  const chosen = shuffled.slice(0, Math.min(count, shuffled.length));
  if (ensureMix) {
    const rest = shuffled.slice(chosen.length);
    const isAbstract = (e: PoolEntry) => e.mode === 'numpad' && !e.showSquare;
    const isConcrete = (e: PoolEntry) => e.mode === 'move';
    if (!chosen.some(isAbstract)) {
      const swap = rest.find(isAbstract);
      if (swap) chosen[chosen.length - 1] = swap;
    }
    if (!chosen.some(isConcrete)) {
      const swap = rest.find(isConcrete);
      if (swap) chosen[chosen.findIndex((e) => !isAbstract(e))] = swap;
    }
  }
  return chosen;
}

export function planSession(lesson: LessonDefinition, sessionId: string, options: PlanOptions = { includeBaseline: false }): PlannedQuestion[] {
  const seen = new Set<string>();
  const plan: PlannedQuestion[] = [];
  const push = (phase: PlanPhase, entry: PoolEntry, i: number, extra: Partial<PlannedQuestion>) => {
    const question = generateUnique(lesson, sessionId, phase, i, entry, seen);
    plan.push({ phase, index: plan.length, question, entry, hintsAllowed: false, feedback: 'immediate', support: 'none', ...extra });
  };

  if (options.includeBaseline) {
    const entries = chooseEntries(PHASE_POOLS.baseline, lesson.counts.baseline, seedFromString(`${lesson.code}:${sessionId}:baseline`), false);
    entries.forEach((entry, i) => push('baseline', entry, i, { feedback: 'neutral' }));
  }

  // الموجّه بترتيب ثابت: المثال المحلول بالحركة أولًا، ثم تلميح تلقائي، ثم بلا دعم
  const supports: Support[] = ['worked', 'hint1', 'none'];
  PHASE_POOLS.guided.slice(0, lesson.counts.guided).forEach((entry, i) => push('guided', entry, i, { hintsAllowed: true, support: supports[i] ?? 'none' }));

  const independent = chooseEntries(PHASE_POOLS.independent, lesson.counts.independent, seedFromString(`${lesson.code}:${sessionId}:independent`), true);
  independent.forEach((entry, i) => push('independent', entry, i, { hintsAllowed: true }));

  const check = chooseEntries(PHASE_POOLS.check, lesson.counts.check, seedFromString(`${lesson.code}:${sessionId}:check`), false);
  check.forEach((entry, i) => push('check', entry, i, { feedback: 'delayed' }));

  return plan;
}

/**
 * يطبّق تكيّفًا على السؤال التالي (إن كان في مرحلة قابلة للتكيّف) ويعيد خطة جديدة.
 * أسهل: التمثيل الأكثر حسية مع تلميح أول تلقائي. أصعب: التمثيل الأكثر تجريدًا.
 */
export function applyAdaptation(lesson: LessonDefinition, sessionId: string, plan: PlannedQuestion[], applied: AppliedAdaptation): PlannedQuestion[] {
  const target = applied.atIndex;
  const current = plan[target];
  if (!current || (current.phase !== 'guided' && current.phase !== 'independent')) return plan;
  if (applied.kind === 'suggest_stop') return plan;
  const entry = applied.kind === 'auto_hint_then_easier' ? easierEntry(current.entry) : harderEntry(current.entry);
  const seen = new Set(plan.filter((p) => p.index !== target).map((p) => dedupeKey(p.question)));
  const question = generateUnique(lesson, sessionId, `${current.phase}:adapt`, target, entry, seen, `:${applied.kind}`);
  const next: PlannedQuestion = {
    ...current,
    entry,
    question,
    adaptation: applied.reasonAr,
    support: applied.kind === 'auto_hint_then_easier' ? 'hint1' : current.support,
  };
  return plan.map((p, i) => (i === target ? next : p));
}

/** يعيد تطبيق كل التكيّفات المحفوظة بالترتيب (للاستئناف) */
export function replayAdaptations(lesson: LessonDefinition, sessionId: string, plan: PlannedQuestion[], applied: AppliedAdaptation[]): PlannedQuestion[] {
  return applied.reduce((p, a) => applyAdaptation(lesson, sessionId, p, a), plan);
}

/** هل يُختصر المتبقي بسبب الوقت: بعد تجاوز الحد تُحذف أسئلة "وحدك" المتبقية ونذهب إلى التحقق مباشرة */
export function shortcutForTime(plan: PlannedQuestion[], currentIndex: number, elapsedMs: number, limitMs: number): number {
  if (elapsedMs < limitMs) return currentIndex + 1;
  const cur = plan[currentIndex];
  if (cur && cur.phase === 'independent') {
    const firstCheck = plan.findIndex((p) => p.phase === 'check');
    if (firstCheck > currentIndex) return firstCheck;
  }
  return currentIndex + 1;
}
