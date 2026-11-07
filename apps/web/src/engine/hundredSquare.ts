// قالب "لوحة المائة": مولدات أسئلة الدرس الأول (ص 4–5) بمهارة MATH.G2.S1.CA01-2
// كل النصوص قصيرة (حتى ثماني كلمات) وبمصطلح واحد ثابت لكل مفهوم:
// "قفزة" = عشرة، "خطوة" = واحد، "أكثر" = النزول أو التقدم، "أقل" = الصعود أو الرجوع، "العقد" = العدد المنتهي بصفر.

import { toArabicIndic } from './answers';
import type { AnswerMatcher } from './answers';
import { classifyBetweenError, classifyLocateError, classifyMidpointError, classifyNearError, classifyStepError, type ErrorTag, type StepContext } from './errors';
import { createRng, type Rng } from './rng';
import type { Evaluation, GeneratedQuestion, InputMode, QuestionHint, SquareView } from './question';

export const HUNDRED_SQUARE_SKILL = 'MATH.G2.S1.CA01-2';

export type HundredSquareVariant =
  | 'missing_cell' // أكمل الخانة الممحوّة في جزء من الخريطة
  | 'ten_more_less' // عشرة أكثر/أقل (قفزة)
  | 'one_more_less' // واحد أكثر/أقل (خطوة)
  | 'between_decades' // أي عدد بين عقدين (إجابات متعددة صحيحة)
  | 'midpoint' // منتصف عقدين
  | 'locate'; // انقر على موضع العدد

const ar = toArabicIndic;

/** يبني عرض الخريطة بقيم افتراضية */
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

/** جمل التغذية الراجعة العامة لكل وسم (قصيرة وثابتة) */
const GENERIC_FEEDBACK: Record<ErrorTag, string> = {
  none: 'أحسنت!',
  not_a_number: 'اكتب عددًا.',
  confused_step: 'انتبه: خطوة أم قفزة؟',
  wrong_direction: 'انتبه: أكثر أم أقل؟',
  reversed_digits: 'انتبه: العشرات أولًا، ثم الآحاد.',
  dropped_zero: 'انتبه إلى الصفر.',
  off_by_one: 'قريب! هو جاره في الصف.',
  off_by_ten: 'قريب! هو في صف آخر.',
  same_row: 'الصف صحيح. الخانة غير هذه.',
  same_column: 'العمود صحيح. الصف غير هذا.',
  on_boundary: 'هذا العقد نفسه. نريد عددًا بينهما.',
  not_midpoint: 'بينهما، لكن ليس المنتصف.',
  out_of_range: 'اللوحة من واحد إلى مائة.',
  skipped: 'حسنًا. التالي.',
  other: 'ليس هذا. انظر إلى اللوحة.',
};

function stepFeedback(tag: ErrorTag, ctx: StepContext): string {
  if (tag === 'confused_step') return ctx.step === 10 ? 'هذه خطوة. نريد قفزة: عشرة.' : 'هذه قفزة. نريد خطوة: واحد.';
  if (tag === 'wrong_direction') return ctx.direction === 'more' ? 'ذهبت أقل. نريد أكثر.' : 'ذهبت أكثر. نريد أقل.';
  return GENERIC_FEEDBACK[tag];
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

  const hint1 =
    up !== null
      ? `فوقها ${ar(up)}. قفزة أكثر: عشرة.`
      : down !== null
        ? `تحتها ${ar(down)}. قفزة أقل: عشرة.`
        : (side as number) < hidden
          ? `بجانبها ${ar(side as number)}. خطوة أكثر: واحد.`
          : `بجانبها ${ar(side as number)}. خطوة أقل: واحد.`;
  const hint2 =
    up !== null ? `${ar(up)} وعشرة أكثر؟` : down !== null ? `${ar(down)} وعشرة أقل؟` : (side as number) < hidden ? `${ar(side as number)} وواحد أكثر؟` : `${ar(side as number)} وواحد أقل؟`;

  return {
    id: makeId('missing_cell', seed, 'numpad'),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'missing_cell',
    seed,
    representation: 'pictorial',
    promptAr: 'انظر إلى الخانة الصفراء. ما العدد؟',
    promptParts: [
      { kind: 'text', textAr: 'الخانة الصفراء' },
      { kind: 'number', value: 0, tone: 'unknown' },
      { kind: 'text', textAr: 'ما العدد؟' },
    ],
    audioId: 'hs.prompt.missing_cell',
    square: square({ showAll: false, reveal, hiddenCell: hidden }),
    inputMode: 'numpad',
    matcher: { kind: 'exact', value: hidden },
    hints: [
      { textAr: hint1, audioId: '', highlight: [anchorCell], arrow: { from: anchorCell, to: hidden, labelAr: up !== null ? '+١٠' : down !== null ? '−١٠' : (side as number) < hidden ? '+١' : '−١' } },
      { textAr: hint2, audioId: '', highlight: cells },
      { textAr: 'انظر إلى اللوحة كاملة.', audioId: 'hs.hint.reveal', revealSquare: true, highlight: [hidden] },
    ],
    explainAr: `العدد ${ar(hidden)}.`,
    solutionPath: [anchorCell, hidden],
    evaluate(given): Evaluation {
      const tag = classifyNearError(given, hidden);
      return { tag, feedbackAr: GENERIC_FEEDBACK[tag] };
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
  const ctx: StepContext = { base, step, direction: more ? 'more' : 'less' };
  const representation = mode === 'move' ? 'concrete' : showSquare ? 'pictorial' : 'abstract';
  // الصيغة المنطوقة فعلٌ أولًا وخطوة واحدة؛ والعرض البصري بطاقات: العدد ← العملية ← ؟
  const opText = `${stepWord} ${dirWord}`;
  const promptAr = mode === 'move' ? `أنت على ${ar(base)}. اذهب إلى ${opText}.` : `ما العدد؟ ${opText} من ${ar(base)}.`;
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
      ? `${ar(base)} آخر الصف. ${ar(expected)} أول الصف التالي.`
      : step === 1 && !more && base % 10 === 1
        ? `${ar(base)} أول الصف. ${ar(expected)} آخر الصف السابق.`
        : null;

  const hints: QuestionHint[] =
    mode === 'move'
      ? [
          { textAr: `اضغط "${moveWord} ${dirWord}" مرة واحدة.`, audioId: '', highlight: [base], arrow },
          { textAr: boundary ?? `انظر: ${ar(base)} ثم ${ar(expected)}.`, audioId: '', highlight: [base, expected], arrow },
          { textAr: 'الكنز هنا.', audioId: 'hs.hint.here', highlight: [expected] },
        ]
      : [
          { textAr: `ابحث عن ${ar(base)} في اللوحة.`, audioId: '', highlight: [base], revealSquare: true },
          { textAr: boundary ?? `${moveWord} ${dirWord} = ${stepWord} ${dirWord}.`, audioId: '', highlight: [base, expected], arrow, revealSquare: true },
          { textAr: `${ar(base)} و${stepWord} ${dirWord}: ${ar(expected)}.`, audioId: '', highlight: [expected], revealSquare: true },
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
    square: mode === 'move' ? square({ showAll: true, start: base }) : showSquare ? square({ showAll: true, highlight: [base] }) : undefined,
    inputMode: mode,
    matcher: { kind: 'exact', value: expected },
    hints,
    explainAr: `${stepWord} ${dirWord} من ${ar(base)}: ${ar(expected)}.`,
    solutionPath: [base, expected],
    evaluate(given): Evaluation {
      const tag = classifyStepError(given, expected, ctx);
      return { tag, feedbackAr: stepFeedback(tag, ctx) };
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
    square: square({ showAll: true, highlight: [low, high], clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'set', values },
    hints: [
      { textAr: 'هذان العقدان. الكنز بينهما.', audioId: 'hs.hint.between.1', highlight: [low, high] },
      { textAr: 'كل هذا الصف بينهما.', audioId: 'hs.hint.between.2', highlight: values },
      { textAr: 'مثل هذا.', audioId: 'hs.hint.between.3', highlight: [low + 5] },
    ],
    explainAr: `بين ${ar(low)} و${ar(high)}: من ${ar(low + 1)} إلى ${ar(high - 1)}.`,
    solutionPath: [low, low + 5],
    evaluate(given): Evaluation {
      const tag = classifyBetweenError(given, low, high);
      return { tag, feedbackAr: GENERIC_FEEDBACK[tag] };
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
    square: square({ showAll: true, highlight: [low, high], clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'exact', value: mid },
    hints: [
      { textAr: `المنتصف: خمس خطوات بعد ${ar(low)}.`, audioId: '', highlight: [low] },
      { textAr: 'عدّ خمس خطوات.', audioId: 'hs.hint.midpoint.2', highlight: [low + 1, low + 2, low + 3, low + 4, low + 5] },
      { textAr: 'هنا المنتصف.', audioId: 'hs.hint.midpoint.3', highlight: [mid] },
    ],
    explainAr: `منتصف ${ar(low)} و${ar(high)}: ${ar(mid)}.`,
    solutionPath: [low, low + 1, low + 2, low + 3, low + 4, mid],
    evaluate(given): Evaluation {
      const tag = classifyMidpointError(given, low, high);
      return { tag, feedbackAr: GENERIC_FEEDBACK[tag] };
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
    square: square({ showAll: true, clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'exact', value: target },
    hints: [
      { textAr: `ابدأ من صف ${ar(rowStart)}.`, audioId: '', highlight: [rowStart] },
      { textAr: 'الكنز في هذا الصف.', audioId: 'hs.hint.locate.2', highlight: Array.from({ length: 10 }, (_, i) => rowStart + i) },
      { textAr: 'هنا.', audioId: 'hs.hint.locate.3', highlight: [target] },
    ],
    explainAr: `${ar(target)}: صف ${ar(rowOf(target))}، خانة ${ar(colOf(target))}.`,
    solutionPath: [rowStart, target],
    evaluate(given): Evaluation {
      const tag = classifyLocateError(given, target);
      return { tag, feedbackAr: GENERIC_FEEDBACK[tag] };
    },
  };
}

export interface GenerateOptions {
  /** طريقة الإجابة لأسئلة "أكثر/أقل": حركة الأفاتار، أو كتابة بلوحة الأرقام */
  mode?: InputMode;
  /** عند الكتابة: هل تُعرض الخريطة (صوري) أم لا (مجرد) */
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
  }
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
export const PHASE_POOLS: Record<'baseline' | 'guided' | 'independent' | 'check', PoolEntry[]> = {
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
