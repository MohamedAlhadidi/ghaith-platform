// لوحة أرقام كبيرة للطفل: نقر أو لوحة مفاتيح (الأرقام اللاتينية والعربية الهندية)، بحد ثلاثة أرقام
import { useEffect, useRef, useState } from 'react';
import { normalizeDigits, toArabicIndic } from '../engine/answers';

export interface NumberPadProps {
  disabled?: boolean;
  onSubmit: (value: string) => void;
  /** يُبلَّغ عند أي فعل (للمراقب) */
  onAction?: () => void;
  /** يُفرَّغ المحتوى عند تغيّر هذا المفتاح (سؤال جديد) */
  resetKey: string;
}

export function NumberPad({ disabled = false, onSubmit, onAction, resetKey }: NumberPadProps) {
  const [value, setValue] = useState('');
  // مرجع متزامن للقيمة: ضغطتا Enter متتاليتان قبل إعادة الرسم لا ترسلان الإجابة مرتين
  const valueRef = useRef('');

  useEffect(() => {
    valueRef.current = '';
    setValue('');
  }, [resetKey]);

  const update = (next: string) => {
    valueRef.current = next;
    setValue(next);
  };
  const push = (d: string) => {
    onAction?.();
    if (valueRef.current.length < 3) update(valueRef.current + d);
  };
  const back = () => {
    onAction?.();
    update(valueRef.current.slice(0, -1));
  };
  const submit = () => {
    const v = valueRef.current;
    if (v.length === 0 || disabled) return;
    // تُفرَّغ اللوحة فورًا بعد كل إرسال حتى يكتب الطفل إجابته التالية من جديد
    update('');
    onSubmit(v);
  };

  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // عندما يكون التركيز على زر، Enter يخص ذلك الزر لا لوحة الأرقام
      if (e.key === 'Enter' && tag === 'BUTTON') return;
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
      <div className="numpad-display" aria-live="polite" aria-label="إجابتك" data-testid="numpad-display">
        {value ? toArabicIndic(value) : ' '}
      </div>
      <div className="numpad-keys">
        {digits.map((d) => (
          <button type="button" key={d} className="numpad-key" disabled={disabled} onClick={() => push(d)} aria-label={toArabicIndic(d)} data-digit={d}>
            {toArabicIndic(d)}
          </button>
        ))}
        <button type="button" className="numpad-key numpad-back" disabled={disabled || value.length === 0} onClick={back} aria-label="امسح">
          ⌫
        </button>
        <button type="button" className="numpad-key numpad-ok" disabled={disabled || value.length === 0} onClick={submit} aria-label="تأكيد" data-testid="numpad-ok">
          ✓
        </button>
      </div>
    </div>
  );
}
