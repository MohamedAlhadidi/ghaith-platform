// تحديث التطبيق: عامل الخدمة لا يعيد التحميل من تلقاء نفسه أبدًا (حتى لا تضيع جلسة جارية)؛
// التحديث يُعرض كزر في شاشة البداية فقط ويُطبَّق بنقرة الأب أو الطفل هناك
import { registerSW } from 'virtual:pwa-register';

type Listener = (available: boolean) => void;
const listeners = new Set<Listener>();
let available = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;

export function initUpdates(): void {
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      available = true;
      for (const l of listeners) l(true);
    },
  });
}

export function isUpdateAvailable(): boolean {
  return available;
}

export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener);
  listener(available);
  return () => listeners.delete(listener);
}

export async function applyUpdate(): Promise<void> {
  if (apply) await apply(true);
}
