// شاشة الدرس: شرح بالنموذج ← أسئلة بثلاث مراحل (توجيه، مستقل، تحقق) ← نهاية واضحة
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { LESSON_L1A_01, SHARED_AUDIO_TEXTS, type LessonDefinition } from '../content/lessons/L1A-01';
import { planSession, type PlannedQuestion } from '../session/planner';
import { matchAnswer, parseIntegerAnswer, toArabicIndic } from '../engine/answers';
import { endSession, heartbeat, recordAttempt, recordHelp, saveResume, startSession } from '../data/repo';
import { say, stopAudio } from '../audio/audio';
import { HundredSquare } from '../ui/HundredSquare';
import { NumberPad } from '../ui/NumberPad';

const LESSONS: Record<string, LessonDefinition> = { 'L1A-01': LESSON_L1A_01 };

type Stage = { kind: 'loading' } | { kind: 'model'; index: number } | { kind: 'question'; index: number } | { kind: 'end' };

const PHASE_LABEL = { guided: 'نلعب معًا', independent: 'حل وحدك', check: 'أسئلة جديدة' } as const;
const PHASE_INTRO = { guided: 'ui.guided_intro', independent: 'ui.independent_intro', check: 'ui.check_intro' } as const;

export function LessonScreen({ lessonCode }: { lessonCode: string }) {
  const lesson = LESSONS[lessonCode];
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [plan, setPlan] = useState<PlannedQuestion[]>([]);
  const [earned, setEarned] = useState(0);

  // حالة السؤال الجاري
  const [attempts, setAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [extraHighlight, setExtraHighlight] = useState<number[]>([]);
  const [revealSquare, setRevealSquare] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [marked, setMarked] = useState<{ cell: number; correct: boolean } | undefined>();
  const [locked, setLocked] = useState(false);
  const [focusedCell, setFocusedCell] = useState<number>(1);
  const startedAt = useRef<number>(Date.now());

  // بدء الجلسة وتخطيط الأسئلة
  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    startSession(lesson.code).then((s) => {
      if (cancelled) return;
      setSessionId(s.id);
      setPlan(planSession(lesson, s.id));
      setStage({ kind: 'model', index: 0 });
    });
    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [lesson]);

  // نبض الجلسة كل 30 ثانية ليُعرف أين انقطعت إن أُغلق التطبيق
  useEffect(() => {
    if (!sessionId) return;
    const t = window.setInterval(() => void heartbeat(sessionId), 30000);
    return () => window.clearInterval(t);
  }, [sessionId]);

  const current = stage.kind === 'question' ? plan[stage.index] : undefined;
  const prevPhase = stage.kind === 'question' && stage.index > 0 ? plan[stage.index - 1].phase : undefined;

  const resetQuestionState = useCallback(() => {
    setAttempts(0);
    setHintLevel(0);
    setHintText(null);
    setExtraHighlight([]);
    setRevealSquare(false);
    setFeedback(null);
    setMarked(undefined);
    setLocked(false);
    setFocusedCell(1);
    startedAt.current = Date.now();
  }, []);

  // نطق النص عند كل شاشة شرح أو سؤال جديد
  useEffect(() => {
    if (stage.kind === 'model' && lesson) {
      const m = lesson.model[stage.index];
      void say(m.audioId, m.textAr);
    } else if (stage.kind === 'question' && current && sessionId) {
      resetQuestionState();
      void saveResume({ sessionId, lessonCode: lesson.code, stepIndex: 1, questionIndex: stage.index });
      const introId = current.phase !== prevPhase ? PHASE_INTRO[current.phase] : null;
      const speakPrompt = () => void say(current.question.audioId, current.question.promptAr);
      if (introId) {
        void say(introId, SHARED_AUDIO_TEXTS[introId]).then(speakPrompt);
      } else {
        speakPrompt();
      }
    } else if (stage.kind === 'end') {
      void say('ui.session_done', SHARED_AUDIO_TEXTS['ui.session_done']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const squareView = useMemo(() => {
    if (!current?.question.square) return undefined;
    const base = current.question.square;
    return revealSquare ? { ...base, showAll: true } : base;
  }, [current, revealSquare]);

  const finishQuestion = useCallback(
    async (correct: boolean, given: string) => {
      if (!current || !sessionId) return;
      setLocked(true);
      const q = current.question;
      const attemptsCount = attempts + 1;
      const event = await recordAttempt({
        sessionId,
        childId: 'ghaith',
        skillCode: q.skillCode,
        templateCode: q.templateCode,
        variant: q.variant,
        seed: q.seed,
        representation: q.representation,
        phase: current.phase,
        source: 'app',
        givenAnswer: given,
        firstTryCorrect: correct && attemptsCount === 1,
        attemptsCount,
        hintsUsed: hintLevel,
        responseMs: Date.now() - startedAt.current,
        isReview: false,
      });
      for (let level = 1; level <= hintLevel; level++) await recordHelp(event.id, 'hint', level);
      if (correct && attemptsCount === 1 && current.phase !== 'guided') setEarned((e) => e + 1);
    },
    [attempts, current, hintLevel, sessionId],
  );

  const next = useCallback(async () => {
    if (stage.kind !== 'question') return;
    const nextIndex = stage.index + 1;
    if (nextIndex >= plan.length) {
      if (sessionId) await endSession(sessionId, 'completed');
      setEarned((e) => e + 3);
      setStage({ kind: 'end' });
    } else {
      setStage({ kind: 'question', index: nextIndex });
    }
  }, [plan.length, sessionId, stage]);

  const answer = useCallback(
    async (given: string | number) => {
      if (!current || locked) return;
      const q = current.question;
      const result = matchAnswer(q.matcher, given);
      const givenNumber = typeof given === 'number' ? given : parseIntegerAnswer(given);
      if (q.inputMode === 'cell' && typeof given === 'number') setMarked({ cell: given, correct: result.correct });
      if (result.correct) {
        setFeedback({ text: 'أحسنت!', ok: true });
        void say('ui.correct', SHARED_AUDIO_TEXTS['ui.correct']);
        await finishQuestion(true, result.canonical);
        window.setTimeout(() => void next(), 1400);
        return;
      }
      const tries = attempts + 1;
      setAttempts(tries);
      const text = q.feedbackFor(givenNumber);
      if (tries >= lesson.counts.maxAttemptsPerQuestion) {
        setFeedback({ text: q.explainAr, ok: false });
        void say('', q.explainAr);
        await finishQuestion(false, result.canonical);
      } else {
        setFeedback({ text, ok: false });
        void say('', text);
      }
    },
    [attempts, current, finishQuestion, lesson, locked, next],
  );

  const showHint = useCallback(() => {
    if (!current || !current.hintsAllowed || locked) return;
    const level = Math.min(hintLevel + 1, current.question.hints.length);
    if (level === hintLevel) return;
    const hint = current.question.hints[level - 1];
    setHintLevel(level);
    setHintText(hint.textAr);
    if (hint.highlight) setExtraHighlight(hint.highlight);
    if (hint.revealSquare) setRevealSquare(true);
    void say('', hint.textAr);
  }, [current, hintLevel, locked]);

  if (!lesson) {
    return (
      <main className="screen screen-center">
        <p className="subtitle">هذا الدرس غير متاح بعد.</p>
        <button type="button" className="big-button" onClick={() => navigate('/')}>رجوع</button>
      </main>
    );
  }

  if (stage.kind === 'loading') return <main className="screen screen-center"><p className="subtitle">لحظة…</p></main>;

  if (stage.kind === 'model') {
    const m = lesson.model[stage.index];
    const last = stage.index === lesson.model.length - 1;
    return (
      <main className="screen">
        <div className="progress" aria-hidden="true">
          {lesson.model.map((_, i) => <span key={i} className={`progress-dot ${i < stage.index ? 'done' : i === stage.index ? 'now' : ''}`} />)}
          <span className="phase-label">الشرح</span>
        </div>
        <div className="lesson-layout">
          <section className="panel">
            <div className="prompt-row">
              <p className="prompt">{m.textAr}</p>
              <button type="button" className="icon-button" aria-label="أعد السماع" onClick={() => void say(m.audioId, m.textAr)}>🔊</button>
            </div>
            <div className="button-row">
              {/* الزر الأساسي أولًا ليبقى في الموضع نفسه (يمين الصف) في كل الشاشات */}
              <button type="button" className="big-button" autoFocus onClick={() => setStage(last ? { kind: 'question', index: 0 } : { kind: 'model', index: stage.index + 1 })}>
                {last ? 'ابدأ اللعب' : 'التالي'}
              </button>
              {stage.index > 0 && <button type="button" className="big-button secondary" onClick={() => setStage({ kind: 'model', index: stage.index - 1 })}>السابق</button>}
            </div>
          </section>
          <HundredSquare view={{ showAll: m.showAll, reveal: [], highlight: m.highlight, clickable: false }} arrow={m.arrow} />
        </div>
      </main>
    );
  }

  if (stage.kind === 'end') {
    return (
      <main className="screen screen-center">
        <h1 className="title">أحسنت يا غيث!</h1>
        <div className="stars">{'★'.repeat(Math.min(earned, 12))}</div>
        <p className="subtitle">حصلت اليوم على {toArabicIndic(earned)} نجوم</p>
        <p className="note">{SHARED_AUDIO_TEXTS['ui.paper_suggestion']} {lesson.paperActivityAr}</p>
        <div className="button-row">
          <button type="button" className="big-button" onClick={() => navigate('/')}>انتهيت</button>
        </div>
      </main>
    );
  }

  const q = current!.question;
  const phaseIndex = plan.filter((p) => p.phase === current!.phase);
  const posInPhase = phaseIndex.findIndex((p) => p.index === current!.index && p.phase === current!.phase);
  return (
    <main className="screen">
      <div className="progress" aria-hidden="true">
        {phaseIndex.map((_, i) => <span key={i} className={`progress-dot ${i < posInPhase ? 'done' : i === posInPhase ? 'now' : ''}`} />)}
        <span className="phase-label">{PHASE_LABEL[current!.phase]}</span>
      </div>
      <div className="lesson-layout">
        <section className="panel">
          <div className="prompt-row">
            <p className="prompt">{q.promptAr}</p>
            <button type="button" className="icon-button" aria-label="أعد السماع" onClick={() => void say(q.audioId, q.promptAr)}>🔊</button>
            {current!.hintsAllowed && (
              <button type="button" className="icon-button" aria-label="تلميح" disabled={locked || hintLevel >= q.hints.length} onClick={showHint}>💡</button>
            )}
          </div>
          {hintText && <div className="hint-text">{hintText}</div>}
          <div className={`feedback ${feedback ? (feedback.ok ? 'ok' : 'bad') : ''}`} aria-live="assertive">{feedback?.text ?? ''}</div>
          {q.inputMode === 'numpad' ? (
            <NumberPad resetKey={q.id} disabled={locked} onSubmit={(v) => void answer(v)} />
          ) : (
            <p className="subtitle">انقر على الخانة الصحيحة في اللوحة، أو تنقّل بالأسهم واضغط Enter.</p>
          )}
          {locked && (
            <div className="button-row">
              <button type="button" className="big-button" onClick={() => void next()} autoFocus>التالي</button>
            </div>
          )}
        </section>
        {squareView && (
          <HundredSquare
            view={squareView}
            extraHighlight={extraHighlight}
            marked={marked}
            focusedCell={focusedCell}
            onFocusMove={setFocusedCell}
            onCellClick={q.inputMode === 'cell' ? (n) => void answer(n) : undefined}
          />
        )}
      </div>
    </main>
  );
}
