// مولد أرقام عشوائية حتمي: البذرة نفسها تعطي السؤال نفسه دائمًا (لإعادة الإنتاج والتدقيق)

/** يحوّل نصًا إلى بذرة رقمية ثابتة (FNV-1a 32 بت) */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** عدد عشري في [0,1) */
  next(): number;
  /** عدد صحيح في [min,max] شاملًا الطرفين */
  int(min: number, max: number): number;
  /** عنصر عشوائي من مصفوفة */
  pick<T>(items: readonly T[]): T;
  /** نسخة مخلوطة من المصفوفة (لا تعدّل الأصل) */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: صغير وسريع وكافٍ لتوليد أسئلة تعليمية */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      if (max < min) throw new Error('نطاق غير صالح');
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('مصفوفة فارغة');
      return items[Math.floor(next() * items.length)];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
