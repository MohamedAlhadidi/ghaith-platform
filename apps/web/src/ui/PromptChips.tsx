// عرض السؤال بالبطاقات: الأعداد كبيرة وواضحة، والعملية في بطاقة ملوّنة، والمجهول علامة استفهام
// يقرأ من اليمين إلى اليسار كجملة واحدة قصيرة؛ الجملة الكاملة تُنطق في فقاعة الرفيق
import { toArabicIndic } from '../engine/answers';
import type { PromptPart } from '../engine/question';

export function PromptChips({ parts }: { parts: PromptPart[] }) {
  return (
    <div className="chips" dir="rtl" data-testid="prompt">
      {parts.map((p, i) => {
        if (p.kind === 'text') return <span key={i} className="chip-text">{p.textAr}</span>;
        if (p.kind === 'number') {
          return p.tone === 'unknown' ? (
            <span key={i} className="chip chip-unknown" aria-label="العدد المجهول">؟</span>
          ) : (
            <span key={i} className="chip chip-number">{toArabicIndic(p.value)}</span>
          );
        }
        return (
          <span key={i} className="chip chip-op">
            {p.textAr}
            {p.iconAr && <span className="chip-icon" dir="ltr">{p.iconAr}</span>}
          </span>
        );
      })}
    </div>
  );
}
