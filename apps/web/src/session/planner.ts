// مخطط الجلسة: يبني قائمة أسئلة حتمية من رمز الدرس ومعرّف الجلسة، بلا تكرار داخل الجلسة
import { seedFromString } from '../engine/rng';
import { generateHundredSquareQuestion, VARIANTS_BY_PHASE } from '../engine/hundredSquare';
import type { GeneratedQuestion } from '../engine/question';
import type { AttemptPhase } from '../engine/mastery';
import type { LessonDefinition } from '../content/lessons/L1A-01';

export type PlanPhase = Exclude<AttemptPhase, 'review'>;

export interface PlannedQuestion {
  phase: PlanPhase;
  index: number;
  question: GeneratedQuestion;
  hintsAllowed: boolean;
}

/** مفتاح تكرار: النوع + الإجابة المتوقعة، حتى لا يظهر السؤال نفسه مرتين في جلسة واحدة */
function dedupeKey(q: GeneratedQuestion): string {
  const m = q.matcher;
  const expected = m.kind === 'exact' ? String(m.value) : m.kind === 'set' ? m.values.join(',') : `${m.min}-${m.max}`;
  return `${q.variant}:${expected}`;
}

export function planSession(lesson: LessonDefinition, sessionId: string): PlannedQuestion[] {
  const seen = new Set<string>();
  const plan: PlannedQuestion[] = [];
  const phases: PlanPhase[] = ['guided', 'independent', 'check'];
  for (const phase of phases) {
    const count = lesson.counts[phase];
    const pool = VARIANTS_BY_PHASE[phase];
    for (let i = 0; i < count; i++) {
      const choice = pool[i % pool.length];
      let attempt = 0;
      let q: GeneratedQuestion;
      do {
        const seed = seedFromString(`${lesson.code}:${sessionId}:${phase}:${i}:${attempt}`);
        q = generateHundredSquareQuestion(choice.variant, seed, { showSquare: choice.showSquare });
        attempt++;
      } while (seen.has(dedupeKey(q)) && attempt < 20);
      seen.add(dedupeKey(q));
      plan.push({ phase, index: i, question: q, hintsAllowed: phase !== 'check' });
    }
  }
  return plan;
}
