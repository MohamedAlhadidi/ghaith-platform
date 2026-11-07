// الشكل الموحد لأي سؤال مولَّد، مهما كان قالب اللعب

import type { AnswerMatcher } from './answers';
import type { ErrorTag } from './errors';
import type { RepresentationType } from './mastery';

export type TemplateCode = 'HUNDRED_SQUARE';

/** طريقة إجابة الطفل: كتابة عدد، نقر خانة، أو تحريك الأفاتار على الخريطة */
export type InputMode = 'numpad' | 'cell' | 'move';

/** ما تعرضه خريطة المائة لهذا السؤال */
export interface SquareView {
  /** إظهار كل الأعداد (true) أو الخانات المذكورة في reveal فقط */
  showAll: boolean;
  /** خانات تُعرض بأعدادها عندما لا تُعرض اللوحة كاملة */
  reveal: number[];
  /** الخانة المخفية التي يُطلب إكمالها */
  hiddenCell?: number;
  /** خانات تُظلَّل للمساعدة (تُستخدم في التلميحات) */
  highlight: number[];
  /** هل يجيب الطفل بالنقر على خانة؟ */
  clickable: boolean;
  /** موضع الأفاتار الابتدائي في وضع الحركة */
  start?: number;
}

export interface QuestionHint {
  /** جملة قصيرة (حتى ثماني كلمات) يقولها الرفيق */
  textAr: string;
  audioId: string;
  /** مقاطع صوتية مركّبة بالترتيب (بديل عن audioId للنصوص التي تحوي أعدادًا) */
  audioParts?: string[];
  highlight?: number[];
  /** يكشف اللوحة كاملة إن كانت مخفية */
  revealSquare?: boolean;
  /** سهم اتجاه من خانة إلى خانة */
  arrow?: { from: number; to: number; labelAr: string };
  /** أزرار الحركة التي تنبض مع هذا التلميح (الزوج أو الزر المحدد) */
  pulse?: 'jump' | 'step' | 'jump_more' | 'jump_less' | 'step_more' | 'step_less';
}

export interface Evaluation {
  tag: ErrorTag;
  /** جملة قصيرة للطفل */
  feedbackAr: string;
  /** معرّف المقطع الصوتي للجملة */
  audioId: string;
}

/**
 * جزء من العرض البصري للسؤال: نص قصير، أو عدد كبير في بطاقة، أو عملية (مثل "عشرة أكثر") في بطاقة بأيقونة اختيارية.
 * الطفل يرى الأعداد والعملية كبطاقات واضحة بدل جملة طويلة، والجملة الكاملة تُنطق وتُكتب في فقاعة الرفيق.
 */
export type PromptPart =
  | { kind: 'text'; textAr: string }
  | { kind: 'number'; value: number; tone?: 'start' | 'unknown' }
  | { kind: 'op'; textAr: string; iconAr?: string };

export interface GeneratedQuestion {
  id: string;
  skillCode: string;
  templateCode: TemplateCode;
  variant: string;
  seed: number;
  representation: RepresentationType;
  /** جملة السؤال الكاملة القصيرة (حتى ثماني كلمات) كما تُنطق */
  promptAr: string;
  /** العرض البصري للسؤال بالبطاقات */
  promptParts: PromptPart[];
  /** معرّف ملف الصوت المقابل للنص؛ فارغ إن كان النص متغيرًا */
  audioId: string;
  /** مقاطع صوتية مركّبة بالترتيب تنطق السؤال (كلمات ثابتة وأعداد) */
  audioParts: string[];
  square?: SquareView;
  inputMode: InputMode;
  matcher: AnswerMatcher;
  /** حتى ثلاثة تلميحات متدرجة */
  hints: QuestionHint[];
  /** شرح قصير يُعرض بعد استنفاد المحاولات */
  explainAr: string;
  explainParts: string[];
  /** المسار الذي يسلكه الأفاتار في المثال المحلول (خانات متتالية) */
  solutionPath: number[];
  /** تصنيف الإجابة وجملة التغذية الراجعة */
  evaluate(given: number | null): Evaluation;
}
