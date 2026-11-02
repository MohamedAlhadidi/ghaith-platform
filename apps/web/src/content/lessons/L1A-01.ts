// الدرس الأول: لوحة المائة (كتاب التلميذ ص 4–5، الوحدة 1أ، النشاط الأساسي 1-2)
import { HUNDRED_SQUARE_SKILL } from '../../engine/hundredSquare';

/** شاشة نموذج (شرح) واحدة: نص منطوق وما تُظهره اللوحة */
export interface ModelScreen {
  audioId: string;
  textAr: string;
  showAll: boolean;
  highlight: number[];
  /** سهم توضيحي من خانة إلى خانة */
  arrow?: { from: number; to: number; labelAr: string };
}

export interface LessonDefinition {
  code: string;
  titleAr: string;
  unitCode: string;
  skillCode: string;
  /** أرقام الصفحات لكل طبعة؛ غياب الطبعة يعني "صفحة غير مؤكدة" */
  pagesByEdition: Record<string, { from: number; to: number }>;
  objectiveAr: string;
  vocabularyAr: string[];
  model: ModelScreen[];
  counts: { guided: number; independent: number; check: number; maxAttemptsPerQuestion: number };
  paperActivityAr: string;
}

export const LESSON_L1A_01: LessonDefinition = {
  code: 'L1A-01',
  titleAr: 'لوحة المائة',
  unitCode: '1A',
  skillCode: HUNDRED_SQUARE_SKILL,
  pagesByEdition: { 'OM-2020-ED1': { from: 4, to: 5 } },
  objectiveAr: 'يحدد غيث موضع أي عدد من ١ إلى ١٠٠ على لوحة المائة، ويعرف أن النزول صفًا يزيد عشرة والانتقال خانة يزيد واحدًا.',
  vocabularyAr: ['لوحة المائة', 'صف', 'عمود', 'عشرة أكثر', 'عشرة أقل', 'واحد أكثر', 'واحد أقل', 'العقود'],
  model: [
    { audioId: 'l1a01.model.1', textAr: 'هذه لوحة المائة. فيها الأعداد من واحد إلى مائة، كل صف فيه عشرة أعداد.', showAll: true, highlight: [] },
    { audioId: 'l1a01.model.2', textAr: 'انظر إلى العدد أربعة وعشرين. تحته مباشرة أربعة وثلاثون. عندما ننزل صفًا واحدًا نزيد عشرة.', showAll: true, highlight: [24, 34], arrow: { from: 24, to: 34, labelAr: '+١٠' } },
    { audioId: 'l1a01.model.3', textAr: 'وعندما نتحرك خانة واحدة في الصف نفسه نزيد واحدًا: بعد ثلاثة وثلاثين يأتي أربعة وثلاثون.', showAll: true, highlight: [33, 34], arrow: { from: 33, to: 34, labelAr: '+١' } },
    { audioId: 'l1a01.model.4', textAr: 'الأعداد التي تنتهي بصفر اسمها العقود: عشرة، عشرون، ثلاثون. كل عقد يبدأ صفًا جديدًا.', showAll: true, highlight: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
    { audioId: 'l1a01.model.5', textAr: 'الآن دورك. سنلعب معًا أولًا، ثم تحل وحدك.', showAll: true, highlight: [] },
  ],
  counts: { guided: 3, independent: 5, check: 3, maxAttemptsPerQuestion: 3 },
  paperActivityAr: 'اطبع لوحة مائة أو ارسمها على ورقة، وغطِّ خمسة أعداد ببطاقات صغيرة، واطلب من غيث أن يقول العدد المغطّى قبل أن يرفع البطاقة.',
};

/** النصوص الثابتة المشتركة التي تحتاج ملفات صوت (معرّف ← نص) */
export const SHARED_AUDIO_TEXTS: Record<string, string> = {
  'ui.welcome': 'أهلًا غيث! هل أنت مستعد؟',
  'ui.start': 'ابدأ',
  'ui.correct': 'أحسنت!',
  'ui.try_again': 'حاول مرة أخرى.',
  'ui.hint': 'إليك تلميحًا.',
  'ui.next': 'السؤال التالي.',
  'ui.guided_intro': 'سنحل هذه الأسئلة معًا. اضغط على التلميح إذا احتجت مساعدة.',
  'ui.independent_intro': 'الآن حل وحدك. أنا هنا إذا احتجت تلميحًا.',
  'ui.check_intro': 'أسئلة جديدة لنرى ماذا تعلمت. بلا تلميحات هذه المرة.',
  'ui.session_done': 'انتهت جلسة اليوم. أحسنت يا غيث! حصلت على نجوم جديدة.',
  'ui.paper_suggestion': 'اطلب من بابا أو ماما أن يلعبا معك لعبة البطاقات على الورق.',
  'hs.prompt.missing_cell': 'ما العدد الناقص في الخانة؟',
  'hs.prompt.ten_more_less.more': 'ما العدد الذي يزيد عن هذا العدد بعشرة؟',
  'hs.prompt.ten_more_less.less': 'ما العدد الذي ينقص عن هذا العدد بعشرة؟',
  'hs.prompt.one_more_less.more': 'ما العدد الذي يزيد عن هذا العدد بواحد؟',
  'hs.prompt.one_more_less.less': 'ما العدد الذي ينقص عن هذا العدد بواحد؟',
  'hs.prompt.between_decades': 'اكتب أي عدد يقع بين هذين العقدين.',
  'hs.prompt.midpoint': 'ما العدد الذي في منتصف المسافة بين هذين العقدين؟',
  'hs.prompt.locate': 'انقر على العدد في لوحة المائة.',
};
