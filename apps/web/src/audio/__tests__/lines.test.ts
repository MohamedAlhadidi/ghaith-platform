// اختبارات سجل الصوت: معرّفات فريدة، وكل مقطع يستخدمه المحرك (عبر 1000 بذرة لكل نوع) موجود في السجل
import { describe, expect, it } from 'vitest';
import { allLines, totalChars } from '../lines';
import { isNumId } from '../phrases';
import { generateHundredSquareQuestion, type HundredSquareVariant } from '../../engine/hundredSquare';
import { SCRIPT } from '../../avatar/script';

const variants: HundredSquareVariant[] = ['missing_cell', 'ten_more_less', 'one_more_less', 'between_decades', 'midpoint', 'locate', 'column_jumps'];

describe('سجل الصوت', () => {
  const lines = allLines('غيث');
  const ids = new Set(lines.map((l) => l.id));

  it('معرّفات فريدة، وبالاسم مُثبّتًا، وحجم كلي صغير', () => {
    expect(ids.size).toBe(lines.length);
    expect(lines.some((l) => l.textAr.includes('{name}'))).toBe(false);
    expect(lines.find((l) => l.id === 'c.welcome.1')?.textAr).toContain('غيث');
    expect(totalChars(lines)).toBeLessThan(20000);
    expect(lines.filter((l) => l.group === 'number')).toHaveLength(101);
  });

  it('كل جمل الرفيق لها مقطع', () => {
    for (const options of Object.values(SCRIPT)) for (const o of options) expect(ids.has(o.id)).toBe(true);
  });

  it('كل مقطع يستخدمه المحرك موجود: الأسئلة والتلميحات والشرح والتغذية الراجعة', () => {
    const check = (part: string, where: string) => {
      expect(ids.has(part) || isNumId(part), `${where}: ${part}`).toBe(true);
    };
    for (const v of variants) {
      for (const mode of ['move', 'numpad'] as const) {
        for (let seed = 1; seed <= 1000; seed++) {
          const q = generateHundredSquareQuestion(v, seed, { mode, showSquare: seed % 2 === 0 });
          expect(q.audioParts.length).toBeGreaterThan(0);
          for (const p of q.audioParts) check(p, `${q.id} prompt`);
          for (const p of q.explainParts) check(p, `${q.id} explain`);
          for (const h of q.hints) {
            const parts = h.audioParts ?? (h.audioId ? [h.audioId] : []);
            expect(parts.length, `${q.id} hint without audio`).toBeGreaterThan(0);
            for (const p of parts) check(p, `${q.id} hint`);
          }
          // كل التغذية الراجعة الممكنة لها مقطع
          for (const given of [null, 0, 1, 50, 99, 100, 101]) {
            const e = q.evaluate(given);
            check(e.audioId, `${q.id} feedback ${given}`);
            expect(e.feedbackAr.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
