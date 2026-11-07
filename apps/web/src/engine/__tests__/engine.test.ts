// اختبارات طبقة المنطق: الحتمية، التطبيع، المطابقة، وسوم الأخطاء، الإتقان، ومولدات خريطة المائة عبر 1000 بذرة
import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '../rng';
import { matchAnswer, normalizeDigits, parseIntegerAnswer, toArabicIndic, type AnswerMatcher } from '../answers';
import { assessSkill, DEFAULT_MASTERY_RULES, localDayOf, validateRules, type AttemptEvent } from '../mastery';
import { colOf, easierEntry, generateFromEntry, generateHundredSquareQuestion, harderEntry, HUNDRED_SQUARE_SKILL, PHASE_POOLS, rowOf, type HundredSquareVariant } from '../hundredSquare';
import { classifyLocateError, classifyNearError, classifyStepError } from '../errors';
import { wordCount } from '../../avatar/script';

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

describe('وسوم الأخطاء', () => {
  it('خطوة بدل قفزة، وعكس الاتجاه، تُقاس من الأساس لا من المتوقع', () => {
    const ctx = { base: 47, step: 10 as const, direction: 'more' as const };
    expect(classifyStepError(57, 57, ctx)).toBe('none');
    expect(classifyStepError(48, 57, ctx)).toBe('confused_step');
    expect(classifyStepError(37, 57, ctx)).toBe('wrong_direction');
    expect(classifyStepError(75, 57, ctx)).toBe('reversed_digits');
    expect(classifyStepError(56, 57, ctx)).toBe('off_by_one');
    expect(classifyStepError(67, 57, ctx)).toBe('off_by_ten');
    expect(classifyStepError(null, 57, ctx)).toBe('not_a_number');
    expect(classifyStepError(570, 57, ctx)).toBe('out_of_range');
  });
  it('لا يُتهم بقلب الرقمين عند العقود، ويُرصد إسقاط الصفر', () => {
    expect(classifyNearError(5, 50)).toBe('dropped_zero');
    expect(classifyNearError(51, 50)).toBe('off_by_one');
    expect(classifyStepError(6, 60, { base: 50, step: 10, direction: 'more' })).toBe('dropped_zero');
  });
  it('تحديد الموضع: الصف أو العمود الصحيح', () => {
    expect(classifyLocateError(65, 63)).toBe('same_row');
    expect(classifyLocateError(43, 63)).toBe('same_column');
    expect(classifyLocateError(11, 63)).toBe('other');
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
    inputMode: 'numpad',
    phase: 'independent',
    source: 'app',
    givenAnswer: '1',
    correct: true,
    firstTryCorrect: true,
    attemptsCount: 1,
    hintsUsed: 0,
    errorTag: 'none',
    responseMs: 1000,
    firstResponseMs: 500,
    hesitationMs: 0,
    audioReplays: 0,
    hintSuggested: false,
    localDay: '2026-11-07',
    isReview: false,
    clientTs: 1,
    synced: 0,
    ...partial,
  };
}

/** عشر محاولات نظيفة على يومين وبتمثيلين */
function tenClean(overrides: (i: number) => Partial<AttemptEvent> = () => ({})): AttemptEvent[] {
  return Array.from({ length: 10 }, (_, i) =>
    attempt({ id: `e${i}`, clientTs: i, sessionId: i < 5 ? 's1' : 's2', localDay: i < 5 ? '2026-11-07' : '2026-11-08', representation: i % 2 ? 'abstract' : 'pictorial', ...overrides(i) }),
  );
}

describe('محرك الإتقان', () => {
  it('بلا محاولات: لم يُقيَّم', () => {
    expect(assessSkill(HUNDRED_SQUARE_SKILL, []).state).toBe('not_assessed');
  });
  it('خط الأساس وحده لا يغيّر الحالة', () => {
    const a = assessSkill(HUNDRED_SQUARE_SKILL, [attempt({ phase: 'baseline', correct: false, firstTryCorrect: false })]);
    expect(a.state).toBe('not_assessed');
    expect(a.stats.baselineAttempts).toBe(1);
  });
  it('من فشل في كل شيء لا يُعدّ "يتعلم بمساعدة" بل "يحتاج دعمًا"', () => {
    const events = Array.from({ length: 5 }, (_, i) => attempt({ id: `f${i}`, correct: false, firstTryCorrect: false, attemptsCount: 3, errorTag: 'other' }));
    expect(assessSkill(HUNDRED_SQUARE_SKILL, events).state).toBe('needs_support');
  });
  it('محاولات التوجيه لا تُحتسب لكنها تجعل الحالة "يتعلم بمساعدة" إن أصاب', () => {
    const events = [attempt({ phase: 'guided', hintsUsed: 2 })];
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.state).toBe('learning_with_help');
    expect(a.stats.counted).toBe(0);
  });
  it('يوم واحد لا يكفي للاستقلال حتى لو كانت كل الإجابات نظيفة', () => {
    const events = tenClean(() => ({ localDay: '2026-11-07' }));
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.state).toBe('learning_with_help');
    expect(a.reasonAr).toContain('يوم آخر');
  });
  it('أقل من نافذة كاملة لا يكفي حتى لو كانت كلها صحيحة', () => {
    expect(assessSkill(HUNDRED_SQUARE_SKILL, tenClean().slice(0, 7)).state).toBe('learning_with_help');
  });
  it('إجابة صحيحة بعد تلميح ليست نظيفة', () => {
    const events = tenClean((i) => (i < 3 ? { hintsUsed: 1 } : {}));
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.stats.cleanCorrect).toBe(7);
    expect(a.state).toBe('learning_with_help');
  });
  it('يومان وتمثيلان و8 من 10 نظيفة = يحل مستقلًا', () => {
    const events = tenClean((i) => (i === 3 || i === 7 ? { firstTryCorrect: false, correct: true, attemptsCount: 2, errorTag: 'off_by_one' } : {}));
    const a = assessSkill(HUNDRED_SQUARE_SKILL, events);
    expect(a.state).toBe('independent');
    expect(a.evidenceIds).toHaveLength(10);
  });
  it('مراجعة فاشلة تعيد المهارة إلى "يحتاج مراجعة"، ومراجعة ناجحة بعد الاستقلال = يحتفظ', () => {
    const base = tenClean();
    const failed = [...base, attempt({ id: 'r1', clientTs: 20, isReview: true, phase: 'review', firstTryCorrect: false, correct: false })];
    expect(assessSkill(HUNDRED_SQUARE_SKILL, failed).state).toBe('needs_review');
    const passed = [...base, attempt({ id: 'r1', clientTs: 20, isReview: true, phase: 'review', firstTryCorrect: true })];
    expect(assessSkill(HUNDRED_SQUARE_SKILL, passed).state).toBe('retained');
  });
  it('ملاحظات الأب لا تدخل في حساب الاستقلال', () => {
    const events = tenClean(() => ({ source: 'parent_obs' }));
    expect(assessSkill(HUNDRED_SQUARE_SKILL, events, DEFAULT_MASTERY_RULES).state).toBe('not_assessed');
  });
  it('التحقق من القواعد يرفض القيم المستحيلة', () => {
    expect(validateRules(DEFAULT_MASTERY_RULES).ok).toBe(true);
    expect(validateRules({ ...DEFAULT_MASTERY_RULES, window: 2 }).ok).toBe(false);
    expect(validateRules({ ...DEFAULT_MASTERY_RULES, independent: { ...DEFAULT_MASTERY_RULES.independent, minCleanCorrect: 11 } }).ok).toBe(false);
    expect(validateRules('x').ok).toBe(false);
  });
  it('اليوم المحلي بصيغة ثابتة', () => {
    expect(localDayOf(new Date(2026, 10, 7, 23, 59).getTime())).toBe('2026-11-07');
  });
});

describe('مولدات خريطة المائة (1000 بذرة لكل نوع)', () => {
  const variants: HundredSquareVariant[] = ['missing_cell', 'ten_more_less', 'one_more_less', 'between_decades', 'midpoint', 'locate'];
  const valuesOf = (m: AnswerMatcher) => (m.kind === 'exact' ? [m.value] : m.kind === 'set' ? m.values : [m.min, m.max]);

  it('حتمية، والإجابات داخل 1..100، وكل النصوص حتى ثماني كلمات، وحتى ثلاثة تلميحات', () => {
    for (const v of variants) {
      for (let seed = 1; seed <= 1000; seed++) {
        const q1 = generateHundredSquareQuestion(v, seed);
        const q2 = generateHundredSquareQuestion(v, seed);
        expect(q1.promptAr).toBe(q2.promptAr);
        expect(q1.matcher).toEqual(q2.matcher);
        for (const n of valuesOf(q1.matcher)) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(100);
        }
        expect(q1.hints.length).toBeLessThanOrEqual(3);
        expect(q1.hints.length).toBeGreaterThanOrEqual(1);
        expect(wordCount(q1.promptAr)).toBeLessThanOrEqual(8);
        expect(wordCount(q1.explainAr)).toBeLessThanOrEqual(8);
        for (const h of q1.hints) expect(wordCount(h.textAr)).toBeLessThanOrEqual(8);
        expect(q1.promptParts.length).toBeGreaterThan(0);
        for (const part of q1.promptParts) if (part.kind === 'number' && part.tone !== 'unknown') { expect(part.value).toBeGreaterThanOrEqual(1); expect(part.value).toBeLessThanOrEqual(100); }
        for (const c of q1.solutionPath) {
          expect(c).toBeGreaterThanOrEqual(1);
          expect(c).toBeLessThanOrEqual(100);
        }
        // الإجابة المتوقعة تُصنَّف "صحيحة" دائمًا
        expect(q1.evaluate(valuesOf(q1.matcher)[0]).tag).toBe('none');
      }
    }
  });

  it('وضع الحركة: الأفاتار يبدأ من الأساس والتمثيل محسوس؛ الكتابة بلا خريطة مجردة', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const move = generateHundredSquareQuestion('ten_more_less', seed, { mode: 'move' });
      expect(move.inputMode).toBe('move');
      expect(move.representation).toBe('concrete');
      expect(move.square?.start).toBe(move.solutionPath[0]);
      const abstract = generateHundredSquareQuestion('one_more_less', seed, { mode: 'numpad', showSquare: false });
      expect(abstract.square).toBeUndefined();
      expect(abstract.representation).toBe('abstract');
      // التلميح الأول للمجرد يكشف الخريطة قبل أن يشير إليها
      expect(abstract.hints[0].revealSquare).toBe(true);
    }
  });

  it('الخانة الممحوّة: الخانات المعروضة متصلة بها، والعقود تظهر فيها', () => {
    let decades = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const q = generateHundredSquareQuestion('missing_cell', seed);
      const sq = q.square!;
      expect(sq.reveal).not.toContain(sq.hiddenCell);
      if (sq.hiddenCell! % 10 === 0) decades++;
      for (const c of sq.reveal) {
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(100);
        const d = Math.abs(c - sq.hiddenCell!);
        expect([1, 2, 9, 10, 11, 20]).toContain(d);
        // الجيران الأفقيون في الصف نفسه
        if (d === 1) expect(rowOf(c)).toBe(rowOf(sq.hiddenCell!));
      }
    }
    expect(decades).toBeGreaterThan(30);
  });

  it('حدود الصف في "واحد أكثر" تُذكر صراحة في التلميح', () => {
    let found = false;
    for (let seed = 1; seed <= 1000 && !found; seed++) {
      const q = generateHundredSquareQuestion('one_more_less', seed, { mode: 'move' });
      const base = q.solutionPath[0];
      const expected = q.solutionPath[1];
      if (expected === base + 1 && base % 10 === 0) {
        found = true;
        expect(q.hints[1].textAr).toContain('الصف');
      }
    }
    expect(found).toBe(true);
  });

  it('بين العقدين يقبل تسعة أعداد ويرفض العقدين', () => {
    const q = generateHundredSquareQuestion('between_decades', 11);
    const m = q.matcher as { kind: 'set'; values: number[] };
    expect(m.values).toHaveLength(9);
    expect(q.evaluate(m.values[0] - 1).tag).toBe('on_boundary');
  });

  it('الأسهل والأصعب يتدرجان بين الحركة والخريطة والمجرد', () => {
    const abstract = { variant: 'ten_more_less' as const, mode: 'numpad' as const, showSquare: false };
    const pictorial = easierEntry(abstract);
    expect(pictorial.showSquare).toBe(true);
    const move = easierEntry(pictorial);
    expect(move.mode).toBe('move');
    expect(easierEntry(move)).toEqual(move);
    expect(harderEntry(move)).toEqual(pictorial);
    expect(harderEntry(pictorial)).toEqual(abstract);
    const q = generateFromEntry(move, 5);
    expect(q.inputMode).toBe('move');
  });

  it('كل مجمعات المراحل تولّد أسئلة صالحة', () => {
    for (const pool of Object.values(PHASE_POOLS)) for (const e of pool) expect(generateFromEntry(e, 3).skillCode).toBe(HUNDRED_SQUARE_SKILL);
  });

  it('الصف والعمود', () => {
    expect(rowOf(1)).toBe(1);
    expect(rowOf(10)).toBe(1);
    expect(rowOf(11)).toBe(2);
    expect(colOf(10)).toBe(10);
    expect(colOf(63)).toBe(3);
  });
});
