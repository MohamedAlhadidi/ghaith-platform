// نقطة الدخول: تسجيل عامل الخدمة للعمل دون اتصال، وطلب التخزين الدائم، ثم تشغيل التطبيق
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

registerSW({ immediate: true });

// التخزين الدائم يمنع المتصفح من حذف بيانات غيث عند ضيق المساحة
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
