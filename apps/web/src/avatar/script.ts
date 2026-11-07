// نصوص الرفيق: كل ما يقوله لغيث في كل موقف، بجمل قصيرة (حتى ثماني كلمات) وبمصطلحات ثابتة
// القواعد: لا عقاب ولا حزن، مدح الجهد لا الذكاء، تعليمة واحدة في كل مرة، ولا كلام أطول مما يلزم
// كل جملة لها معرّف صوت ثابت ليُسجَّل لاحقًا كملف؛ الجمل التي تحوي الاسم تُركَّب من مقطعين

import { createRng } from '../engine/rng';

export type Situation =
  | 'welcome' // أول ظهور في الجلسة
  | 'goal' // هدف اليوم
  | 'baseline_intro' // قبل خط الأساس
  | 'baseline_ack' // بعد كل إجابة في خط الأساس (محايد)
  | 'baseline_done'
  | 'model_intro' // قبل الشرح
  | 'worked_intro' // قبل المثال المحلول
  | 'worked_done' // بعد أداء المثال
  | 'guided_intro'
  | 'independent_intro'
  | 'check_intro'
  | 'correct' // إجابة صحيحة
  | 'correct_after_effort' // صحيحة بعد محاولة أو تلميح
  | 'wrong_retry' // خطأ وما زالت هناك محاولة
  | 'wrong_show' // استُنفدت المحاولات: سأريك الطريق
  | 'hesitation' // تردد طويل
  | 'auto_hint' // تلميح تلقائي بعد خطأين متشابهين
  | 'easier' // سؤال أسهل بالخريطة
  | 'harder' // سؤال بلا خريطة
  | 'fatigue' // اقتراح التوقف
  | 'resume' // عند استئناف جلسة منقطعة
  | 'paused'
  | 'over_time' // تجاوز الوقت: ننهي بأسئلة التحقق فقط
  | 'end' // نهاية الجلسة
  | 'end_short'; // نهاية مبكرة

interface Line {
  id: string;
  /** النص؛ {name} يُستبدل باسم الطفل */
  textAr: string;
}

/** عدة صيغ لكل موقف حتى لا يمل الطفل؛ تُختار بالبذرة لا عشوائيًا (قابل لإعادة الإنتاج) */
export const SCRIPT: Record<Situation, Line[]> = {
  welcome: [
    { id: 'c.welcome.1', textAr: 'أهلًا {name}! أنا رفيق.' },
    { id: 'c.welcome.2', textAr: 'أهلًا {name}! جاهز للخريطة؟' },
  ],
  goal: [{ id: 'c.goal.1', textAr: 'اليوم نبحث عن الكنز بالقفزة والخطوة.' }],
  baseline_intro: [{ id: 'c.baseline.intro', textAr: 'أولًا: ثمانية أسئلة وحدك. لا تلميح.' }],
  baseline_ack: [
    { id: 'c.baseline.ack.1', textAr: 'حسنًا. التالي.' },
    { id: 'c.baseline.ack.2', textAr: 'سجّلت. التالي.' },
  ],
  baseline_done: [{ id: 'c.baseline.done', textAr: 'انتهينا. الآن نتعلم معًا.' }],
  model_intro: [{ id: 'c.model.intro', textAr: 'انظر إلى الخريطة أولًا.' }],
  worked_intro: [{ id: 'c.worked.intro', textAr: 'شاهد: أنا أحل، وأنت تنظر.' }],
  worked_done: [{ id: 'c.worked.done', textAr: 'رأيت؟ الآن أنت.' }],
  guided_intro: [{ id: 'c.guided.intro', textAr: 'نلعب معًا. التلميح هنا إذا احتجت.' }],
  independent_intro: [{ id: 'c.independent.intro', textAr: 'الآن وحدك. أنا أشاهد.' }],
  check_intro: [{ id: 'c.check.intro', textAr: 'أسئلة جديدة. بلا تلميح هذه المرة.' }],
  correct: [
    { id: 'c.correct.1', textAr: 'أحسنت!' },
    { id: 'c.correct.2', textAr: 'صحيح! وجدت الكنز.' },
    { id: 'c.correct.3', textAr: 'ممتاز!' },
  ],
  correct_after_effort: [
    { id: 'c.effort.1', textAr: 'أحسنت! حاولت ونجحت.' },
    { id: 'c.effort.2', textAr: 'صحيح! التلميح ساعدك.' },
  ],
  wrong_retry: [
    { id: 'c.retry.1', textAr: 'ليس هذا. حاول مرة أخرى.' },
    { id: 'c.retry.2', textAr: 'قريب. جرّب ثانية.' },
  ],
  wrong_show: [{ id: 'c.show.1', textAr: 'سأريك الطريق. انظر.' }],
  hesitation: [
    { id: 'c.hesitation.1', textAr: 'تريد تلميحًا؟ اضغط المصباح.' },
    { id: 'c.hesitation.2', textAr: 'خذ وقتك. المصباح يساعد.' },
  ],
  auto_hint: [{ id: 'c.autohint.1', textAr: 'انتبه هنا. هذا تلميح.' }],
  easier: [{ id: 'c.easier.1', textAr: 'نجرّب على الخريطة.' }],
  harder: [{ id: 'c.harder.1', textAr: 'رائع! جرّب بلا خريطة.' }],
  fatigue: [{ id: 'c.fatigue.1', textAr: 'عملت كثيرًا. نكمل غدًا؟' }],
  resume: [{ id: 'c.resume.1', textAr: 'أهلًا من جديد! نكمل من هنا.' }],
  paused: [{ id: 'c.paused.1', textAr: 'حفظت مكانك. إلى اللقاء!' }],
  over_time: [{ id: 'c.overtime.1', textAr: 'الوقت انتهى تقريبًا. أسئلة أخيرة.' }],
  end: [
    { id: 'c.end.1', textAr: 'انتهينا يا {name}! حصلت على نجوم.' },
    { id: 'c.end.2', textAr: 'أحسنت يا {name}! عمل رائع اليوم.' },
  ],
  end_short: [{ id: 'c.end.short', textAr: 'حسنًا يا {name}. نكمل غدًا.' }],
};

/** يختار جملة لموقف ببذرة ثابتة ويضع اسم الطفل */
export function line(situation: Situation, seed: number, name = 'غيث'): { id: string; textAr: string } {
  const options = SCRIPT[situation];
  const pick = options[createRng(seed).int(0, options.length - 1)];
  return { id: pick.id, textAr: pick.textAr.replace('{name}', name) };
}

/** عدد كلمات جملة (للاختبار: كل الجمل حتى ثماني كلمات) */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
