// تطبيع الإجابات ومطابقتها: نقبل الأرقام العربية الهندية (٠-٩) والفارسية (۰-۹) واللاتينية، ونخزّن الصيغة اللاتينية

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;

/** يحوّل أي أرقام شرقية إلى لاتينية ويزيل محارف الاتجاه والمسافات الزائدة */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input.replace(BIDI_MARKS, '')) {
    const code = ch.charCodeAt(0);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + code - EXTENDED_ARABIC_INDIC_ZERO);
    } else if (ch === '٬' || ch === ',') {
      // فاصل آلاف: يُهمل
    } else {
      out += ch;
    }
  }
  return out.trim();
}

/** يحوّل عددًا إلى أرقام عربية هندية للعرض فقط */
export function toArabicIndic(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => String.fromCharCode(ARABIC_INDIC_ZERO + Number(d)));
}

/** يحلّل إجابة رقمية؛ يعيد null إن لم تكن عددًا صحيحًا */
export function parseIntegerAnswer(input: string): number | null {
  const normalized = normalizeDigits(input);
  if (!/^-?\d{1,4}$/.test(normalized)) return null;
  return Number(normalized);
}

/** أنواع المطابقة المدعومة؛ كل سؤال يحمل مطابقًا واحدًا */
export type AnswerMatcher =
  | { kind: 'exact'; value: number }
  | { kind: 'set'; values: number[] }
  | { kind: 'range'; min: number; max: number };

export interface MatchResult {
  correct: boolean;
  /** القيمة المطبّعة التي سُجّلت */
  canonical: string;
}

/** يطابق إجابة الطفل مع المطابق؛ الإجابات المفتوحة (set/range) تقبل كل القيم الصحيحة */
export function matchAnswer(matcher: AnswerMatcher, given: string | number): MatchResult {
  const canonical = typeof given === 'number' ? String(given) : normalizeDigits(given);
  const value = typeof given === 'number' ? given : parseIntegerAnswer(given);
  if (value === null) return { correct: false, canonical };
  switch (matcher.kind) {
    case 'exact':
      return { correct: value === matcher.value, canonical };
    case 'set':
      return { correct: matcher.values.includes(value), canonical };
    case 'range':
      return { correct: value >= matcher.min && value <= matcher.max, canonical };
  }
}
