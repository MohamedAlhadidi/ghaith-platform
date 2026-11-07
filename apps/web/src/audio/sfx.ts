// أصوات اللعب القصيرة بلا كلام: تُركَّب من مذبذبات Web Audio وقت التشغيل، فلا ملفات ولا اتصال
// تُشغَّل بعد أول تفاعل فقط (سياسة المتصفح)، وتُحترم إعدادات "تقليل الحركة" بتقصيرها

export type Sfx = 'jump' | 'step' | 'treasure' | 'star' | 'wrong' | 'tap';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

function context(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

/** نغمة واحدة بتردد ومدة وشكل موجة */
function tone(ac: AudioContext, at: number, freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.12): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.02);
}

/** يشغّل صوت لعب قصيرًا؛ يتجاهل بصمت إن لم يتوفر الصوت */
export function playSfx(kind: Sfx): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  switch (kind) {
    case 'jump':
      tone(ac, t, 392, 90, 'triangle');
      tone(ac, t + 0.09, 523, 140, 'triangle');
      break;
    case 'step':
      tone(ac, t, 440, 80, 'triangle', 0.09);
      break;
    case 'tap':
      tone(ac, t, 660, 50, 'sine', 0.06);
      break;
    case 'treasure':
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, t + i * 0.11, f, 220, 'sine', 0.14));
      break;
    case 'star':
      [784, 988, 1175, 1568].forEach((f, i) => tone(ac, t + i * 0.09, f, 300, 'triangle', 0.12));
      break;
    case 'wrong':
      tone(ac, t, 330, 160, 'sine', 0.08);
      tone(ac, t + 0.17, 262, 220, 'sine', 0.08);
      break;
  }
}
