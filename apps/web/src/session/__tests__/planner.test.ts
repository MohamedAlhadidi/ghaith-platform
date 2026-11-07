// اختبار مخطط الجلسة: الحتمية، عدم التكرار، توزيع المراحل، التغطية عبر الجلسات، التكيّف والاستئناف
import { describe, expect, it } from 'vitest';
import { applyAdaptation, planSession, replayAdaptations, shortcutForTime } from '../planner';
import { LESSON_L1A_01 } from '../../content/lessons/L1A-01';

describe('مخطط الجلسة', () => {
  it('يعطي الخطة نفسها لمعرّف الجلسة نفسه، وخطة مختلفة لجلسة أخرى', () => {
    const a = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAV');
    const b = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAV');
    const c = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAW');
    expect(a.map((p) => p.question.id)).toEqual(b.map((p) => p.question.id));
    expect(a.map((p) => p.question.id)).not.toEqual(c.map((p) => p.question.id));
  });
  it('13 سؤالًا بلا خط أساس: 2 تمرين و3 توجيه و5 وحدك و3 تحقق؛ ومع خط الأساس 21', () => {
    const plan = planSession(LESSON_L1A_01, 'S');
    expect(plan).toHaveLength(13);
    expect(plan.filter((p) => p.phase === 'warmup')).toHaveLength(2);
    expect(plan.filter((p) => p.phase === 'warmup').every((p) => p.question.inputMode === 'move' && p.hintsAllowed)).toBe(true);
    expect(plan.filter((p) => p.phase === 'guided')).toHaveLength(3);
    expect(plan.filter((p) => p.phase === 'independent')).toHaveLength(5);
    expect(plan.filter((p) => p.phase === 'check').every((p) => !p.hintsAllowed && p.feedback === 'delayed')).toBe(true);
    const withBase = planSession(LESSON_L1A_01, 'S', { includeBaseline: true });
    expect(withBase).toHaveLength(21);
    expect(withBase.slice(0, 8).every((p) => p.phase === 'baseline' && p.feedback === 'neutral' && !p.hintsAllowed)).toBe(true);
    expect(withBase.map((p) => p.index)).toEqual(withBase.map((_, i) => i));
  });
  it('الموجّه يتلاشى: محلول ثم تلميح ثم بلا دعم، والمحلول بالحركة', () => {
    const plan = planSession(LESSON_L1A_01, 'S');
    const guided = plan.filter((p) => p.phase === 'guided');
    expect(guided.map((g) => g.support)).toEqual(['worked', 'hint1', 'none']);
    expect(guided[0].question.inputMode).toBe('move');
  });
  it('لا يتكرر السؤال نفسه في الجلسة', () => {
    for (let s = 0; s < 100; s++) {
      const plan = planSession(LESSON_L1A_01, `session-${s}`, { includeBaseline: s % 2 === 0 });
      const keys = plan.map((p) => `${p.question.variant}:${JSON.stringify(p.question.matcher)}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('بلا جاهزية: لا أسئلة "أكثر/أقل" بلا لوحة أبدًا، وكلها بالحركة', () => {
    for (let s = 0; s < 50; s++) {
      const gated = planSession(LESSON_L1A_01, `gate-${s}`).filter((p) => p.phase !== 'baseline' && (p.question.variant === 'ten_more_less' || p.question.variant === 'one_more_less'));
      expect(gated.length).toBeGreaterThan(0);
      expect(gated.every((p) => p.question.inputMode === 'move')).toBe(true);
    }
  });
  it('بجاهزية مجردة: المرحلة المستقلة تحتوي تمثيلًا محسوسًا ومجردًا في كل جلسة', () => {
    for (let s = 0; s < 100; s++) {
      const plan = planSession(LESSON_L1A_01, `rep-${s}`, { includeBaseline: false, readiness: { ten_more_less: 'abstract', one_more_less: 'abstract' } });
      const reps = new Set(plan.filter((p) => p.phase === 'independent').map((p) => p.question.representation));
      expect(reps.has('concrete')).toBe(true);
      expect(reps.has('abstract')).toBe(true);
    }
  });
  it('كل أنواع التحقق تظهر عبر الجلسات، ومنها "موضع العدد"', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 60; s++) for (const p of planSession(LESSON_L1A_01, `cov-${s}`).filter((x) => x.phase === 'check')) seen.add(p.question.variant);
    expect(seen.has('locate')).toBe(true);
    expect(seen.size).toBe(5);
  });
  it('التكيّف يبدّل السؤال التالي فقط ويُعاد تطبيقه عند الاستئناف بالنتيجة نفسها', () => {
    const readiness = { ten_more_less: 'abstract' as const, one_more_less: 'abstract' as const };
    const plan = planSession(LESSON_L1A_01, 'adapt', { includeBaseline: false, readiness });
    const idx = plan.findIndex((p) => p.phase === 'independent' && p.question.representation === 'abstract');
    const applied = { atIndex: idx, kind: 'auto_hint_then_easier' as const, reasonAr: 'اختبار' };
    const next = applyAdaptation(LESSON_L1A_01, 'adapt', plan, applied, readiness);
    expect(next[idx].question.representation).toBe('pictorial');
    expect(next[idx].support).toBe('hint1');
    expect(next[idx].adaptation).toBe('اختبار');
    expect(next.filter((_, i) => i !== idx).map((p) => p.question.id)).toEqual(plan.filter((_, i) => i !== idx).map((p) => p.question.id));
    const replayed = replayAdaptations(LESSON_L1A_01, 'adapt', planSession(LESSON_L1A_01, 'adapt', { includeBaseline: false, readiness }), [applied], readiness);
    expect(replayed.map((p) => p.question.id)).toEqual(next.map((p) => p.question.id));
    // التحقق لا يتكيف
    const checkIdx = plan.findIndex((p) => p.phase === 'check');
    expect(applyAdaptation(LESSON_L1A_01, 'adapt', plan, { ...applied, atIndex: checkIdx }, readiness)).toBe(plan);
  });
  it('تجاوز الوقت في "وحدك" يقفز إلى التحقق مباشرة', () => {
    const plan = planSession(LESSON_L1A_01, 'time');
    const firstInd = plan.findIndex((p) => p.phase === 'independent');
    const firstCheck = plan.findIndex((p) => p.phase === 'check');
    expect(shortcutForTime(plan, firstInd, 1000, 2000)).toBe(firstInd + 1);
    expect(shortcutForTime(plan, firstInd, 3000, 2000)).toBe(firstCheck);
    expect(shortcutForTime(plan, firstCheck, 3000, 2000)).toBe(firstCheck + 1);
  });
});
