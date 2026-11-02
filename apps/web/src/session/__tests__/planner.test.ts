// اختبار مخطط الجلسة: الحتمية وعدم التكرار وتوزيع المراحل
import { describe, expect, it } from 'vitest';
import { planSession } from '../planner';
import { LESSON_L1A_01 } from '../../content/lessons/L1A-01';

describe('مخطط الجلسة', () => {
  it('يعطي الخطة نفسها لمعرّف الجلسة نفسه، وخطة مختلفة لجلسة أخرى', () => {
    const a = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAV');
    const b = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAV');
    const c = planSession(LESSON_L1A_01, '01ARZ3NDEKTSV4RRFFQ69G5FAW');
    expect(a.map((p) => p.question.id)).toEqual(b.map((p) => p.question.id));
    expect(a.map((p) => p.question.id)).not.toEqual(c.map((p) => p.question.id));
  });
  it('11 سؤالًا: 3 توجيه و5 مستقل و3 تحقق، والتحقق بلا تلميحات', () => {
    const plan = planSession(LESSON_L1A_01, 'S');
    expect(plan).toHaveLength(11);
    expect(plan.filter((p) => p.phase === 'guided')).toHaveLength(3);
    expect(plan.filter((p) => p.phase === 'independent')).toHaveLength(5);
    expect(plan.filter((p) => p.phase === 'check').every((p) => !p.hintsAllowed)).toBe(true);
  });
  it('لا يتكرر السؤال نفسه في الجلسة', () => {
    for (let s = 0; s < 50; s++) {
      const plan = planSession(LESSON_L1A_01, `session-${s}`);
      const keys = plan.map((p) => `${p.question.variant}:${JSON.stringify(p.question.matcher)}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('المرحلة المستقلة تحتوي تمثيلين مختلفين على الأقل', () => {
    const plan = planSession(LESSON_L1A_01, 'rep');
    const reps = new Set(plan.filter((p) => p.phase === 'independent').map((p) => p.question.representation));
    expect(reps.size).toBeGreaterThanOrEqual(2);
  });
});
