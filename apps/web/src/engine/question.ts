// الشكل الموحد لأي سؤال مولَّد، مهما كان قالب اللعب

import type { AnswerMatcher } from './answers';
import type { RepresentationType } from './mastery';

export type TemplateCode = 'HUNDRED_SQUARE';

/** ما تعرضه لوحة المائة لهذا السؤال */
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
}

export interface GeneratedQuestion {
  id: string;
  skillCode: string;
  templateCode: TemplateCode;
  variant: string;
  seed: number;
  representation: RepresentationType;
  promptAr: string;
  /** معرّف ملف الصوت المقابل للنص (يُستخدم مع نظام الصوت) */
  audioId: string;
  square?: SquareView;
  inputMode: 'numpad' | 'cell';
  matcher: AnswerMatcher;
  /** ثلاثة تلميحات متدرجة؛ كل تلميح قد يضيف خانات للتظليل */
  hints: Array<{ textAr: string; audioId: string; highlight?: number[]; revealSquare?: boolean }>;
  /** رسالة شرح نهائية عند استنفاد المحاولات */
  explainAr: string;
  /** تغذية راجعة مرتبطة بنوع الخطأ */
  feedbackFor(given: number | null): string;
}
