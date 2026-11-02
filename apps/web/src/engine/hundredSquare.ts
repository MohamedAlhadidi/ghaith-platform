// قالب "لوحة المائة": مولدات أسئلة الدرس الأول (ص 4–5) بمهارة MATH.G2.S1.CA01-2

import { toArabicIndic } from './answers';
import type { AnswerMatcher } from './answers';
import { createRng, type Rng } from './rng';
import type { GeneratedQuestion, SquareView } from './question';

export const HUNDRED_SQUARE_SKILL = 'MATH.G2.S1.CA01-2';

export type HundredSquareVariant =
  | 'missing_cell' // أكمل الخانة الناقصة في جزء من اللوحة
  | 'ten_more_less' // عشرة أكثر/أقل
  | 'one_more_less' // واحد أكثر/أقل
  | 'between_decades' // أي عدد يقع بين عقدين (إجابات متعددة صحيحة)
  | 'midpoint' // نقطة المنتصف بين عقدين
  | 'locate'; // انقر على العدد في اللوحة

const ar = toArabicIndic;

/** يبني عرض اللوحة بقيم افتراضية */
function square(partial: Partial<SquareView>): SquareView {
  return { showAll: false, reveal: [], highlight: [], clickable: false, ...partial };
}

/** الصف (1..10) والعمود (1..10) لعدد في لوحة المائة */
export function rowOf(n: number): number {
  return Math.ceil(n / 10);
}
export function colOf(n: number): number {
  return ((n - 1) % 10) + 1;
}

/** تغذية راجعة مشتركة للأخطاء الشائعة حول عدد متوقع */
function feedbackNear(expected: number) {
  return (given: number | null): string => {
    if (given === null) return 'اكتب عددًا من الأرقام.';
    if (given === expected) return 'أحسنت!';
    if (given === expected + 10) return `هذا العدد تحته بصف كامل. انظر: ${ar(expected)} زائد عشرة يساوي ${ar(given)}.`;
    if (given === expected - 10) return `هذا العدد فوقه بصف كامل. انظر: ${ar(expected)} ناقص عشرة يساوي ${ar(given)}.`;
    if (given === expected + 1 || given === expected - 1) return 'هذا جاره في الصف نفسه. العدد المطلوب بينهما.';
    const reversed = Number(String(expected).split('').reverse().join(''));
    if (expected >= 10 && given === reversed) return 'انتبه لترتيب الرقمين: العشرات أولًا ثم الآحاد.';
    return 'ليس هذا. انظر إلى الأعداد المجاورة في اللوحة.';
  };
}

/** يختار عددًا داخل اللوحة بحيث تبقى الخانات المجاورة المطلوبة داخلها */
function pickAnchor(rng: Rng, needUp: boolean, needDown: boolean, needLeft: boolean, needRight: boolean): number {
  const minRow = needUp ? 2 : 1;
  const maxRow = needDown ? 9 : 10;
  const minCol = needLeft ? 2 : 1;
  const maxCol = needRight ? 9 : 10;
  const row = rng.int(minRow, maxRow);
  const col = rng.int(minCol, maxCol);
  return (row - 1) * 10 + col;
}

function makeId(variant: HundredSquareVariant, seed: number): string {
  return `HUNDRED_SQUARE:${variant}:${seed}`;
}

function missingCell(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  // أشكال كما في الكتاب: عمود، صف، زائد، زاوية
  const shape = rng.pick(['vertical', 'horizontal', 'plus', 'corner'] as const);
  const anchor = pickAnchor(rng, true, true, true, true);
  let cells: number[];
  switch (shape) {
    case 'vertical':
      cells = [anchor - 10, anchor, anchor + 10];
      break;
    case 'horizontal':
      cells = [anchor - 1, anchor, anchor + 1];
      break;
    case 'plus':
      cells = [anchor - 10, anchor - 1, anchor, anchor + 1, anchor + 10];
      break;
    case 'corner':
      cells = [anchor - 10, anchor, anchor + 1];
      break;
  }
  const hidden = rng.pick(cells);
  const reveal = cells.filter((c) => c !== hidden);
  const neighborUp = reveal.includes(hidden - 10) ? hidden - 10 : null;
  const neighborDown = reveal.includes(hidden + 10) ? hidden + 10 : null;
  const neighborSide = reveal.find((c) => c === hidden - 1 || c === hidden + 1) ?? null;

  const hint1 = neighborUp !== null
    ? `انظر إلى العدد فوق الخانة: ${ar(neighborUp)}. عندما ننزل صفًا نزيد عشرة.`
    : neighborDown !== null
      ? `انظر إلى العدد تحت الخانة: ${ar(neighborDown)}. عندما نصعد صفًا ننقص عشرة.`
      : `انظر إلى العدد بجانب الخانة: ${ar(neighborSide ?? reveal[0])}. في الصف نفسه نزيد أو ننقص واحدًا.`;
  const hint2 = neighborUp !== null
    ? `${ar(neighborUp)} زائد ${ar(10)} يساوي؟`
    : neighborDown !== null
      ? `${ar(neighborDown)} ناقص ${ar(10)} يساوي؟`
      : neighborSide !== null && neighborSide < hidden
        ? `${ar(neighborSide)} زائد ${ar(1)} يساوي؟`
        : `${ar(neighborSide ?? reveal[0])} ناقص ${ar(1)} يساوي؟`;

  return {
    id: makeId('missing_cell', seed),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'missing_cell',
    seed,
    representation: 'pictorial',
    promptAr: 'ما العدد الناقص في الخانة؟',
    audioId: 'hs.prompt.missing_cell',
    square: square({ showAll: false, reveal, hiddenCell: hidden, highlight: [] }),
    inputMode: 'numpad',
    matcher: { kind: 'exact', value: hidden },
    hints: [
      { textAr: hint1, audioId: 'hs.hint.missing_cell.1', highlight: [neighborUp ?? neighborDown ?? neighborSide ?? reveal[0]] },
      { textAr: hint2, audioId: 'hs.hint.missing_cell.2', highlight: cells },
      { textAr: 'انظر إلى لوحة المائة كاملة وابحث عن مكان الخانة.', audioId: 'hs.hint.missing_cell.3', revealSquare: true },
    ],
    explainAr: `العدد الناقص هو ${ar(hidden)}. الخانة تحت أي عدد تزيد عنه عشرة، والخانة بجانبه تزيد أو تنقص واحدًا.`,
    feedbackFor: feedbackNear(hidden),
  };
}

function moreLess(seed: number, step: 10 | 1, showSquare: boolean): GeneratedQuestion {
  const rng = createRng(seed);
  const more = rng.next() < 0.5;
  const base = step === 10 ? rng.int(more ? 1 : 11, more ? 90 : 100) : rng.int(more ? 1 : 2, more ? 99 : 100);
  const expected = more ? base + step : base - step;
  const stepWord = step === 10 ? 'عشرة' : 'واحدًا';
  const promptAr = more ? `ما العدد الذي يزيد عن ${ar(base)} بـ${stepWord}؟` : `ما العدد الذي ينقص عن ${ar(base)} بـ${stepWord}؟`;
  const variant: HundredSquareVariant = step === 10 ? 'ten_more_less' : 'one_more_less';
  const direction = step === 10 ? (more ? 'انزل صفًا واحدًا' : 'اصعد صفًا واحدًا') : more ? 'انتقل خانة واحدة في اتجاه القراءة' : 'ارجع خانة واحدة';
  return {
    id: makeId(variant, seed),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant,
    seed,
    representation: showSquare ? 'pictorial' : 'abstract',
    promptAr,
    // النص يحوي أعدادًا متغيرة، فلا ملف صوت ثابت له؛ يُنطق بالكلام المُولَّد حتى تُركَّب مقاطع الأعداد لاحقًا
    audioId: '',
    square: showSquare ? square({ showAll: true, highlight: [base] }) : undefined,
    inputMode: 'numpad',
    matcher: { kind: 'exact', value: expected },
    hints: [
      { textAr: `ابحث عن ${ar(base)} في لوحة المائة، ثم ${direction}.`, audioId: `hs.hint.${variant}.1`, highlight: [base], revealSquare: true },
      { textAr: `${ar(base)} ${more ? 'زائد' : 'ناقص'} ${ar(step)} يساوي؟`, audioId: `hs.hint.${variant}.2`, highlight: [base, expected] },
      { textAr: step === 10 ? 'عند تغيير عشرة يتغير رقم العشرات فقط.' : 'عند تغيير واحد يتغير رقم الآحاد.', audioId: `hs.hint.${variant}.3`, highlight: [base, expected], revealSquare: true },
    ],
    explainAr: `${ar(base)} ${more ? 'زائد' : 'ناقص'} ${ar(step)} يساوي ${ar(expected)}.`,
    feedbackFor: feedbackNear(expected),
  };
}

function betweenDecades(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const low = rng.int(1, 9) * 10;
  const high = low + 10;
  const values = Array.from({ length: 9 }, (_, i) => low + 1 + i);
  return {
    id: makeId('between_decades', seed),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'between_decades',
    seed,
    representation: 'pictorial',
    promptAr: `اكتب أي عدد يقع بين ${ar(low)} و${ar(high)}.`,
    audioId: '',
    square: square({ showAll: true, highlight: [low, high] }),
    inputMode: 'numpad',
    matcher: { kind: 'set', values },
    hints: [
      { textAr: `ابدأ من ${ar(low)} وعدّ واحدًا واحدًا حتى تصل قبل ${ar(high)}.`, audioId: 'hs.hint.between_decades.1', highlight: [low, high] },
      { textAr: 'كل الأعداد في هذا الصف بين العقدين صحيحة.', audioId: 'hs.hint.between_decades.2', highlight: values },
      { textAr: `مثلًا ${ar(low + 1)} أو ${ar(low + 5)}.`, audioId: 'hs.hint.between_decades.3', highlight: [low + 1, low + 5] },
    ],
    explainAr: `الأعداد بين ${ar(low)} و${ar(high)} هي من ${ar(low + 1)} إلى ${ar(high - 1)}، وكلها إجابات صحيحة.`,
    feedbackFor: (given) => {
      if (given === null) return 'اكتب عددًا من الأرقام.';
      if (values.includes(given)) return 'أحسنت!';
      if (given === low || given === high) return 'هذا هو العقد نفسه. نريد عددًا بينهما، لا على الطرف.';
      if (given < low) return `${ar(given)} أصغر من ${ar(low)}. نريد عددًا أكبر من ${ar(low)}.`;
      return `${ar(given)} أكبر من ${ar(high)}. نريد عددًا أصغر من ${ar(high)}.`;
    },
  };
}

function midpoint(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const low = rng.int(1, 9) * 10;
  const high = low + 10;
  const mid = low + 5;
  return {
    id: makeId('midpoint', seed),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'midpoint',
    seed,
    representation: 'pictorial',
    promptAr: `ما العدد الذي في منتصف المسافة بين ${ar(low)} و${ar(high)}؟`,
    audioId: '',
    square: square({ showAll: true, highlight: [low, high] }),
    inputMode: 'numpad',
    matcher: { kind: 'exact', value: mid },
    hints: [
      { textAr: 'المنتصف هو العدد الذي يبعد عن العقدين المسافة نفسها.', audioId: 'hs.hint.midpoint.1', highlight: [low, high] },
      { textAr: `عدّ خمسة بعد ${ar(low)}.`, audioId: 'hs.hint.midpoint.2', highlight: [low + 1, low + 2, low + 3, low + 4, low + 5] },
      { textAr: 'منتصف أي عقدين ينتهي بالرقم خمسة.', audioId: 'hs.hint.midpoint.3', highlight: [mid] },
    ],
    explainAr: `منتصف المسافة بين ${ar(low)} و${ar(high)} هو ${ar(mid)}.`,
    feedbackFor: (given) => {
      if (given === null) return 'اكتب عددًا من الأرقام.';
      if (given === mid) return 'أحسنت!';
      if (given > low && given < high) return 'هذا العدد بين العقدين، لكنه ليس في المنتصف تمامًا. ابحث عن العدد الذي ينتهي بخمسة.';
      return `نريد عددًا بين ${ar(low)} و${ar(high)}.`;
    },
  };
}

function locate(seed: number): GeneratedQuestion {
  const rng = createRng(seed);
  const target = rng.int(11, 100);
  const rowStart = (rowOf(target) - 1) * 10 + 1;
  return {
    id: makeId('locate', seed),
    skillCode: HUNDRED_SQUARE_SKILL,
    templateCode: 'HUNDRED_SQUARE',
    variant: 'locate',
    seed,
    representation: 'pictorial',
    promptAr: `انقر على العدد ${ar(target)} في لوحة المائة.`,
    audioId: '',
    square: square({ showAll: true, clickable: true }),
    inputMode: 'cell',
    matcher: { kind: 'exact', value: target },
    hints: [
      { textAr: `ابحث عن الصف الذي يبدأ بالعدد ${ar(rowStart)}.`, audioId: 'hs.hint.locate.1', highlight: [rowStart] },
      { textAr: 'العدد في هذا الصف.', audioId: 'hs.hint.locate.2', highlight: Array.from({ length: 10 }, (_, i) => rowStart + i) },
      { textAr: 'هذه هي الخانة.', audioId: 'hs.hint.locate.3', highlight: [target] },
    ],
    explainAr: `العدد ${ar(target)} في الصف ${ar(rowOf(target))} والخانة ${ar(colOf(target))}.`,
    feedbackFor: (given) => {
      if (given === null) return 'انقر على خانة في اللوحة.';
      if (given === target) return 'أحسنت!';
      if (rowOf(given) === rowOf(target)) return 'الصف صحيح، لكن الخانة ليست هذه. انتبه لرقم الآحاد.';
      if (colOf(given) === colOf(target)) return 'العمود صحيح، لكن الصف ليس هذا. انتبه لرقم العشرات.';
      return `نقرت على ${ar(given)}. نريد ${ar(target)}.`;
    },
  };
}

export interface GenerateOptions {
  /** عند ten/one_more_less: هل تُعرض اللوحة (تمثيل صوري) أم لا (تمثيل مجرد) */
  showSquare?: boolean;
}

/** يولّد سؤالًا حتميًا من النوع والبذرة */
export function generateHundredSquareQuestion(variant: HundredSquareVariant, seed: number, options: GenerateOptions = {}): GeneratedQuestion {
  switch (variant) {
    case 'missing_cell':
      return missingCell(seed);
    case 'ten_more_less':
      return moreLess(seed, 10, options.showSquare ?? false);
    case 'one_more_less':
      return moreLess(seed, 1, options.showSquare ?? false);
    case 'between_decades':
      return betweenDecades(seed);
    case 'midpoint':
      return midpoint(seed);
    case 'locate':
      return locate(seed);
  }
}

/** توزيع الأنواع حسب مرحلة الجلسة: التوجيه بالصورة، والاستقلال يخلط الصوري والمجرد */
export const VARIANTS_BY_PHASE: Record<'guided' | 'independent' | 'check', Array<{ variant: HundredSquareVariant; showSquare: boolean }>> = {
  guided: [
    { variant: 'locate', showSquare: true },
    { variant: 'missing_cell', showSquare: true },
    { variant: 'between_decades', showSquare: true },
  ],
  independent: [
    { variant: 'missing_cell', showSquare: true },
    { variant: 'ten_more_less', showSquare: true },
    { variant: 'ten_more_less', showSquare: false },
    { variant: 'one_more_less', showSquare: false },
    { variant: 'midpoint', showSquare: true },
  ],
  check: [
    { variant: 'missing_cell', showSquare: true },
    { variant: 'ten_more_less', showSquare: false },
    { variant: 'between_decades', showSquare: true },
    { variant: 'locate', showSquare: true },
  ],
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
