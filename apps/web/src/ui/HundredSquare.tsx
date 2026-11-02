// لوحة المائة التفاعلية: 10×10، تُقرأ من اليمين إلى اليسار كما في الكتاب، بأرقام عربية هندية
import { useEffect, useRef } from 'react';
import { toArabicIndic } from '../engine/answers';
import type { SquareView } from '../engine/question';

export interface HundredSquareProps {
  view: SquareView;
  /** خانات إضافية مظللة (من التلميحات أو الشرح) */
  extraHighlight?: number[];
  /** سهم توضيحي في شاشات الشرح */
  arrow?: { from: number; to: number; labelAr: string };
  /** الخانة التي نقرها الطفل آخر مرة ونتيجتها */
  marked?: { cell: number; correct: boolean };
  onCellClick?: (n: number) => void;
  /** خانة مركّزة للوحة المفاتيح (الأسهم) */
  focusedCell?: number;
  onFocusMove?: (n: number) => void;
}

export function HundredSquare({ view, extraHighlight = [], arrow, marked, onCellClick, focusedCell, onFocusMove }: HundredSquareProps) {
  const highlight = new Set([...view.highlight, ...extraHighlight]);
  const reveal = new Set(view.reveal);
  const ref = useRef<HTMLDivElement>(null);

  // الأسهم تحرك التركيز بين الخانات عندما تكون اللوحة قابلة للنقر
  useEffect(() => {
    if (!view.clickable || !onFocusMove) return;
    const el = ref.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      const cur = focusedCell ?? 1;
      let next = cur;
      // في الاتجاه من اليمين إلى اليسار: السهم الأيسر يزيد واحدًا
      if (e.key === 'ArrowLeft') next = cur + 1;
      else if (e.key === 'ArrowRight') next = cur - 1;
      else if (e.key === 'ArrowDown') next = cur + 10;
      else if (e.key === 'ArrowUp') next = cur - 10;
      else if (e.key === 'Enter' && onCellClick) {
        onCellClick(cur);
        e.preventDefault();
        return;
      } else return;
      if (next >= 1 && next <= 100) {
        onFocusMove(next);
        e.preventDefault();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [view.clickable, focusedCell, onFocusMove, onCellClick]);

  const cells = Array.from({ length: 100 }, (_, i) => i + 1);
  return (
    <div className="hs-wrap">
      <div className="hs-grid" dir="rtl" ref={ref} tabIndex={view.clickable ? 0 : -1} role={view.clickable ? 'grid' : 'img'} aria-label="لوحة المائة">
        {cells.map((n) => {
          const isHidden = view.hiddenCell === n;
          const visible = view.showAll || reveal.has(n) || isHidden;
          const classes = ['hs-cell'];
          if (!visible) classes.push('hs-empty');
          if (isHidden) classes.push('hs-hidden');
          if (highlight.has(n)) classes.push('hs-highlight');
          if (marked && marked.cell === n) classes.push(marked.correct ? 'hs-correct' : 'hs-wrong');
          if (focusedCell === n && view.clickable) classes.push('hs-focus');
          if (view.clickable) classes.push('hs-clickable');
          return (
            <button
              type="button"
              key={n}
              className={classes.join(' ')}
              disabled={!view.clickable}
              tabIndex={-1}
              aria-label={visible && !isHidden ? toArabicIndic(n) : 'خانة'}
              onClick={view.clickable && onCellClick ? () => onCellClick(n) : undefined}
            >
              {isHidden ? '؟' : visible ? toArabicIndic(n) : ''}
            </button>
          );
        })}
      </div>
      {arrow && (
        <div className="hs-arrow" aria-hidden="true">
          {toArabicIndic(arrow.from)} ← {arrow.labelAr} ← {toArabicIndic(arrow.to)}
        </div>
      )}
    </div>
  );
}
