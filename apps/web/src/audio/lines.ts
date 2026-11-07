// سجل كل ما يُنطق في المنصة: المصدر الوحيد لأداة التوليد ولقسم "مراجعة الصوت" في لوحة الأب
// يجمع: معجم المقاطع، جمل الرفيق (بالاسم مُثبّتًا)، شاشات الشرح، النصوص المشتركة، ومقاطع الأعداد من صفر إلى مائة
import { PHRASES, num } from './phrases';
import { SCRIPT } from '../avatar/script';
import { LESSON_L1A_01, SHARED_AUDIO_TEXTS } from '../content/lessons/L1A-01';
import { toArabicIndic } from '../engine/answers';

export type LineGroup = 'companion' | 'model' | 'phrase' | 'feedback' | 'number' | 'ui';

export interface AudioLine {
  id: string;
  /** النص كما يُعرض ويُنطق */
  textAr: string;
  group: LineGroup;
  /** للأعداد: القيمة الرقمية لتُقرأ كعدد لا كأرقام متفرقة */
  numberValue?: number;
}

/** كل السطور بالترتيب، بلا تكرار معرّفات */
export function allLines(childName = 'غيث'): AudioLine[] {
  const lines: AudioLine[] = [];
  const seen = new Set<string>();
  const push = (l: AudioLine) => {
    if (seen.has(l.id)) throw new Error(`معرّف صوت مكرر: ${l.id}`);
    seen.add(l.id);
    lines.push(l);
  };
  for (const [, options] of Object.entries(SCRIPT)) for (const o of options) push({ id: o.id, textAr: o.textAr.replace('{name}', childName), group: 'companion' });
  for (const m of LESSON_L1A_01.model) push({ id: m.audioId, textAr: m.textAr, group: 'model' });
  for (const [id, text] of Object.entries(SHARED_AUDIO_TEXTS)) if (!seen.has(id)) push({ id, textAr: text, group: 'ui' });
  for (const [id, text] of Object.entries(PHRASES)) if (!seen.has(id)) push({ id, textAr: text, group: id.startsWith('fb.') ? 'feedback' : id.startsWith('ui.') ? 'ui' : 'phrase' });
  for (let n = 0; n <= 100; n++) push({ id: num(n), textAr: toArabicIndic(n), group: 'number', numberValue: n });
  return lines;
}

/** مجموع الأحرف (لتقدير استهلاك خدمة التوليد) */
export function totalChars(lines: AudioLine[]): number {
  return lines.reduce((s, l) => s + l.textAr.length, 0);
}
