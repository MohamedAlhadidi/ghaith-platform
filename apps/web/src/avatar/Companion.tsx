// الرفيق: الشخصية المرشدة التي تكلّم غيث بجمل قصيرة في كل شاشة، بفقاعة نص وزر إعادة السماع
// الرفيق لا يحزن ولا يعاقب؛ حالاته: يتكلم، ينتظر، يفرح

export type CompanionMood = 'idle' | 'talk' | 'cheer' | 'think';

export interface CompanionProps {
  textAr: string;
  mood?: CompanionMood;
  onReplay?: () => void;
  /** تلميح: يومض زر المصباح عند التردد */
  compact?: boolean;
}

export function Companion({ textAr, mood = 'talk', onReplay, compact = false }: CompanionProps) {
  return (
    <div className={`companion ${compact ? 'companion-compact' : ''}`} dir="rtl">
      <svg className={`companion-figure companion-${mood}`} viewBox="0 0 64 64" width={compact ? 56 : 84} height={compact ? 56 : 84} aria-hidden="true">
        {/* طائر صغير مستدير بعينين كبيرتين */}
        <ellipse cx="32" cy="38" rx="20" ry="18" fill="#e9b949" stroke="#b98a1f" strokeWidth="2" />
        <ellipse cx="32" cy="42" rx="11" ry="9" fill="#fff3c9" />
        <circle cx="25" cy="30" r="5" fill="#fff" stroke="#b98a1f" strokeWidth="1.5" />
        <circle cx="39" cy="30" r="5" fill="#fff" stroke="#b98a1f" strokeWidth="1.5" />
        <circle cx="26" cy="31" r="2.2" fill="#233041" />
        <circle cx="40" cy="31" r="2.2" fill="#233041" />
        <path className="companion-beak" d="M29 37 l3 4 l3 -4 z" fill="#d9892b" />
        <path d="M12 38 q-6 4 -2 12" stroke="#b98a1f" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M52 38 q6 4 2 12" stroke="#b98a1f" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M22 16 l4 6 M32 12 l0 7 M42 16 l-4 6" stroke="#b98a1f" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="companion-bubble" role="status" aria-live="polite" data-testid="companion-text">
        <span className="companion-name">رفيق</span>
        <p className="companion-text">{textAr}</p>
        {onReplay && (
          <button type="button" className="icon-button small" aria-label="أعد السماع" onClick={onReplay}>
            🔊
          </button>
        )}
      </div>
    </div>
  );
}
