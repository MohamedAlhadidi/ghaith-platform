// نظام الصوت: ملف مسجّل من حزمة المحتوى أولًا، ثم صوت المتصفح العربي المحلي فقط، وإلا صمت مع إبقاء النص ظاهرًا
// الخصوصية: لا تُستخدم أصوات المتصفح السحابية أبدًا (ترسل النص، ومنه اسم الطفل، إلى خادم خارجي)
// التسلسل: كل نداء جديد يلغي السابق، والوعد يُحل عند انتهاء التشغيل فعلًا لا عند بدايته

const AUDIO_BASE = '/audio/';
const MANIFEST_URL = `${AUDIO_BASE}audio-manifest.json`;

export type AudioSource = 'file' | 'speech' | 'none';

let manifest: Set<string> | null = null;
let manifestLoading: Promise<Set<string>> | null = null;
let generation = 0;
let currentEl: HTMLAudioElement | null = null;
let voiceEnabled = true;

/** يتيح للأب إيقاف صوت المتصفح نهائيًا (يبقى النص) */
export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) stopAudio();
}

async function loadManifest(): Promise<Set<string>> {
  if (manifest) return manifest;
  if (!manifestLoading) {
    manifestLoading = fetch(MANIFEST_URL)
      .then(async (r) => (r.ok ? ((await r.json()) as { files?: string[] }) : { files: [] }))
      .then((m) => new Set(m.files ?? []))
      .catch(() => new Set<string>())
      .then((s) => {
        manifest = s;
        return s;
      });
  }
  return manifestLoading;
}

/** يوقف أي صوت جارٍ (ملف أو كلام مُولَّد) ويلغي السلاسل المعلّقة */
export function stopAudio(): void {
  generation++;
  if (currentEl) {
    currentEl.pause();
    currentEl.currentTime = 0;
    currentEl = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** الصوت العربي المحلي فقط؛ الأصوات السحابية مرفوضة */
export function localArabicVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.localService && v.lang.toLowerCase().startsWith('ar'));
  return voices.find((v) => v.lang.toLowerCase().startsWith('ar-om')) ?? voices[0] ?? null;
}

function speak(text: string, gen: number): Promise<AudioSource> {
  const voice = localArabicVoice();
  if (!voice || !voiceEnabled) return Promise.resolve('none');
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85;
    u.onend = () => resolve(gen === generation ? 'speech' : 'none');
    u.onerror = () => resolve('none');
    window.speechSynthesis.speak(u);
  });
}

function playFile(url: string, gen: number): Promise<AudioSource> {
  return new Promise((resolve) => {
    const el = new Audio(url);
    currentEl = el;
    el.onended = () => resolve(gen === generation ? 'file' : 'none');
    el.onerror = () => resolve('none');
    el.play().catch(() => resolve('none'));
  });
}

/**
 * ينطق جملة: ملف `audio/<audioId>.mp3` إن كان في القائمة، وإلا الصوت المحلي، وإلا لا شيء.
 * يعيد المصدر الذي استُخدم؛ النداء الجديد يلغي السابق.
 */
export async function say(text: string, audioId = ''): Promise<AudioSource> {
  stopAudio();
  const gen = generation;
  if (audioId) {
    const files = await loadManifest();
    if (gen !== generation) return 'none';
    if (files.has(audioId)) return playFile(`${AUDIO_BASE}${audioId}.mp3`, gen);
  }
  return speak(text, gen);
}

/** ينطق عدة جمل متتالية؛ يتوقف إن جاء نداء جديد في الأثناء */
export async function sayAll(lines: Array<{ text: string; audioId?: string }>, gapMs = 350): Promise<void> {
  stopAudio();
  const gen = generation;
  for (const l of lines) {
    if (gen !== generation) return;
    // نداء داخلي لا يلغي الجيل الحالي
    const files = l.audioId ? await loadManifest() : null;
    if (gen !== generation) return;
    const source = files && l.audioId && files.has(l.audioId) ? await playFile(`${AUDIO_BASE}${l.audioId}.mp3`, gen) : await speak(l.text, gen);
    if (source === 'none' || gen !== generation) return;
    await new Promise((r) => setTimeout(r, gapMs));
  }
}

/** وصف الصوت المتاح للوحة الأب */
export function describeAudioCapability(): string {
  if (!('speechSynthesis' in window)) return 'لا يدعم المتصفح الكلام المُولَّد؛ تُستخدم الملفات المسجّلة فقط.';
  const v = localArabicVoice();
  if (v) return `صوت المتصفح المحلي: ${v.name} (${v.lang}). لا يُرسل شيء إلى الإنترنت.`;
  const cloud = window.speechSynthesis.getVoices().filter((v2) => !v2.localService && v2.lang.toLowerCase().startsWith('ar')).length;
  return cloud > 0
    ? 'لا صوت عربي محلي؛ الأصوات العربية السحابية موجودة لكنها معطّلة حفاظًا على الخصوصية. أضف "حزمة اللغة العربية" من إعدادات ويندوز (الكلام) ليعمل الصوت محليًا.'
    : 'لا صوت عربي في المتصفح؛ يظهر النص فقط حتى تُضاف الملفات المسجّلة.';
}

/** تهيئة الصوت بعد أول نقرة (تفتح سياسة التشغيل التلقائي وتحمّل الأصوات) */
export function primeAudio(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  void loadManifest();
}
