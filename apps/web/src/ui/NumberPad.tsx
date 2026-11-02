// لوحة أرقام كبيرة للطفل: نقر أو لوحة مفاتيح (الأرقام اللاتينية والعربية الهندية)، بحد ثلاثة أرقام
import { useEffect, useState } from 'react';
import { normalizeDigits, toArabicIndic } from '../engine/answers';

export interface NumberPadProps {
  disabled?: boolean;
  onSubmit: (value: string) => void;
  /** يُفرَّغ المحتوى عند تغيّر هذا المفتاح (سؤال جديد) */
  resetKey: string;
}

export function NumberPad({ disabled = false, onSubmit, resetKey }: NumberPadProps) {
  const [value, setValue] = useState('');

  useEffect(() => setValue(''), [resetKey]);

  const push = (d: string) => setValue((v) => (v.length >= 3 ? v : v + d));
  const back = () => setValue((v) => v.slice(0, -1));
  const submit = () => {
    if (value.length === 0 || disabled) return;
    const v = value;
    // تُفرَّغ اللوحة بعد كل إرسال حتى يكتب الطفل إجابته التالية من جديد
    setValue('');
    onSubmit(v);
  };

  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const d = normalizeDigits(e.key);
      if (/^\d$/.test(d)) {
        push(d);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        back();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        submit();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return (
    <div className="numpad" dir="rtl">
      <div className="numpad-display" aria-live="polite" aria-label="إجابتك">
        {value ? toArabicIndic(value) : ' '}
      </div>
      <div className="numpad-keys">
        {digits.map((d) => (
          <button type="button" key={d} className="numpad-key" disabled={disabled} onClick={() => push(d)} aria-label={toArabicIndic(d)}>
            {toArabicIndic(d)}
          </button>
        ))}
        <button type="button" className="numpad-key numpad-back" disabled={disabled || value.length === 0} onClick={back} aria-label="امسح">
          ⌫
        </button>
        <button type="button" className="numpad-key numpad-ok" disabled={disabled || value.length === 0} onClick={submit} aria-label="تأكيد">
          ✓
        </button>
      </div>
    </div>
  );
}
