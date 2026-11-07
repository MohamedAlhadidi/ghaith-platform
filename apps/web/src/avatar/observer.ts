// مراقب السؤال: يقيس ما لا تراه الإجابة وحدها (أول فعل، التردد، التلميحات، إعادة السماع)
// منطق خالص بلا واجهة ليُختبر على حدة؛ الشاشة تُبلغه بالأفعال فقط

export interface QuestionObservation {
  responseMs: number;
  firstResponseMs: number;
  hesitationMs: number;
  audioReplays: number;
  hintSuggested: boolean;
}

export class QuestionObserver {
  private startedAt: number;
  private lastActionAt: number;
  private firstActionAt: number | null = null;
  private longestIdleMs = 0;
  private replays = 0;
  private suggested = false;

  constructor(now: number = Date.now()) {
    this.startedAt = now;
    this.lastActionAt = now;
  }

  /** أي فعل من الطفل: رقم، نقرة، حركة، تلميح */
  action(now: number = Date.now()): void {
    if (this.firstActionAt === null) this.firstActionAt = now;
    this.longestIdleMs = Math.max(this.longestIdleMs, now - this.lastActionAt);
    this.lastActionAt = now;
  }

  replay(now: number = Date.now()): void {
    this.replays++;
    this.action(now);
  }

  markSuggested(): void {
    this.suggested = true;
  }

  /** الزمن منذ آخر فعل (لاكتشاف التردد) */
  idleMs(now: number = Date.now()): number {
    return now - this.lastActionAt;
  }

  /** هل تجاوز التردد الحد ولم يُقترح تلميح بعد */
  shouldSuggestHint(thresholdMs: number, now: number = Date.now()): boolean {
    return !this.suggested && this.idleMs(now) >= thresholdMs;
  }

  snapshot(now: number = Date.now()): QuestionObservation {
    const idleNow = now - this.lastActionAt;
    return {
      responseMs: now - this.startedAt,
      firstResponseMs: (this.firstActionAt ?? now) - this.startedAt,
      hesitationMs: Math.max(this.longestIdleMs, idleNow),
      audioReplays: this.replays,
      hintSuggested: this.suggested,
    };
  }
}
