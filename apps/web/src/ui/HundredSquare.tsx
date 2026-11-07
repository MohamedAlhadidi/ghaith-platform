// خريطة المائة التفاعلية: 10×10 تُقرأ من اليمين إلى اليسار كما في الكتاب، بأرقام عربية هندية
// فوقها طبقة اللعبة: ضباب على الخانات المخفية، الأفاتار في خانته، الكنز، وسهم الاتجاه
import { useEffect, useRef } from 'react';
import { toArabicIndic } from '../engine/answers';
import type { SquareView } from '../engine/question';
import { GhaithAvatar, type AvatarLook, type AvatarState } from '../avatar/GhaithAvatar';

export interface HundredSquareProps {
  view: SquareView;
  /** خانات إضافية مظللة (من التلميحات أو الشرح) */
  extraHighlight?: number[];
  /** سهم توضيحي من خانة إلى خانة */
  arrow?: { from: number; to: number; labelAr: string };
  /** الخانة التي نقرها الطفل آخر مرة ونتيجتها */
  marked?: { cell: number; correct: boolean };
  onCellClick?: (n: number) => void;
  /** خانة مركّزة للوحة المفاتيح (الأسهم) */
  focusedCell?: number;
  onFocusMove?: (n: number) => void;
  /** موضع الأفاتار على الخريطة وحالته وشكله */
  avatarAt?: number;
  avatarState?: AvatarState;
  avatarLook?: AvatarLook;
  /** موضع الكنز عندما يُكشف */
  treasureAt?: number;
  /** مسار يُرسم كخطوات (المثال المحلول) */
  path?: number[];
}

function rowOf(n: number): number {
  return Math.ceil(n / 10);
}
function colOf(n: number): number {
  return ((n - 1) % 10) + 1;
}
/** مركز الخانة كنسبة مئوية داخل الشبكة (الاتجاه من اليمين إلى اليسار) */
function center(n: number): { x: number; y: number } {
  return { x: (10 - colOf(n) + 0.5) * 10, y: (rowOf(n) - 0.5) * 10 };
}

export function HundredSquare({ view, extraHighlight = [], arrow, marked, onCellClick, focusedCell, onFocusMove, avatarAt, avatarState = 'idle', avatarLook = 'explorer', treasureAt, path = [] }: HundredSquareProps) {
  const highlight = new Set([...view.highlight, ...extraHighlight]);
  const reveal = new Set(view.reveal);
  const pathSet = new Set(path);
  const ref = useRef<HTMLDivElement>(null);

  // الأسهم تحرك التركيز بين الخانات عندما تكون الخريطة قابلة للنقر
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
  const a = arrow ? { from: center(arrow.from), to: center(arrow.to) } : null;
  return (
    <div className="hs-wrap">
      <div className="hs-map">
        <div className="hs-grid" dir="rtl" ref={ref} tabIndex={view.clickable ? 0 : -1} role={view.clickable ? 'grid' : 'img'} aria-label="خريطة المائة">
          {cells.map((n) => {
            const isHidden = view.hiddenCell === n;
            const visible = view.showAll || reveal.has(n) || isHidden;
            const classes = ['hs-cell'];
            if (!visible) classes.push('hs-fog');
            if (isHidden) classes.push('hs-hidden');
            if (highlight.has(n)) classes.push('hs-highlight');
            if (pathSet.has(n)) classes.push('hs-path');
            if (marked && marked.cell === n) classes.push(marked.correct ? 'hs-correct' : 'hs-wrong');
            if (focusedCell === n && view.clickable) classes.push('hs-focus');
            if (view.clickable) classes.push('hs-clickable');
            if (avatarAt === n) classes.push('hs-has-avatar');
            return (
              <button
                type="button"
                key={n}
                className={classes.join(' ')}
                disabled={!view.clickable}
                tabIndex={-1}
                data-cell={n}
                aria-label={visible && !isHidden ? toArabicIndic(n) : 'خانة'}
                onClick={view.clickable && onCellClick ? () => onCellClick(n) : undefined}
              >
                <span className="hs-num">{isHidden ? '؟' : visible ? toArabicIndic(n) : ''}</span>
                {treasureAt === n && <span className="hs-treasure" aria-label="الكنز">💎</span>}
                {avatarAt === n && (
                  <span className="hs-avatar" aria-hidden="true">
                    <GhaithAvatar look={avatarLook} state={avatarState} size={44} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {a && (
          <svg className="hs-arrow-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="hs-arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4 z" fill="var(--primary)" />
              </marker>
            </defs>
            <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke="var(--primary)" strokeWidth="1.2" markerEnd="url(#hs-arrowhead)" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
      {arrow && (
        <div className="hs-arrow-label" aria-hidden="true">
          {toArabicIndic(arrow.from)} ← {arrow.labelAr} ← {toArabicIndic(arrow.to)}
        </div>
      )}
    </div>
  );
}
