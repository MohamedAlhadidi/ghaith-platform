// أزرار الحركة على اللوحة: قفزة (عشرة) وخطوة (واحد) أكثر أو أقل، وزر "وصلت"
// لوحة المفاتيح: الأسهم تحرك (لأسفل +١٠، لأعلى −١٠، لليسار +١ في اتجاه القراءة، لليمين −١) وEnter = وصلت
// "وصلت" لا يعمل قبل أي حركة: الضغط عليه بلا حركة يستدعي onArriveWithoutMove بدل تسجيل إجابة
import { useEffect } from 'react';
import { toArabicIndic } from '../engine/answers';
import type { QuestionHint } from '../engine/question';

export interface MoveControlsProps {
  position: number;
  start: number;
  disabled?: boolean;
  /** أزرار تنبض مع التلميح الحالي */
  pulse?: QuestionHint['pulse'];
  onMove: (delta: 10 | -10 | 1 | -1) => void;
  onArrive: () => void;
  onArriveWithoutMove?: () => void;
}

export function MoveControls({ position, start, disabled = false, pulse, onMove, onArrive, onArriveWithoutMove }: MoveControlsProps) {
  const can = (delta: number) => !disabled && position + delta >= 1 && position + delta <= 100;
  const moved = position !== start;
  const arrive = () => {
    if (disabled) return;
    if (!moved) onArriveWithoutMove?.();
    else onArrive();
  };
  const pulses = (key: 'jump_more' | 'jump_less' | 'step_more' | 'step_less') =>
    pulse === key || (pulse === 'jump' && key.startsWith('jump')) || (pulse === 'step' && key.startsWith('step')) ? 'pulse' : '';

  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const map: Record<string, 10 | -10 | 1 | -1> = { ArrowDown: 10, ArrowUp: -10, ArrowLeft: 1, ArrowRight: -1 };
      const delta = map[e.key];
      if (delta !== undefined) {
        if (can(delta)) onMove(delta);
        e.preventDefault();
      } else if (e.key === 'Enter' && tag !== 'BUTTON') {
        arrive();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="move-controls" dir="rtl">
      <div className="move-position" aria-live="polite" data-testid="move-position">
        أنت على <strong>{toArabicIndic(position)}</strong>
      </div>
      <div className="move-grid">
        {/* الإشارة قبل العدد كما في الكتاب (+١٠)؛ تُثبَّت باتجاه LTR حتى لا يقلبها محرك الاتجاه */}
        <button type="button" className={`move-key jump ${pulses('jump_more')}`} disabled={!can(10)} onClick={() => onMove(10)} data-move="10">
          قفزة أكثر <span className="move-delta">⬇ <bdi dir="ltr">+١٠</bdi></span>
        </button>
        <button type="button" className={`move-key jump ${pulses('jump_less')}`} disabled={!can(-10)} onClick={() => onMove(-10)} data-move="-10">
          قفزة أقل <span className="move-delta">⬆ <bdi dir="ltr">−١٠</bdi></span>
        </button>
        <button type="button" className={`move-key step ${pulses('step_more')}`} disabled={!can(1)} onClick={() => onMove(1)} data-move="1">
          خطوة أكثر <span className="move-delta"><bdi dir="ltr">+١</bdi></span>
        </button>
        <button type="button" className={`move-key step ${pulses('step_less')}`} disabled={!can(-1)} onClick={() => onMove(-1)} data-move="-1">
          خطوة أقل <span className="move-delta"><bdi dir="ltr">−١</bdi></span>
        </button>
      </div>
      <button type="button" className={`big-button accent move-arrive ${moved ? '' : 'move-arrive-idle'}`} disabled={disabled} onClick={arrive} data-testid="move-arrive" aria-disabled={!moved}>
        وصلت ✓
      </button>
    </div>
  );
}
