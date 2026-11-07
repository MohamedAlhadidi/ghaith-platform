// معجم المقاطع الصوتية الثابتة: معرّف ← نص. كل ما يُنطق في الأسئلة والتلميحات والتغذية الراجعة يُركَّب من هذه المقاطع
// ومن مقاطع الأعداد (num.1 إلى num.100). المعرّفات ثابتة لأن ملفات الصوت تُسمّى بها.
// القاعدة: مصطلح واحد ثابت لكل مفهوم (عشرة أكثر، قفزة، خطوة، العقود، نقطة المنتصف، الخانة الصفراء)

export const PHRASES: Record<string, string> = {
  // كلمات الربط والأفعال
  'w.what_number': 'ما العدد؟',
  'w.of': 'من',
  'w.and': 'و',
  'w.to': 'إلى',
  'w.is': 'يساوي',
  'w.between': 'بين',
  'w.you_are_on': 'أنت على',
  'w.go_to': 'اذهب إلى',
  'w.jump_down': 'اقفز إلى أسفل',
  'w.twice': 'مرتين',
  'w.three_times': 'ثلاث مرات',
  'w.tap_between': 'انقر على عدد بين',
  'w.tap_midpoint': 'انقر على نقطة المنتصف بين',
  'w.where': 'أين',
  'w.tap_it': 'انقر عليه.',
  'w.the_number': 'العدد',
  'w.find': 'ابحث عن',
  'w.in_board': 'في اللوحة.',
  'w.above_it': 'فوقها',
  'w.below_it': 'تحتها',
  'w.beside_it': 'بجانبها',
  'w.row': 'صف',
  'w.cell': 'خانة',
  'w.start_row': 'ابدأ من صف',
  'w.midpoint_of': 'منتصف',
  'w.midpoint_five_after': 'المنتصف: خمس خطوات بعد',
  'w.count_jumps': 'عدّ القفزات:',
  'w.jump_more_ten': 'قفزة أكثر: عشرة.',
  'w.jump_less_ten': 'قفزة أقل: عشرة.',
  'w.step_more_one': 'خطوة أكثر: واحد.',
  'w.step_less_one': 'خطوة أقل: واحد.',
  'w.and_ten_more_q': 'وعشرة أكثر؟',
  'w.and_ten_less_q': 'وعشرة أقل؟',
  'w.and_one_more_q': 'وواحد أكثر؟',
  'w.and_one_less_q': 'وواحد أقل؟',
  'w.last_in_row': 'آخر الصف.',
  'w.first_next_row': 'أول الصف التالي.',
  'w.first_in_row': 'أول الصف.',
  'w.last_prev_row': 'آخر الصف السابق.',
  'w.is_jump_which': 'يعني قفزة. أي زر؟',
  'w.is_step_which': 'يعني خطوة. أي زر؟',
  'w.down_is_more': 'إلى أسفل يعني أكثر.',
  'w.up_is_less': 'إلى أعلى يعني أقل.',
  'w.one_step_more': 'خطوة واحدة أكثر.',
  'w.one_step_less': 'خطوة واحدة أقل.',
  'w.jump_more_this_button': 'قفزة أكثر: هذا الزر.',
  'w.move_means.ten_more': 'قفزة أكثر يعني عشرة أكثر.',
  'w.move_means.ten_less': 'قفزة أقل يعني عشرة أقل.',
  'w.move_means.one_more': 'خطوة أكثر يعني واحد أكثر.',
  'w.move_means.one_less': 'خطوة أقل يعني واحد أقل.',

  // العمليات (المصطلحات الثابتة)
  'op.ten_more': 'عشرة أكثر',
  'op.ten_less': 'عشرة أقل',
  'op.one_more': 'واحد أكثر',
  'op.one_less': 'واحد أقل',
  'op.jump_more': 'قفزة أكثر',
  'op.jump_less': 'قفزة أقل',
  'op.step_more': 'خطوة أكثر',
  'op.step_less': 'خطوة أقل',

  // أسئلة وتلميحات ثابتة
  'hs.prompt.missing_cell': 'انظر إلى الخانة الصفراء. ما العدد؟',
  'hs.hint.reveal': 'انظر إلى اللوحة كاملة.',
  'hs.hint.here': 'الكنز هنا.',
  'hs.hint.between.1': 'هذان العقدان. الكنز بينهما.',
  'hs.hint.between.2': 'كل هذا الصف بينهما.',
  'hs.hint.between.3': 'مثل هذا.',
  'hs.hint.midpoint.2': 'عدّ خمس خطوات.',
  'hs.hint.midpoint.3': 'هنا المنتصف.',
  'hs.hint.locate.2': 'الكنز في هذا الصف.',
  'hs.hint.locate.3': 'هنا.',

  // التغذية الراجعة حسب وسم الخطأ
  'fb.none': 'أحسنت!',
  'fb.not_a_number': 'اكتب عددًا.',
  'fb.confused_step': 'انتبه: خطوة أم قفزة؟',
  'fb.wrong_direction': 'انتبه: أكثر أم أقل؟',
  'fb.reversed_digits': 'انتبه: العشرات أولًا، ثم الآحاد.',
  'fb.dropped_zero': 'انتبه إلى الصفر.',
  'fb.off_by_one': 'قريب! هو جاره في الصف.',
  'fb.off_by_ten': 'قريب! هو في صف آخر.',
  'fb.same_row': 'الصف صحيح. الخانة غير هذه.',
  'fb.same_column': 'العمود صحيح. الصف غير هذا.',
  'fb.on_boundary': 'هذا العقد نفسه. نريد عددًا بينهما.',
  'fb.not_midpoint': 'بينهما، لكن ليس المنتصف.',
  'fb.out_of_range': 'اللوحة من واحد إلى مائة.',
  'fb.skipped': 'حسنًا. التالي.',
  'fb.other': 'ليس هذا. انظر إلى اللوحة.',
  'fb.confused_step.jump': 'هذه خطوة. نريد قفزة: عشرة.',
  'fb.confused_step.step': 'هذه قفزة. نريد خطوة: واحد.',
  'fb.wrong_direction.more': 'ذهبت أقل. نريد أكثر.',
  'fb.wrong_direction.less': 'ذهبت أكثر. نريد أقل.',
  'fb.cj.no_move': 'لم تتحرك. اضغط قفزة أكثر.',
  'fb.cj.went_less': 'ذهبت أقل. نريد إلى أسفل.',
  'fb.cj.count_again': 'عدّ القفزات مرة أخرى.',
  'fb.cj.step': 'هذه خطوة. نريد قفزة فقط.',

  // واجهة
  'ui.pick_avatar': 'اختر شكلك على اللوحة.',
  'ui.tap_cell': 'انقر على الخانة في اللوحة.',
};

/** معرّف مقطع العدد */
export function num(n: number): string {
  return `num.${n}`;
}

/** هل المعرّف مقطع عدد صالح (1 إلى 100) */
export function isNumId(id: string): boolean {
  const m = /^num\.(\d{1,3})$/.exec(id);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 0 && n <= 100;
}
