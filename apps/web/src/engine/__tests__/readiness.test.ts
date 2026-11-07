// اختبارات بوابة التمثيل: يبقى بالحركة حتى 4 نظيفة من 5، ويهبط بعد 3 أخطاء، وخط الأساس لا يُحتسب
import { describe, expect, it } from 'vitest';
import { computeReadiness } from '../readiness';
import { gateEntry, type PoolEntry } from '../hundredSquare';
import type { AttemptEvent, RepresentationType } from '../mastery';

function ev(i: number, representation: RepresentationType, clean: boolean, correct = clean, extra: Partial<AttemptEvent> = {}): AttemptEvent {
  return {
    id: `e${i}`,
    sessionId: 's',
    childId: 'c',
    skillCode: 'K',
    templateCode: 'HUNDRED_SQUARE',
    variant: 'ten_more_less',
    seed: i,
    representation,
    inputMode: representation === 'concrete' ? 'move' : 'numpad',
    phase: 'independent',
    source: 'app',
    givenAnswer: '1',
    correct,
    firstTryCorrect: clean,
    attemptsCount: clean ? 1 : 2,
    hintsUsed: 0,
    errorTag: clean ? 'none' : 'off_by_ten',
    responseMs: 5000,
    firstResponseMs: 2000,
    hesitationMs: 0,
    audioReplays: 0,
    hintSuggested: false,
    localDay: '2026-11-07',
    isReview: false,
    clientTs: i,
    synced: 0,
    ...extra,
  };
}

describe('بوابة التمثيل', () => {
  it('بلا بيانات: محسوس', () => {
    expect(computeReadiness([]).ten_more_less).toBe('concrete');
  });
  it('خط الأساس المجرد لا يرفع المستوى', () => {
    const events = Array.from({ length: 5 }, (_, i) => ev(i, 'abstract', true, true, { phase: 'baseline' }));
    expect(computeReadiness(events).ten_more_less).toBe('concrete');
  });
  it('4 نظيفة من 5 بالحركة ← صوري، ثم 4 نظيفة باللوحة ← مجرد', () => {
    const concrete = [ev(1, 'concrete', true), ev(2, 'concrete', false), ev(3, 'concrete', true), ev(4, 'concrete', true), ev(5, 'concrete', true)];
    expect(computeReadiness(concrete).ten_more_less).toBe('pictorial');
    const pictorial = [...concrete, ev(6, 'pictorial', true), ev(7, 'pictorial', true), ev(8, 'pictorial', true), ev(9, 'pictorial', true)];
    expect(computeReadiness(pictorial).ten_more_less).toBe('abstract');
  });
  it('إجابة بتلميح ليست نظيفة ولا ترفع المستوى', () => {
    const events = Array.from({ length: 5 }, (_, i) => ev(i, 'concrete', true, true, { hintsUsed: 1 }));
    expect(computeReadiness(events).ten_more_less).toBe('concrete');
  });
  it('3 أخطاء من آخر 5 في المستوى الحالي تُهبطه', () => {
    const up = [ev(1, 'concrete', true), ev(2, 'concrete', true), ev(3, 'concrete', true), ev(4, 'concrete', true)];
    const down = [...up, ev(5, 'pictorial', false), ev(6, 'pictorial', true), ev(7, 'pictorial', false), ev(8, 'pictorial', false)];
    expect(computeReadiness(up).ten_more_less).toBe('pictorial');
    expect(computeReadiness(down).ten_more_less).toBe('concrete');
  });
  it('الأنواع الأخرى لا تتأثر بالبوابة، والمجرد يُخفض إلى المستوى المسموح', () => {
    const abstract: PoolEntry = { variant: 'ten_more_less', mode: 'numpad', showSquare: false };
    expect(gateEntry(abstract, {})).toEqual({ variant: 'ten_more_less', mode: 'move', showSquare: true });
    expect(gateEntry(abstract, { ten_more_less: 'pictorial' })).toEqual({ variant: 'ten_more_less', mode: 'numpad', showSquare: true });
    expect(gateEntry(abstract, { ten_more_less: 'abstract' })).toEqual(abstract);
    const locate: PoolEntry = { variant: 'locate', mode: 'cell', showSquare: true };
    expect(gateEntry(locate, {})).toEqual(locate);
  });
});
