// الدرس الأول: لوحة المائة (كتاب التلميذ ص 4–5، الوحدة 1أ، النشاط الأساسي 1-2) بلعبة "خريطة الكنز"
import { HUNDRED_SQUARE_SKILL } from '../../engine/hundredSquare';

/** شاشة شرح واحدة: جملة قصيرة يقولها الرفيق وما تُظهره الخريطة */
export interface ModelScreen {
  audioId: string;
  textAr: string;
  showAll: boolean;
  highlight: number[];
  /** سهم توضيحي من خانة إلى خانة */
  arrow?: { from: number; to: number; labelAr: string };
  /** موضع الأفاتار على الخريطة في هذه الشاشة */
  avatarAt?: number;
}

export interface LessonDefinition {
  code: string;
  titleAr: string;
  gameTitleAr: string;
  unitCode: string;
  skillCode: string;
  /** أرقام الصفحات لكل طبعة؛ غياب الطبعة يعني "صفحة غير مؤكدة" */
  pagesByEdition: Record<string, { from: number; to: number }>;
  objectiveAr: string;
  vocabularyAr: string[];
  model: ModelScreen[];
  counts: { baseline: number; guided: number; independent: number; check: number; maxAttemptsPerQuestion: number };
  paperActivityAr: string;
}

export const LESSON_L1A_01: LessonDefinition = {
  code: 'L1A-01',
  titleAr: 'لوحة المائة',
  gameTitleAr: 'خريطة الكنز',
  unitCode: '1A',
  skillCode: HUNDRED_SQUARE_SKILL,
  pagesByEdition: { 'OM-2020-ED1': { from: 4, to: 5 } },
  objectiveAr: 'يحدد غيث موضع أي عدد من ١ إلى ١٠٠ على لوحة المائة، ويعرف أن القفزة (صف لأسفل) عشرة أكثر والخطوة (خانة) واحد أكثر.',
  vocabularyAr: ['الخريطة (لوحة المائة)', 'صف', 'قفزة = عشرة', 'خطوة = واحد', 'أكثر', 'أقل', 'العقد', 'المنتصف'],
  model: [
    { audioId: 'l1a01.model.1', textAr: 'هذه خريطة المائة. كل صف عشرة أعداد.', showAll: true, highlight: [], avatarAt: 1 },
    { audioId: 'l1a01.model.2', textAr: 'قفزة لأسفل: عشرة أكثر.', showAll: true, highlight: [24, 34], arrow: { from: 24, to: 34, labelAr: '+١٠' }, avatarAt: 24 },
    { audioId: 'l1a01.model.3', textAr: 'خطوة: واحد أكثر.', showAll: true, highlight: [33, 34], arrow: { from: 33, to: 34, labelAr: '+١' }, avatarAt: 33 },
    { audioId: 'l1a01.model.4', textAr: 'العقود تنتهي بصفر: عشرة، عشرون، ثلاثون.', showAll: true, highlight: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], avatarAt: 10 },
    { audioId: 'l1a01.model.5', textAr: 'الآن نبحث عن الكنز معًا.', showAll: true, highlight: [], avatarAt: 1 },
  ],
  counts: { baseline: 8, guided: 3, independent: 5, check: 3, maxAttemptsPerQuestion: 3 },
  paperActivityAr: 'اطبع لوحة مائة أو ارسمها، وغطِّ خمسة أعداد ببطاقات، واطلب من غيث أن يقول العدد المغطّى قبل أن يرفع البطاقة.',
};

/** النصوص الثابتة المشتركة التي تحتاج ملفات صوت (معرّف ← نص) */
export const SHARED_AUDIO_TEXTS: Record<string, string> = {
  'ui.welcome': 'أهلًا غيث! هل أنت مستعد؟',
  'ui.pick_avatar': 'اختر شكلك على الخريطة.',
  'ui.paper_suggestion': 'اطلب من بابا أو ماما لعبة البطاقات على الورق.',
  'hs.prompt.missing_cell': 'خانة ممحوّة. ما العدد؟',
};
