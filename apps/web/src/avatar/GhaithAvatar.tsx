// أفاتار غيث: شخصيته على الخريطة، بثلاثة أشكال أصلية بسيطة يختار منها، وحالات تتحرك بالـCSS
// الرسم SVG خالص بلا صور خارجية ليعمل دون اتصال ويُلوَّن من متغيرات الواجهة

export type AvatarLook = 'explorer' | 'sailor' | 'astronaut';
export type AvatarState = 'idle' | 'walk' | 'happy' | 'think';

export const AVATAR_LOOK_LABELS: Record<AvatarLook, string> = {
  explorer: 'المستكشف',
  sailor: 'البحّار',
  astronaut: 'رائد الفضاء',
};

export interface GhaithAvatarProps {
  look: AvatarLook;
  state?: AvatarState;
  size?: number;
}

export function GhaithAvatar({ look, state = 'idle', size = 64 }: GhaithAvatarProps) {
  return (
    <svg className={`avatar avatar-${state}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* الجسم */}
      <g className="avatar-body">
        {look === 'astronaut' ? (
          <>
            <rect x="20" y="34" width="24" height="22" rx="8" fill="#e8eef5" stroke="#8aa0b8" strokeWidth="2" />
            <rect x="27" y="40" width="10" height="6" rx="2" fill="#2f6f8f" />
          </>
        ) : look === 'sailor' ? (
          <>
            <rect x="20" y="34" width="24" height="22" rx="8" fill="#ffffff" stroke="#2f6f8f" strokeWidth="2" />
            <rect x="20" y="40" width="24" height="3" fill="#2f6f8f" />
            <rect x="20" y="47" width="24" height="3" fill="#2f6f8f" />
          </>
        ) : (
          <>
            <rect x="20" y="34" width="24" height="22" rx="8" fill="#c9a86a" stroke="#8a6d3b" strokeWidth="2" />
            <rect x="14" y="36" width="8" height="14" rx="3" fill="#8a6d3b" />
          </>
        )}
        {/* الرأس */}
        <circle cx="32" cy="22" r="13" fill="#f3d3b3" stroke="#b58a63" strokeWidth="2" />
        {/* العينان والابتسامة */}
        <circle cx="27" cy="21" r="2" fill="#233041" />
        <circle cx="37" cy="21" r="2" fill="#233041" />
        {state === 'think' ? <path d="M27 29 h10" stroke="#233041" strokeWidth="2" strokeLinecap="round" /> : <path d="M26 27 q6 6 12 0" stroke="#233041" strokeWidth="2" fill="none" strokeLinecap="round" />}
        {/* غطاء الرأس حسب الشكل */}
        {look === 'explorer' && (
          <>
            <path d="M17 14 q15 -12 30 0 l2 3 h-34 z" fill="#8a6d3b" />
            <rect x="21" y="9" width="22" height="6" rx="3" fill="#a3814a" />
          </>
        )}
        {look === 'sailor' && (
          <>
            <path d="M19 13 q13 -9 26 0 v3 h-26 z" fill="#ffffff" stroke="#2f6f8f" strokeWidth="2" />
            <rect x="19" y="14" width="26" height="3" fill="#2f6f8f" />
          </>
        )}
        {look === 'astronaut' && <circle cx="32" cy="22" r="16" fill="rgba(120,180,220,0.25)" stroke="#8aa0b8" strokeWidth="2" />}
        {/* رفع اليدين عند الفرح */}
        {state === 'happy' && (
          <>
            <path d="M20 40 l-8 -10" stroke="#f3d3b3" strokeWidth="5" strokeLinecap="round" />
            <path d="M44 40 l8 -10" stroke="#f3d3b3" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}
