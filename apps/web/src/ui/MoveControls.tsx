// أزرار الحركة على الخريطة: قفزة (عشرة) وخطوة (واحد) أكثر أو أقل، وزر "وصلت"
// لوحة المفاتيح: الأسهم تحرك (لأسفل +١٠، لأعلى −١٠، لليسار +١ في اتجاه القراءة، لليمين −١) وEnter = وصلت
import { useEffect } from 'react';
import { toArabicIndic } from '../engine/answers';

export interface MoveControlsProps {
  position: number;
  disabled?: boolean;
  onMove: (delta: 10 | -10 | 1 | -1) => void;
  onArrive: () => void;
}

export function MoveControls({ position, disabled = false, onMove, onArrive }: MoveControlsProps) {
  const can = (delta: number) => !disabled && position + delta >= 1 && position + delta <= 100;

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
        onArrive();
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
        <button type="button" className="move-key jump" disabled={!can(10)} onClick={() => onMove(10)} data-move="10">
          قفزة أكثر <span className="move-delta">+١٠ ⬇</span>
        </button>
        <button type="button" className="move-key jump" disabled={!can(-10)} onClick={() => onMove(-10)} data-move="-10">
          قفزة أقل <span className="move-delta">−١٠ ⬆</span>
        </button>
        <button type="button" className="move-key step" disabled={!can(1)} onClick={() => onMove(1)} data-move="1">
          خطوة أكثر <span className="move-delta">+١</span>
        </button>
        <button type="button" className="move-key step" disabled={!can(-1)} onClick={() => onMove(-1)} data-move="-1">
          خطوة أقل <span className="move-delta">−١</span>
        </button>
      </div>
      <button type="button" className="big-button accent move-arrive" disabled={disabled} onClick={onArrive} data-testid="move-arrive">
        وصلت ✓
      </button>
    </div>
  );
}
