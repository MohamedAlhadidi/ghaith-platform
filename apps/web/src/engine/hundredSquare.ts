// قالب "لوحة المائة": مولدات أسئلة الدرس الأول (ص 4–5) بمهارة MATH.G2.S1.CA01-2
// كل النصوص قصيرة (حتى ثماني كلمات) وبمصطلح واحد ثابت لكل مفهوم:
// "قفزة" = عشرة، "خطوة" = واحد، "أكثر" = النزول أو التقدم، "أقل" = الصعود أو الرجوع، "العقد" = العدد المنتهي بصفر.
// كل نص له مقاطع صوتية مركّبة (معرّفات من audio/phrases.ts ومقاطع الأعداد) حتى يُنطق من ملفات مسجّلة دون اتصال.

import { toArabicIndic } from './answers';
import type { AnswerMatcher } from './answers';
import { classifyBetweenError, classifyLocateError, classifyMidpointError, classifyNearError, classifyStepError, type ErrorTag, type StepContext } from './errors';
import { createRng, type Rng } from './rng';
import type { Evaluation, GeneratedQuestion, InputMode, QuestionHint, SquareView } from './question';
import { PHRASES, num } from '../audio/phrases';

export const HUNDRED_SQUARE_SKILL = 'MATH.G2.S1.CA01-2';

export type HundredSquareVariant =
  | 'missing_cell' // أكمل الخانة الممحوّة في جزء من اللوحة
  | 'ten_more_less' // عشرة أكثر/أقل (قفزة)
  | 'one_more_less' // واحد أكثر/أقل (خطوة)
  | 'between_decades' // أي عدد بين عقدين (إجابات متعددة صحيحة)
  | 'midpoint' // منتصف عقدين
  | 'locate' // انقر على موضع العدد
  | 'column_jumps'; // تمرين: عدة قفزات إلى أسفل في العمود نفسه (العدّ بالعشرات)

const ar = toArabicIndic;

/** يبني عرض اللوحة بقيم افتراضية */
function square(partial: Partial<SquareView>): SquareView {
  return { showAll: false, reveal: [], highlight: [], clickable: false, ...partial };
}

/** الصف (1..10) والعمود (1..10) لعدد في اللوحة */
export function rowOf(n: number): number {
  return Math.ceil(n / 10);
}
export function colOf(n: number): number {
  return ((n - 1) % 10) + 1;
}

/** تغذية راجعة من معرّف مقطع ثابت */
function fb(id: string, tag: ErrorTag): Evaluation {
  return { tag, feedbackAr: PHRASES[id], audioId: id };
}

function genericFeedback(tag: ErrorTag): Evaluation {
  return fb(`fb.${tag}`, tag);
}

function stepFeedback(tag: ErrorTag, ctx: StepContext): Evaluation {
  if (tag === 'confused_step') return fb(ctx.step === 10 ? 'fb.confused_step.jump' : 'fb.confused_step.step', tag);
  if (tag === 'wrong_direction') return fb(ctx.direction === 'more' ? 'fb.wrong_direction.more' : 'fb.wrong_direction.less', tag);
  return genericFeedback(tag);
}

function makeId(variant: HundredSquareVariant, seed: number, mode: InputMode): string {
  return `HUNDRED_SQUARE:${variant}:${mode}:${seed}`;
}

type Shape = 'vertical' | 'horizontal' | 'plus' | 'corner';

/** يختار مرساة بحيث تبقى خانات الشكل داخل اللوحة؛ العقود (العمود 10) مسموحة في الأشكال الرأسية */
function anchorFor(rng: Rng, shape: Shape): number {
  const needUp = shape !== 'horizontal';
  const needDown = shape === 'vertical' || shape === 'plus';
  const needSide = shape !== 'vertical';
  const row = rng.int(needUp ? 2 : 1, needDown ? 9 : 10);
  const col = rng.int(needSide ? 2 : 1, needSide ? 9 : 10);
  return (row - 1) * 10 + col;
}

function missingCell(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const shape = rng.pick(['vertical', 'horizontal', 'plus', 'corner'] as const);
  const anchor = anchorFor(rng, shape);
  const cells: number[] =
    shape === 'vertical'
      ? [anchor - 10, anchor, anchor + 10]
      : shape === 'horizontal'
        ? [anchor - 1, anchor, anchor + 1]
        : shape === 'plus'
          ? [anchor - 10, anchor - 1, anchor, anchor + 1, anchor + 10]
          : [anchor - 10, anchor, anchor + 1];
  const hidden = rng.pick(cells);
  const reveal = cells.filter((c) => c !== hidden);
  const up = reveal.includes(hidden - 10) ? hidden - 10 : null;
  const down = reveal.includes(hidden + 10) ? hidden + 10 : null;
  const side = reveal.find((c) => c === hidden - 1 || c === hidden + 1) ?? null;
  const anchorCell = up ?? down ?? (side as number);
  const sideBefore = side !== null && (side as number) < hidden;

  // التلميح الأول: الجار المعروض والعملية؛ الثاني: السؤال الحسابي؛ الثالث: كشف اللوحة
  const hint1 =
    up !== null
      ? { textAr: `فوقها ${ar(up)}. قفزة أكثر: عشرة.`, parts: ['w.above_it', num(up), 'w.jump_more_ten'] }
      : down !== null
        ? { textAr: `تحتها ${ar(down)}. قفزة أقل: عشرة.`, parts: ['w.below_it', num(down), 'w.jump_less_ten'] }
        : sideBefore
          ? { textAr: `بجانبها ${ar(side as number)}. خطوة أكثر: واحد.`, parts: ['w.beside_it', num(side as number), 'w.step_more_one'] }
          : { textAr: `بجانبها ${ar(side as number)}. خطوة أقل: واحد.`, parts: ['w.beside_it', num(side as number), 'w.step_less_one'] };
  const hint2 =
    up !== null
      ? { textAr: `${ar(up)} وعشرة أكثر؟`, parts: [num(up), 'w.and_ten_more_q'] }
      : down !== null
        ? { textAr: `${ar(down)} وعشرة أقل؟`, parts: [num(down), 'w.and_ten_less_q'] }
        : sideBefore
          ? { textAr: `${ar(side as number)} وواحد أكثر؟`, parts: [num(side as number), 'w.and_one_more_q'] }
          : { textAr: `${ar(side as number)} وواحد أقل؟`, parts: [num(side as number), 'w.and_one_less_q'] };

  return {
    id: makeId('missing_cell', seed, 'numpad'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'missing_cell',
    seed,
    representation: 'pictorial',
    promptAr: PHRASES['hs.prompt.missing_cell'],
    promptParts: [
      { kind: 'text', textAr: 'الخانة الصفراء' },
      { kind: 'number', value: 0, tone: 'unknown' },
      { kind: 'text', textAr: 'ما العدد؟' },
    ],
    audioId: 'hs.prompt.missing_cell',
    audioParts: ['hs.prompt.missing_cell'],
    square: square({ showAll: false, reveal, hiddenCell: hidden }),
    inputMode: 'numpad',
    matcher: { kind: 'exact', value: hidden },
    hints: [
      { textAr: hint1.textAr, audioId: '', audioParts: hint1.parts, highlight: [anchorCell], arrow: { from: anchorCell, to: hidden, labelAr: up !== null ? '+١٠' : down !== null ? '−١٠' : sideBefore ? '+١' : '−١' } },
      { textAr: hint2.textAr, audioId: '', audioParts: hint2.parts, highlight: cells },
      { textAr: PHRASES['hs.hint.reveal'], audioId: 'hs.hint.reveal', revealSquare: true, highlight: [hidden] },
    ],
    explainAr: `العدد ${ar(hidden)}.`,
    explainParts: ['w.the_number', num(hidden)],
    solutionPath: [anchorCell, hidden],
    evaluate(given): Evaluation {
      return genericFeedback(classifyNearError(given, hidden));
    },
  };
}

function moreLess(seed: number, step: 1 | 10, mode: InputMode, showSquare: boolean): GeneratedQuestion {
  const rng = createRng(seed);
  const more = rng.next() < 0.5;
  const base = step === 10 ? rng.int(more ? 1 : 11, more ? 90 : 100) : rng.int(more ? 1 : 2, more ? 99 : 100);
  const expected = more ? base + step : base - step;
  const stepWord = step === 10 ? 'عشرة' : 'واحد';
  const dirWord = more ? 'أكثر' : 'أقل';
  const moveWord = step === 10 ? 'قفزة' : 'خطوة';
  const variant: HundredSquareVariant = step === 10 ? 'ten_more_less' : 'one_more_less';
  const opKey = `${step === 10 ? 'ten' : 'one'}_${more ? 'more' : 'less'}`;
  const opId = `op.${opKey}`;
  const ctx: StepContext = { base, step, direction: more ? 'more' : 'less' };
  const representation = mode === 'move' ? 'concrete' : showSquare ? 'pictorial' : 'abstract';
  // الصيغة المنطوقة فعلٌ أولًا وخطوة واحدة؛ والعرض البصري بطاقات: العدد ← العملية ← ؟
  const opText = `${stepWord} ${dirWord}`;
  const promptAr = mode === 'move' ? `أنت على ${ar(base)}. اذهب إلى ${opText}.` : `ما العدد؟ ${opText} من ${ar(base)}.`;
  const audioParts = mode === 'move' ? ['w.you_are_on', num(base), 'w.go_to', opId] : ['w.what_number', opId, 'w.of', num(base)];
  const promptParts: GeneratedQuestion['promptParts'] =
    mode === 'move'
      ? [
          { kind: 'text', textAr: 'اذهب إلى' },
          { kind: 'op', textAr: opText },
        ]
      : [
          { kind: 'number', value: base, tone: 'start' },
          { kind: 'op', textAr: opText },
          { kind: 'number', value: 0, tone: 'unknown' },
        ];
  const arrow = { from: base, to: expected, labelAr: `${more ? '+' : '−'}${ar(step)}` };
  // حدود الصف: الخطوة قد تنقل إلى صف جديد، وهذا يُقال صراحة
  const boundary =
    step === 1 && more && base % 10 === 0
      ? { textAr: `${ar(base)} آخر الصف. ${ar(expected)} أول الصف التالي.`, parts: [num(base), 'w.last_in_row', num(expected), 'w.first_next_row'] }
      : step === 1 && !more && base % 10 === 1
        ? { textAr: `${ar(base)} أول الصف. ${ar(expected)} آخر الصف السابق.`, parts: [num(base), 'w.first_in_row', num(expected), 'w.last_prev_row'] }
        : null;

  // سلّم التلميحات في وضع الحركة يتدرج: أي زوج من الأزرار؟ ← أي اتجاه؟ ← الكنز هنا. لا يُعطى الجواب في التلميح الأول
  const pulsePair = step === 10 ? 'jump' : 'step';
  const pulseExact = step === 10 ? (more ? 'jump_more' : 'jump_less') : more ? 'step_more' : 'step_less';
  const direction2 = step === 10 ? (more ? { textAr: 'إلى أسفل = أكثر.', parts: ['w.down_is_more'] } : { textAr: 'إلى أعلى = أقل.', parts: ['w.up_is_less'] }) : more ? { textAr: 'خطوة واحدة أكثر.', parts: ['w.one_step_more'] } : { textAr: 'خطوة واحدة أقل.', parts: ['w.one_step_less'] };
  const hints: QuestionHint[] =
    mode === 'move'
      ? [
          { textAr: `${stepWord} ${dirWord} = ${moveWord}. أي زر؟`, audioId: '', audioParts: [opId, step === 10 ? 'w.is_jump_which' : 'w.is_step_which'], highlight: [base], pulse: pulsePair },
          { textAr: (boundary ?? direction2).textAr, audioId: '', audioParts: (boundary ?? direction2).parts, highlight: [base, expected], arrow, pulse: pulseExact },
          { textAr: PHRASES['hs.hint.here'], audioId: 'hs.hint.here', highlight: [expected], pulse: pulseExact },
        ]
      : [
          { textAr: `ابحث عن ${ar(base)} في اللوحة.`, audioId: '', audioParts: ['w.find', num(base), 'w.in_board'], highlight: [base], revealSquare: true },
          { textAr: boundary?.textAr ?? `${moveWord} ${dirWord} = ${stepWord} ${dirWord}.`, audioId: '', audioParts: boundary?.parts ?? [`w.move_means.${opKey}`], highlight: [base, expected], arrow, revealSquare: true },
          { textAr: `${ar(base)} و${stepWord} ${dirWord}: ${ar(expected)}.`, audioId: '', audioParts: [num(base), 'w.and', opId, 'w.is', num(expected)], highlight: [expected], revealSquare: true },
        ];

  return {
    id: makeId(variant, seed, mode),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant,
    seed,
    representation,
    promptAr,
    promptParts,
    audioId: '',
    audioParts,
    square: mode === 'move' ? square({ showAll: true, start: base }) : showSquare ? square({ showAll: true, highlight: [base] }) : undefined,
    inputMode: mode,
    matcher: { kind: 'exact', value: expected },
    hints,
    explainAr: `${stepWord} ${dirWord} من ${ar(base)}: ${ar(expected)}.`,
    explainParts: [opId, 'w.of', num(base), 'w.is', num(expected)],
    solutionPath: [base, expected],
    evaluate(given): Evaluation {
      return stepFeedback(classifyStepError(given, expected, ctx), ctx);
    },
  };
}

/** تمرين القفز: عدة قفزات إلى أسفل في العمود نفسه؛ الهدف أن يرى الطفل أن كل قفزة تزيد عشرة وأن الآحاد لا تتغير */
function columnJumps(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const jumps = rng.int(2, 3);
  const row = rng.int(1, 10 - jumps);
  const col = rng.int(1, 10);
  const base = (row - 1) * 10 + col;
  const expected = base + 10 * jumps;
  const path = Array.from({ length: jumps + 1 }, (_, i) => base + 10 * i);
  const jumpsWord = jumps === 2 ? 'مرتين' : 'ثلاث مرات';
  return {
    id: makeId('column_jumps', seed, 'move'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'column_jumps',
    seed,
    representation: 'concrete',
    promptAr: `أنت على ${ar(base)}. اقفز إلى أسفل ${jumpsWord}.`,
    promptParts: [
      { kind: 'text', textAr: 'اضغط' },
      { kind: 'op', textAr: 'قفزة أكثر' },
      { kind: 'number', value: jumps, tone: 'start' },
      { kind: 'text', textAr: 'مرات' },
    ],
    audioId: '',
    audioParts: ['w.you_are_on', num(base), 'w.jump_down', jumps === 2 ? 'w.twice' : 'w.three_times'],
    square: square({ showAll: true, start: base, highlight: [] }),
    inputMode: 'move',
    matcher: { kind: 'exact', value: expected },
    hints: [
      { textAr: PHRASES['w.jump_more_this_button'], audioId: 'w.jump_more_this_button', highlight: [base], pulse: 'jump_more' },
      { textAr: `عدّ القفزات: ${path.slice(1).map(ar).join('، ')}.`, audioId: '', audioParts: ['w.count_jumps', ...path.slice(1).map(num)], highlight: path, pulse: 'jump_more' },
      { textAr: PHRASES['hs.hint.here'], audioId: 'hs.hint.here', highlight: [expected], pulse: 'jump_more' },
    ],
    explainAr: `${path.map(ar).join('، ')}.`,
    explainParts: path.map(num),
    solutionPath: path,
    evaluate(given): Evaluation {
      if (given === null) return genericFeedback('not_a_number');
      if (given === expected) return genericFeedback('none');
      if (given === base) return fb('fb.cj.no_move', 'off_by_ten');
      if (given < base) return fb('fb.cj.went_less', 'wrong_direction');
      if ((given - base) % 10 === 0) return fb('fb.cj.count_again', 'off_by_ten');
      return fb('fb.cj.step', 'confused_step');
    },
  };
}

function betweenDecades(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const low = rng.int(1, 9) * 10;
  const high = low + 10;
  const values = Array.from({ length: 9 }, (_, i) => low + 1 + i);
  return {
    id: makeId('between_decades', seed, 'cell'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'between_decades',
    seed,
    representation: 'pictorial',
    promptAr: `انقر على عدد بين ${ar(low)} و${ar(high)}.`,
    promptParts: [
      { kind: 'text', textAr: 'انقر على عدد بين' },
      { kind: 'number', value: low, tone: 'start' },
      { kind: 'text', textAr: 'و' },
      { kind: 'number', value: high, tone: 'start' },
    ],
    audioId: '',
    audioParts: ['w.tap_between', num(low), 'w.and', num(high)],
    square: square({ showAll: true, highlight: [low, high], clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'set', values },
    hints: [
      { textAr: PHRASES['hs.hint.between.1'], audioId: 'hs.hint.between.1', highlight: [low, high] },
      { textAr: PHRASES['hs.hint.between.2'], audioId: 'hs.hint.between.2', highlight: values },
      { textAr: PHRASES['hs.hint.between.3'], audioId: 'hs.hint.between.3', highlight: [low + 5] },
    ],
    explainAr: `بين ${ar(low)} و${ar(high)}: من ${ar(low + 1)} إلى ${ar(high - 1)}.`,
    explainParts: ['w.between', num(low), 'w.and', num(high), 'w.of', num(low + 1), 'w.to', num(high - 1)],
    solutionPath: [low, low + 5],
    evaluate(given): Evaluation {
      return genericFeedback(classifyBetweenError(given, low, high));
    },
  };
}

function midpoint(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const low = rng.int(1, 9) * 10;
  const high = low + 10;
  const mid = low + 5;
  return {
    id: makeId('midpoint', seed, 'cell'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'midpoint',
    seed,
    representation: 'pictorial',
    promptAr: `انقر على نقطة المنتصف بين ${ar(low)} و${ar(high)}.`,
    promptParts: [
      { kind: 'text', textAr: 'انقر على' },
      { kind: 'op', textAr: 'نقطة المنتصف' },
      { kind: 'text', textAr: 'بين' },
      { kind: 'number', value: low, tone: 'start' },
      { kind: 'text', textAr: 'و' },
      { kind: 'number', value: high, tone: 'start' },
    ],
    audioId: '',
    audioParts: ['w.tap_midpoint', num(low), 'w.and', num(high)],
    square: square({ showAll: true, highlight: [low, high], clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'exact', value: mid },
    hints: [
      { textAr: `المنتصف: خمس خطوات بعد ${ar(low)}.`, audioId: '', audioParts: ['w.midpoint_five_after', num(low)], highlight: [low] },
      { textAr: PHRASES['hs.hint.midpoint.2'], audioId: 'hs.hint.midpoint.2', highlight: [low + 1, low + 2, low + 3, low + 4, low + 5] },
      { textAr: PHRASES['hs.hint.midpoint.3'], audioId: 'hs.hint.midpoint.3', highlight: [mid] },
    ],
    explainAr: `منتصف ${ar(low)} و${ar(high)}: ${ar(mid)}.`,
    explainParts: ['w.midpoint_of', num(low), 'w.and', num(high), 'w.is', num(mid)],
    solutionPath: [low, low + 1, low + 2, low + 3, low + 4, mid],
    evaluate(given): Evaluation {
      return genericFeedback(classifyMidpointError(given, low, high));
    },
  };
}

function locate(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const target = rng.int(11, 100);
  const rowStart = (rowOf(target) - 1) * 10 + 1;
  return {
    id: makeId('locate', seed, 'cell'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'locate',
    seed,
    representation: 'pictorial',
    promptAr: `أين ${ar(target)}؟ انقر عليه.`,
    promptParts: [
      { kind: 'text', textAr: 'أين' },
      { kind: 'number', value: target, tone: 'start' },
      { kind: 'text', textAr: '؟ انقر عليه.' },
    ],
    audioId: '',
    audioParts: ['w.where', num(target), 'w.tap_it'],
    square: square({ showAll: true, clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'exact', value: target },
    hints: [
      { textAr: `ابدأ من صف ${ar(rowStart)}.`, audioId: '', audioParts: ['w.start_row', num(rowStart)], highlight: [rowStart] },
      { textAr: PHRASES['hs.hint.locate.2'], audioId: 'hs.hint.locate.2', highlight: Array.from({ length: 10 }, (_, i) => rowStart + i) },
      { textAr: PHRASES['hs.hint.locate.3'], audioId: 'hs.hint.locate.3', highlight: [target] },
    ],
    explainAr: `${ar(target)}: صف ${ar(rowOf(target))}، خانة ${ar(colOf(target))}.`,
    explainParts: [num(target), 'w.row', num(rowOf(target)), 'w.cell', num(colOf(target))],
    solutionPath: [rowStart, target],
    evaluate(given): Evaluation {
      return genericFeedback(classifyLocateError(given, target));
    },
  };
}

export interface GenerateOptions {
  /** طريقة الإجابة لأسئلة "أكثر/أقل": حركة الأفاتار، أو كتابة بلوحة الأرقام */
  mode?: InputMode;
  /** عند الكتابة: هل تُعرض اللوحة (صوري) أم لا (مجرد) */
  showSquare?: boolean;
}

/** يولّد سؤالًا حتميًا من النوع والبذرة والخيارات */
export function generateHundredSquareQuestion(variant: HundredSquareVariant, seed: number, options: GenerateOptions = {}): GeneratedQuestion {
  switch (variant) {
    case 'missing_cell':
      return missingCell(seed);
    case 'ten_more_less':
      return moreLess(seed, 10, options.mode === 'move' ? 'move' : 'numpad', options.showSquare ?? false);
    case 'one_more_less':
      return moreLess(seed, 1, options.mode === 'move' ? 'move' : 'numpad', options.showSquare ?? false);
    case 'between_decades':
      return betweenDecades(seed);
    case 'midpoint':
      return midpoint(seed);
    case 'locate':
      return locate(seed);
    case 'column_jumps':
      return columnJumps(seed);
  }
}

/** مستوى التمثيل المسموح لنوع سؤال: محسوس (حركة) ← صوري (كتابة مع اللوحة) ← مجرد (كتابة بلا لوحة) */
export type ReadinessLevel = 'concrete' | 'pictorial' | 'abstract';
export type Readiness = Partial<Record<HundredSquareVariant, ReadinessLevel>>;

/** يخفض عنصر المجمع إلى المستوى المسموح به: لا نكتب بلا لوحة قبل أن ننجح بالحركة ثم باللوحة */
export function gateEntry(entry: PoolEntry, readiness: Readiness): PoolEntry {
  if (entry.variant !== 'ten_more_less' && entry.variant !== 'one_more_less') return entry;
  const allowed = readiness[entry.variant] ?? 'concrete';
  const level: ReadinessLevel = entry.mode === 'move' ? 'concrete' : entry.showSquare ? 'pictorial' : 'abstract';
  const order: ReadinessLevel[] = ['concrete', 'pictorial', 'abstract'];
  if (order.indexOf(level) <= order.indexOf(allowed)) return entry;
  return allowed === 'concrete' ? { ...entry, mode: 'move', showSquare: true } : { ...entry, mode: 'numpad', showSquare: true };
}

/** عنصر من مجمع الأسئلة: النوع وطريقة الإجابة */
export interface PoolEntry {
  variant: HundredSquareVariant;
  mode: InputMode;
  showSquare: boolean;
}

/**
 * مجمعات الأسئلة لكل مرحلة. المخطط يخلطها ببذرة الجلسة ويضمن التغطية عبر الجلسات.
 * خط الأساس: ثمانية أسئلة بلا تلميح تمثّل كل الأنواع.
 */
export const PHASE_POOLS: Record<'baseline' | 'warmup' | 'guided' | 'independent' | 'check', PoolEntry[]> = {
  warmup: [
    { variant: 'column_jumps', mode: 'move', showSquare: true },
    { variant: 'column_jumps', mode: 'move', showSquare: true },
  ],
  baseline: [
    { variant: 'ten_more_less', mode: 'numpad', showSquare: false },
    { variant: 'ten_more_less', mode: 'numpad', showSquare: false },
    { variant: 'one_more_less', mode: 'numpad', showSquare: false },
    { variant: 'one_more_less', mode: 'numpad', showSquare: false },
    { variant: 'missing_cell', mode: 'numpad', showSquare: true },
    { variant: 'locate', mode: 'cell', showSquare: true },
    { variant: 'midpoint', mode: 'cell', showSquare: true },
    { variant: 'between_decades', mode: 'cell', showSquare: true },
  ],
  guided: [
    { variant: 'ten_more_less', mode: 'move', showSquare: true },
    { variant: 'locate', mode: 'cell', showSquare: true },
    { variant: 'missing_cell', mode: 'numpad', showSquare: true },
  ],
  independent: [
    { variant: 'missing_cell', mode: 'numpad', showSquare: true },
    { variant: 'ten_more_less', mode: 'move', showSquare: true },
    { variant: 'ten_more_less', mode: 'numpad', showSquare: false },
    { variant: 'one_more_less', mode: 'move', showSquare: true },
    { variant: 'one_more_less', mode: 'numpad', showSquare: false },
    { variant: 'midpoint', mode: 'cell', showSquare: true },
    { variant: 'between_decades', mode: 'cell', showSquare: true },
  ],
  check: [
    { variant: 'missing_cell', mode: 'numpad', showSquare: true },
    { variant: 'ten_more_less', mode: 'numpad', showSquare: false },
    { variant: 'locate', mode: 'cell', showSquare: true },
    { variant: 'between_decades', mode: 'cell', showSquare: true },
    { variant: 'one_more_less', mode: 'numpad', showSquare: false },
  ],
};

/** النسخة الأسهل من سؤال (تمثيل أكثر حسية): مجرد ← صوري ← حركة */
export function easierEntry(entry: PoolEntry): PoolEntry {
  if (entry.variant === 'ten_more_less' || entry.variant === 'one_more_less') {
    if (entry.mode === 'numpad' && !entry.showSquare) return { ...entry, showSquare: true };
    if (entry.mode === 'numpad') return { ...entry, mode: 'move' };
  }
  return entry;
}

/** النسخة الأصعب من سؤال (تمثيل أكثر تجريدًا): حركة ← صوري ← مجرد */
export function harderEntry(entry: PoolEntry): PoolEntry {
  if (entry.variant === 'ten_more_less' || entry.variant === 'one_more_less') {
    if (entry.mode === 'move') return { ...entry, mode: 'numpad', showSquare: true };
    if (entry.mode === 'numpad' && entry.showSquare) return { ...entry, showSquare: false };
  }
  return entry;
}

export function generateFromEntry(entry: PoolEntry, seed: number): GeneratedQuestion {
  return generateHundredSquareQuestion(entry.variant, seed, { mode: entry.mode, showSquare: entry.showSquare });
}

/** أسماء الأنواع بالعربية للوحة الأب */
export const VARIANT_LABELS: Record<HundredSquareVariant, string> = {
  missing_cell: 'الخانة الممحوّة',
  ten_more_less: 'عشرة أكثر/أقل',
  one_more_less: 'واحد أكثر/أقل',
  between_decades: 'بين عقدين',
  midpoint: 'منتصف عقدين',
  locate: 'موضع العدد',
  column_jumps: 'تمرين القفز',
};

/** مطابق الإجابة كنص قابل للقراءة في لوحة الأب */
export function describeMatcher(m: AnswerMatcher): string {
  switch (m.kind) {
    case 'exact':
      return ar(m.value);
    case 'set':
      return `أحد: ${m.values.map(ar).join('، ')}`;
    case 'range':
      return `من ${ar(m.min)} إلى ${ar(m.max)}`;
  }
}
