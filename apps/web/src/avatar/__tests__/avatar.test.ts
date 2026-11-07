// اختبارات الرفيق: قصر الجمل، المراقب، قواعد التكيّف، وملخص الملاحظات
import { describe, expect, it } from 'vitest';
import { line, SCRIPT, wordCount, type Situation } from '../script';
import { QuestionObserver } from '../observer';
import { decideAdaptation, DEFAULT_ADAPT_RULES, type RecentAttempt } from '../adapt';
import { progressSinceBaseline, summarizeSession } from '../insights';
import type { AttemptEvent } from '../../engine/mastery';

describe('نصوص الرفيق', () => {
  it('كل جملة حتى ثماني كلمات ولها معرّف صوت فريد', () => {
    const ids = new Set<string>();
    for (const [situation, lines] of Object.entries(SCRIPT)) {
      for (const l of lines) {
        expect(wordCount(l.textAr.replace('{name}', 'غيث')), `${situation}: ${l.textAr}`).toBeLessThanOrEqual(8);
        expect(ids.has(l.id)).toBe(false);
        ids.add(l.id);
      }
    }
  });
  it('يضع الاسم ويختار بالبذرة بثبات', () => {
    const a = line('welcome', 3, 'سالم');
    expect(a.textAr).toContain('سالم');
    expect(line('welcome', 3, 'سالم')).toEqual(a);
    const situations = Object.keys(SCRIPT) as Situation[];
    for (const s of situations) expect(line(s, 1).textAr.includes('{name}')).toBe(false);
  });
});

describe('مراقب السؤال', () => {
  it('يقيس أول فعل وأطول تردد وإعادات السماع', () => {
    const o = new QuestionObserver(1000);
    expect(o.shouldSuggestHint(8000, 5000)).toBe(false);
    expect(o.shouldSuggestHint(8000, 9500)).toBe(true);
    o.markSuggested();
    expect(o.shouldSuggestHint(8000, 20000)).toBe(false);
    o.action(10000);
    o.replay(11000);
    o.action(16000);
    const s = o.snapshot(17000);
    expect(s.firstResponseMs).toBe(9000);
    expect(s.hesitationMs).toBe(9000);
    expect(s.audioReplays).toBe(1);
    expect(s.responseMs).toBe(16000);
    expect(s.hintSuggested).toBe(true);
  });
});

function r(partial: Partial<RecentAttempt>): RecentAttempt {
  return { phase: 'independent', correct: true, firstTryCorrect: true, hintsUsed: 0, errorTag: 'none', firstResponseMs: 3000, representation: 'pictorial', ...partial };
}

describe('قواعد التكيّف', () => {
  it('خطآن متتاليان بالوسم نفسه ← تلميح تلقائي وسؤال أسهل', () => {
    const d = decideAdaptation([r({}), r({ correct: false, firstTryCorrect: false, errorTag: 'confused_step' }), r({ correct: false, firstTryCorrect: false, errorTag: 'confused_step' })], 3);
    expect(d?.kind).toBe('auto_hint_then_easier');
  });
  it('خطآن بوسمين مختلفين أو "أخرى" لا يكفيان', () => {
    expect(decideAdaptation([r({ firstTryCorrect: false, errorTag: 'confused_step' }), r({ firstTryCorrect: false, errorTag: 'off_by_one' })], 3)).toBeNull();
    expect(decideAdaptation([r({ firstTryCorrect: false, errorTag: 'other' }), r({ firstTryCorrect: false, errorTag: 'other' })], 3)).toBeNull();
  });
  it('ثلاث إجابات نظيفة سريعة ← أصعب، وليس إن كانت كلها مجردة أصلًا', () => {
    expect(decideAdaptation([r({}), r({}), r({})], 3)?.kind).toBe('harder');
    expect(decideAdaptation([r({ representation: 'abstract' }), r({ representation: 'abstract' }), r({ representation: 'abstract' })], 3)).toBeNull();
    expect(decideAdaptation([r({}), r({}), r({ firstResponseMs: 9000 })], 3)).toBeNull();
    expect(decideAdaptation([r({ phase: 'guided' }), r({ phase: 'guided' }), r({ phase: 'guided' })], 3)).toBeNull();
  });
  it('الإرهاق: ثلاثة أخطاء من آخر أربعة بعد ثماني دقائق ← اقتراح التوقف، وقبلها لا', () => {
    const tired = [r({}), r({ correct: false }), r({ correct: false }), r({}), r({ correct: false })];
    expect(decideAdaptation(tired, 9)?.kind).toBe('suggest_stop');
    expect(decideAdaptation(tired, 4)?.kind).not.toBe('suggest_stop');
    expect(DEFAULT_ADAPT_RULES.fatigueAfterMinutes).toBe(8);
  });
  it('خط الأساس والتحقق لا يتكيفان', () => {
    expect(decideAdaptation([r({ phase: 'check', correct: false, errorTag: 'off_by_one' }), r({ phase: 'check', correct: false, errorTag: 'off_by_one' })], 3)).toBeNull();
  });
});

function ev(partial: Partial<AttemptEvent>): AttemptEvent {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    sessionId: 'S',
    childId: 'c',
    skillCode: 'K',
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
    responseMs: 3000,
    firstResponseMs: 2000,
    hesitationMs: 1000,
    audioReplays: 0,
    hintSuggested: false,
    localDay: '2026-11-07',
    isReview: false,
    clientTs: 1,
    synced: 0,
    ...partial,
  };
}

describe('ملاحظات الرفيق', () => {
  it('يلخص الدقة ونمط الخطأ المتكرر والتردد مع اقتراح ورقي', () => {
    const events = [
      ev({ clientTs: 1, phase: 'baseline', correct: false, firstTryCorrect: false, errorTag: 'confused_step' }),
      ev({ clientTs: 2, phase: 'guided', hintsUsed: 1 }),
      ev({ clientTs: 3 }),
      ev({ clientTs: 4, correct: false, firstTryCorrect: false, errorTag: 'confused_step', hintSuggested: true, hesitationMs: 12000 }),
      ev({ clientTs: 5, correct: true, firstTryCorrect: false, attemptsCount: 2, errorTag: 'confused_step' }),
      ev({ clientTs: 6, phase: 'check' }),
    ];
    const s = summarizeSession('S', events);
    expect(s.baselineTotal).toBe(1);
    expect(s.countedTotal).toBe(4);
    expect(s.countedClean).toBe(2);
    expect(s.topErrors[0]).toEqual({ tag: 'confused_step', count: 2 });
    const kinds = s.insights.map((i) => i.kind);
    expect(kinds).toContain('baseline');
    expect(kinds).toContain('accuracy');
    expect(kinds).toContain('error_pattern');
    expect(kinds).toContain('hesitation');
    expect(kinds).toContain('hints');
    expect(s.insights.find((i) => i.kind === 'error_pattern')?.paperAr).toBeTruthy();
  });
  it('يرصد تراجع الدقة في النصف الثاني', () => {
    const events = Array.from({ length: 8 }, (_, i) => ev({ clientTs: i + 1, correct: i < 4, firstTryCorrect: i < 4, errorTag: i < 4 ? 'none' : 'other' }));
    expect(summarizeSession('S', events).insights.some((i) => i.kind === 'fatigue')).toBe(true);
  });
  it('يقارن آخر تحقق بخط الأساس الأول', () => {
    const events = [
      ev({ clientTs: 1, sessionId: 'A', phase: 'baseline', correct: false, firstTryCorrect: false }),
      ev({ clientTs: 2, sessionId: 'A', phase: 'baseline', correct: false, firstTryCorrect: false }),
      ev({ clientTs: 3, sessionId: 'B', phase: 'check' }),
      ev({ clientTs: 4, sessionId: 'B', phase: 'check' }),
    ];
    const p = progressSinceBaseline(events);
    expect(p?.textAr).toContain('تحسّن');
    expect(progressSinceBaseline([])).toBeNull();
  });
});
