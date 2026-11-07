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
  highlight?: number[];
  /** يكشف اللوحة كاملة إن كانت مخفية */
  revealSquare?: boolean;
  /** سهم اتجاه من خانة إلى خانة */
  arrow?: { from: number; to: number; labelAr: string };
}

export interface Evaluation {
  tag: ErrorTag;
  /** جملة قصيرة للطفل */
  feedbackAr: string;
}

export interface GeneratedQuestion {
  id: string;
  skillCode: string;
  templateCode: TemplateCode;
  variant: string;
  seed: number;
  representation: RepresentationType;
  /** جملة السؤال القصيرة (حتى ثماني كلمات) */
  promptAr: string;
  /** معرّف ملف الصوت المقابل للنص؛ فارغ إن كان النص متغيرًا */
  audioId: string;
  square?: SquareView;
  inputMode: InputMode;
  matcher: AnswerMatcher;
  /** حتى ثلاثة تلميحات متدرجة */
  hints: QuestionHint[];
  /** شرح قصير يُعرض بعد استنفاد المحاولات */
  explainAr: string;
  /** المسار الذي يسلكه الأفاتار في المثال المحلول (خانات متتالية) */
  solutionPath: number[];
  /** تصنيف الإجابة وجملة التغذية الراجعة */
  evaluate(given: number | null): Evaluation;
}
