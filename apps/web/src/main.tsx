// نقطة الدخول: تسجيل عامل الخدمة (بلا إعادة تحميل تلقائية)، وطلب التخزين الدائم، ثم تشغيل التطبيق
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initUpdates } from './pwa/update';
import './styles.css';

initUpdates();

// التخزين الدائم يمنع المتصفح من حذف بيانات غيث عند ضيق المساحة
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
