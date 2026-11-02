// نظام الصوت: ملف مسجّل مسبقًا من حزمة المحتوى أولًا، ثم صوت المتصفح العربي إن توفر، وإلا صمت مع إبقاء النص ظاهرًا
// لا تعتمد صحة أي نشاط على سماع الصوت؛ الزر "أعد" متاح دائمًا

const AUDIO_BASE = '/audio/';
const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;
let speaking = false;

export type AudioSource = 'file' | 'speech' | 'none';

async function fileExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('audio');
  } catch {
    return false;
  }
}

/** يوقف أي صوت جارٍ (ملف أو كلام مُولَّد) */
export function stopAudio(): void {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
  if (speaking && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    speaking = false;
  }
}

function arabicVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('ar-om')) ?? voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ?? null;
}

async function speak(text: string): Promise<AudioSource> {
  const voice = arabicVoice();
  if (!voice) return 'none';
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    speaking = true;
    u.onend = () => {
      speaking = false;
      resolve('speech');
    };
    u.onerror = () => {
      speaking = false;
      resolve('none');
    };
    window.speechSynthesis.speak(u);
  });
}

/**
 * ينطق تعليمة: يبحث عن ملف `audio/<audioId>.mp3` ثم يعود إلى الكلام المُولَّد.
 * يعيد المصدر الذي استُخدم ليُسجَّل في التشخيص.
 */
export async function say(audioId: string, text: string): Promise<AudioSource> {
  stopAudio();
  // معرّف فارغ يعني نصًا ديناميكيًا بلا ملف مسجّل
  if (!audioId) return speak(text);
  const url = `${AUDIO_BASE}${audioId}.mp3`;
  let el = cache.get(audioId);
  if (!el && (await fileExists(url))) {
    el = new Audio(url);
    el.preload = 'auto';
    cache.set(audioId, el);
  }
  if (el) {
    current = el;
    try {
      await el.play();
      return 'file';
    } catch {
      // سياسة التشغيل التلقائي قد تمنع التشغيل قبل أول نقرة
    }
  }
  return speak(text);
}

/** هل يوجد صوت عربي متاح الآن في المتصفح (للعرض في لوحة الأب) */
export function describeAudioCapability(): string {
  if (!('speechSynthesis' in window)) return 'لا يدعم المتصفح الكلام المُولَّد؛ تُستخدم الملفات المسجّلة فقط.';
  const v = arabicVoice();
  return v ? `صوت المتصفح: ${v.name} (${v.lang})` : 'لا صوت عربي في المتصفح؛ تُستخدم الملفات المسجّلة فقط.';
}

/** تهيئة الصوت بعد أول نقرة (تفتح سياسة التشغيل التلقائي) */
export function primeAudio(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
}
