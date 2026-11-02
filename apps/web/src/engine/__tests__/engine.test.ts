// اختبارات طبقة المنطق: الحتمية، التطبيع، المطابقة، الإتقان، ومولدات لوحة المائة
import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '../rng';
import { matchAnswer, normalizeDigits, parseIntegerAnswer, toArabicIndic, type AnswerMatcher } from '../answers';
import { assessSkill, DEFAULT_MASTERY_RULES, type AttemptEvent } from '../mastery';
import { colOf, generateHundredSquareQuestion, HUNDRED_SQUARE_SKILL, rowOf, type HundredSquareVariant } from '../hundredSquare';

describe('المولد العشوائي الحتمي', () => {
  it('البذرة نفسها تعطي التسلسل نفسه', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.int(1, 100), a.int(1, 100), a.next()]).toEqual([b.int(1, 100), b.int(1, 100), b.next()]);
  });
  it('int يبقى داخل الحدود', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  it('seedFromString ثابت', () => {
    expect(seedFromString('L1A-01:guided:0')).toBe(seedFromString('L1A-01:guided:0'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
});

describe('تطبيع الأرقام والمطابقة', () => {
  it('يحوّل الأرقام العربية الهندية والفارسية إلى لاتينية ويزيل محارف الاتجاه', () => {
    expect(normalizeDigits('‏٣٤')).toBe('34');
    expect(normalizeDigits('۴۲')).toBe('42');
    expect(parseIntegerAnswer(' ٨ ')).toBe(8);
    expect(parseIntegerAnswer('أربعة')).toBeNull();
  });
  it('يعرض بالأرقام العربية الهندية', () => {
    expect(toArabicIndic(105)).toBe('١٠٥');
  });
  it('يقبل كل إجابات المجموعة المفتوحة', () => {
    const m: AnswerMatcher = { kind: 'set', values: [31, 32, 33] };
    expect(matchAnswer(m, '٣٢').correct).toBe(true);
    expect(matchAnswer(m, '30').correct).toBe(false);
    expect(matchAnswer({ kind: 'range', min: 1, max: 9 }, 9).correct).toBe(true);
    expect(matchAnswer({ kind: 'exact', value: 5 }, 'x').correct).toBe(false);
  });
});

function attempt(partial: Partial<AttemptEvent>): AttemptEvent {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    sessionId: 's1',
    childId: 'c1',
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'missing_cell',
    seed: 1,
    representation: 'pictorial',
    phase: 'independent',
    source: 'app',
    givenAnswer: '1',
    firstTryCorrect: true,
    attemptsCount: 1,
    hintsUsed: 0,
    responseMs: 1000,
    isReview: false,
    clientTs: 1,
    synced: 0,
    ...partial,
  };
}

describe('محرك الإتقان', () => {
  it('بلا محاولات: لم يُقيَّم', () => {
    expect(assessSkill(HUNDRED_SQUARE_SKILL, []).state).toBe('not_assessed');
  });
  it('محاولات التوجيه لا تُحتسب في الاستقلال لكنها تجعل الحالة "يتعلم بمساعدة"', () => {
    const events = [attempt({ phase: 'guided', hintsUsed: 2 })];
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.state).toBe('learning_with_help');
    expect(a.stats.counted).toBe(0);
  });
  it('جلسة واحدة فقط لا تكفي للاستقلال', () => {
    const events = Array.from({ length: 10 }, (_, i) => attempt({ id: `e${i}`, clientTs: i, representation: i % 2 ? 'abstract' : 'pictorial' }));
    expect(assessSkill(HUNDRED_SQUARE_SKILL, events).state).toBe('learning_with_help');
  });
  it('جلستان وتمثيلان و8 من 10 صحيحة بلا تلميح = يحل مستقلًا', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      attempt({ id: `e${i}`, clientTs: i, sessionId: i < 5 ? 's1' : 's2', representation: i % 2 ? 'abstract' : 'pictorial', firstTryCorrect: i !== 3 && i !== 7 }),
    );
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.state).toBe('independent');
    expect(a.evidenceIds).toHaveLength(10);
  });
  it('مراجعة فاشلة تعيد المهارة إلى "يحتاج مراجعة"، ومراجعة ناجحة بعد الاستقلال = يحتفظ', () => {
    const base = Array.from({ length: 10 }, (_, i) =>
      attempt({ id: `e${i}`, clientTs: i, sessionId: i < 5 ? 's1' : 's2', representation: i % 2 ? 'abstract' : 'pictorial' }),
    );
    const failed = [...base, attempt({ id: 'r1', clientTs: 20, isReview: true, phase: 'review', firstTryCorrect: false })];
    expect(assessSkill(HUNDRED_SQUARE_SKILL, failed).state).toBe('needs_review');
    const passed = [...base, attempt({ id: 'r1', clientTs: 20, isReview: true, phase: 'review', firstTryCorrect: true })];
    expect(assessSkill(HUNDRED_SQUARE_SKILL, passed).state).toBe('retained');
  });
  it('ملاحظات الأب لا تدخل في حساب الاستقلال', () => {
    const events = Array.from({ length: 10 }, (_, i) => attempt({ id: `p${i}`, clientTs: i, source: 'parent_obs', sessionId: `s${i}`, representation: 'abstract' }));
    expect(assessSkill(HUNDRED_SQUARE_SKILL, events, DEFAULT_MASTERY_RULES).state).toBe('not_assessed');
  });
});

describe('مولدات لوحة المائة', () => {
  const variants: HundredSquareVariant[] = ['missing_cell', 'ten_more_less', 'one_more_less', 'between_decades', 'midpoint', 'locate'];
  it('كل الأنواع حتمية وكل الإجابات المتوقعة داخل 1..100', () => {
    for (const v of variants) {
      for (let seed = 1; seed <= 300; seed++) {
        const q1 = generateHundredSquareQuestion(v, seed);
        const q2 = generateHundredSquareQuestion(v, seed);
        expect(q1.promptAr).toBe(q2.promptAr);
        expect(q1.matcher).toEqual(q2.matcher);
        const values = q1.matcher.kind === 'exact' ? [q1.matcher.value] : q1.matcher.kind === 'set' ? q1.matcher.values : [q1.matcher.min, q1.matcher.max];
        for (const n of values) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(100);
        }
        expect(q1.hints).toHaveLength(3);
      }
    }
  });
  it('الخانة الناقصة: كل الخانات المعروضة داخل اللوحة والناقصة ليست معروضة', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateHundredSquareQuestion('missing_cell', seed);
      const sq = q.square!;
      expect(sq.reveal).not.toContain(sq.hiddenCell);
      for (const c of sq.reveal) {
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(100);
        // الخانات المعروضة مجاورة للخانة الناقصة أو لبعضها (شكل متصل)
        expect(Math.abs(c - sq.hiddenCell!) === 1 || Math.abs(c - sq.hiddenCell!) === 10 || Math.abs(c - sq.hiddenCell!) === 11 || Math.abs(c - sq.hiddenCell!) === 9 || Math.abs(c - sq.hiddenCell!) === 20 || Math.abs(c - sq.hiddenCell!) === 2).toBe(true);
      }
    }
  });
  it('التغذية الراجعة تميز خطأ الصف وخطأ الجار وقلب الرقمين', () => {
    const q = generateHundredSquareQuestion('ten_more_less', 5);
    const expected = (q.matcher as { kind: 'exact'; value: number }).value;
    expect(q.feedbackFor(expected)).toBe('أحسنت!');
    expect(q.feedbackFor(expected + 10)).toContain('صف');
    expect(q.feedbackFor(expected + 1)).toContain('جاره');
  });
  it('بين العقدين يقبل تسعة أعداد وليس العقدين', () => {
    const q = generateHundredSquareQuestion('between_decades', 11);
    const m = q.matcher as { kind: 'set'; values: number[] };
    expect(m.values).toHaveLength(9);
    expect(q.feedbackFor(m.values[0] - 1)).toContain('العقد');
  });
  it('الصف والعمود', () => {
    expect(rowOf(1)).toBe(1);
    expect(rowOf(10)).toBe(1);
    expect(rowOf(11)).toBe(2);
    expect(colOf(10)).toBe(10);
    expect(colOf(63)).toBe(3);
  });
});
