// وسوم الأخطاء: تصنيف قابل للتفسير لكل إجابة، يُحفظ في حدث المحاولة ويظهر للأب بالعربية
// التصنيف يقارن الإجابة بالعدد الذي انطلق منه الطفل (الأساس) لا بالإجابة المتوقعة فقط،
// لأن الخطأ "خطوة بدل قفزة" لا يُرى إلا بالنظر إلى الأساس.

export type ErrorTag =
  | 'none' // إجابة صحيحة
  | 'not_a_number' // لم يكتب عددًا
  | 'confused_step' // استخدم خطوة (واحد) بدل قفزة (عشرة) أو العكس
  | 'wrong_direction' // أكثر بدل أقل أو العكس
  | 'reversed_digits' // قلب العشرات والآحاد
  | 'dropped_zero' // أسقط الصفر أو أضافه
  | 'off_by_one' // جار في الصف نفسه
  | 'off_by_ten' // جار في العمود نفسه
  | 'same_row' // (تحديد الموضع) الصف صحيح والخانة غير صحيحة
  | 'same_column' // (تحديد الموضع) العمود صحيح والصف غير صحيح
  | 'on_boundary' // اختار العقد نفسه بدل عدد بين العقدين
  | 'not_midpoint' // بين العقدين لكن ليس المنتصف
  | 'out_of_range' // خارج ١ إلى ١٠٠
  | 'skipped' // ضغط "لا أعرف" (في خط الأساس والتحقق)
  | 'other';

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  none: 'صحيحة',
  not_a_number: 'بلا عدد',
  confused_step: 'خلط بين الخطوة والقفزة',
  wrong_direction: 'عكس الاتجاه',
  reversed_digits: 'قلب الرقمين',
  dropped_zero: 'الصفر',
  off_by_one: 'جار في الصف',
  off_by_ten: 'جار في العمود',
  same_row: 'الصف صحيح',
  same_column: 'العمود صحيح',
  on_boundary: 'اختار العقد نفسه',
  not_midpoint: 'ليس المنتصف',
  out_of_range: 'خارج اللوحة',
  skipped: 'قال: لا أعرف',
  other: 'أخرى',
};

/** ما يعنيه الوسم للأب، وما يمكن فعله على الورق (بلا توصيف تشخيصي) */
export const ERROR_TAG_MEANING: Record<ErrorTag, { meaningAr: string; paperAr: string }> = {
  none: { meaningAr: '', paperAr: '' },
  not_a_number: { meaningAr: 'لم يكتب عددًا، ربما لم يفهم المطلوب.', paperAr: 'اطلب منه أن يشير إلى الخانة بإصبعه قبل الكتابة.' },
  confused_step: {
    meaningAr: 'يخلط بين "واحد أكثر" (خطوة) و"عشرة أكثر" (قفزة).',
    paperAr: 'على لوحة ورقية: ضع إصبعه على عدد، وقل "قفزة" وانزلا صفًا معًا، ثم "خطوة" وانتقلا خانة.',
  },
  wrong_direction: {
    meaningAr: 'يعرف المقدار لكنه يعكس الاتجاه (أكثر بدل أقل).',
    paperAr: 'استخدم كلمتين ثابتتين فقط: "أكثر" للنزول و"أقل" للصعود، مع حركة اليد.',
  },
  reversed_digits: {
    meaningAr: 'يقلب رقم العشرات والآحاد عند الكتابة أو القراءة.',
    paperAr: 'اكتبا العدد في جدول من خانتين: "عشرات | آحاد"، وقل العدد وهو يكتب.',
  },
  dropped_zero: { meaningAr: 'يسقط الصفر في العقود أو يضيفه.', paperAr: 'عدّا بالعشرات بصوت عالٍ: عشرة، عشرون… مع الإشارة إلى الصفر.' },
  off_by_one: { meaningAr: 'قريب جدًا: يخطئ بواحد في الصف نفسه.', paperAr: 'لعبة "الجار": قل عددًا واطلب الجار الذي بعده والذي قبله.' },
  off_by_ten: { meaningAr: 'قريب: يخطئ بعشرة، أي صفًا واحدًا.', paperAr: 'غطِّ عددًا واطلب العدد الذي فوقه وتحته.' },
  same_row: { meaningAr: 'يجد الصف الصحيح ويخطئ في الخانة (الآحاد).', paperAr: 'بطاقات بالآحاد فقط: أين ٣ في صف الخمسينات؟' },
  same_column: { meaningAr: 'يجد العمود الصحيح ويخطئ في الصف (العشرات).', paperAr: 'عدّا بالعشرات نزولًا في العمود نفسه.' },
  on_boundary: { meaningAr: 'يختار العقد نفسه بدل عدد بين العقدين.', paperAr: 'ارسما خط أعداد من ٤٠ إلى ٥٠ وضعا نقاطًا بينهما.' },
  not_midpoint: { meaningAr: 'يعرف أن العدد بين العقدين لكن لا يجد المنتصف.', paperAr: 'عدّا خمسة بعد العقد بالأصابع.' },
  out_of_range: { meaningAr: 'كتب عددًا خارج اللوحة.', paperAr: 'ذكّره أن اللوحة من ١ إلى ١٠٠.' },
  skipped: { meaningAr: 'اختار "لا أعرف" بدل التخمين، وهذا أصدق من إجابة عشوائية.', paperAr: 'اعرض عليه السؤال نفسه على لوحة ورقية وهو يشير بإصبعه.' },
  other: { meaningAr: 'خطأ بلا نمط واضح.', paperAr: 'اسأله كيف فكّر؛ قد يكون تخمينًا.' },
};

export interface StepContext {
  base: number;
  step: 1 | 10;
  direction: 'more' | 'less';
}

function reversedOf(n: number): number {
  return Number(String(n).split('').reverse().join(''));
}

function basicTag(given: number | null, expected: number): ErrorTag | null {
  if (given === null) return 'not_a_number';
  if (given === expected) return 'none';
  if (given < 1 || given > 100) return 'out_of_range';
  const reversed = reversedOf(expected);
  if (expected >= 10 && expected % 10 !== 0 && reversed !== expected && given === reversed) return 'reversed_digits';
  if (expected % 10 === 0 && given === expected / 10) return 'dropped_zero';
  if (expected * 10 === given) return 'dropped_zero';
  return null;
}

/** تصنيف أخطاء "عشرة/واحد أكثر أو أقل" بالنظر إلى الأساس */
export function classifyStepError(given: number | null, expected: number, ctx: StepContext): ErrorTag {
  const basic = basicTag(given, expected);
  if (basic !== null) return basic;
  const g = given as number;
  const sign = ctx.direction === 'more' ? 1 : -1;
  const otherStep = ctx.step === 10 ? 1 : 10;
  if (g === ctx.base + sign * otherStep) return 'confused_step';
  if (g === ctx.base - sign * ctx.step) return 'wrong_direction';
  if (Math.abs(g - expected) === 1) return 'off_by_one';
  if (Math.abs(g - expected) === 10) return 'off_by_ten';
  return 'other';
}

/** تصنيف الأخطاء حول عدد متوقع واحد (الخانة الناقصة) */
export function classifyNearError(given: number | null, expected: number): ErrorTag {
  const basic = basicTag(given, expected);
  if (basic !== null) return basic;
  const g = given as number;
  if (Math.abs(g - expected) === 1) return 'off_by_one';
  if (Math.abs(g - expected) === 10) return 'off_by_ten';
  return 'other';
}

/** تصنيف أخطاء النقر على موضع عدد في اللوحة */
export function classifyLocateError(given: number | null, target: number): ErrorTag {
  const basic = basicTag(given, target);
  if (basic !== null) return basic;
  const g = given as number;
  const row = (n: number) => Math.ceil(n / 10);
  const col = (n: number) => ((n - 1) % 10) + 1;
  if (row(g) === row(target)) return 'same_row';
  if (col(g) === col(target)) return 'same_column';
  return 'other';
}

/** تصنيف أخطاء "عدد بين عقدين" */
export function classifyBetweenError(given: number | null, low: number, high: number): ErrorTag {
  if (given === null) return 'not_a_number';
  if (given > low && given < high) return 'none';
  if (given === low || given === high) return 'on_boundary';
  if (given < 1 || given > 100) return 'out_of_range';
  return 'other';
}

/** تصنيف أخطاء "منتصف عقدين" */
export function classifyMidpointError(given: number | null, low: number, high: number): ErrorTag {
  const mid = low + 5;
  if (given === null) return 'not_a_number';
  if (given === mid) return 'none';
  if (given === low || given === high) return 'on_boundary';
  if (given > low && given < high) return 'not_midpoint';
  if (given < 1 || given > 100) return 'out_of_range';
  return 'other';
}
