// شاشة الجلسة: خط أساس (أول مرة) ← شرح ← موجّه بتلاشٍ ← وحدك ← تحقق ← نهاية، مع الرفيق والأفاتار والمراقب
// كل انتقال يمر عبر advance() الواحدة بحارس يمنع التقدم المزدوج، وكل مؤقت يُلغى عند أي فعل أو مغادرة
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { LESSON_L1A_01, type LessonDefinition } from '../content/lessons/L1A-01';
import { applyAdaptation, planSession, replayAdaptations, shortcutForTime, type AppliedAdaptation, type PlannedQuestion } from '../session/planner';
import { matchAnswer, parseIntegerAnswer, toArabicIndic } from '../engine/answers';
import type { ErrorTag } from '../engine/errors';
import type { QuestionHint } from '../engine/question';
import type { Readiness } from '../engine/hundredSquare';
import {
  attemptsForSession,
  endSession,
  getProfile,
  hasBaseline,
  readinessFromDb,
  heartbeat,
  loadResume,
  recordAttempt,
  recordHelp,
  recordSessionEvent,
  saveObservation,
  saveProfile,
  saveResume,
  sessionsSinceBaseline,
  startSession,
  type ChildProfile,
} from '../data/repo';
import { say, setVoiceEnabled, stopAudio } from '../audio/audio';
import { HundredSquare } from '../ui/HundredSquare';
import { NumberPad } from '../ui/NumberPad';
import { MoveControls } from '../ui/MoveControls';
import { PromptChips } from '../ui/PromptChips';
import { GhaithAvatar, AVATAR_LOOK_LABELS, type AvatarLook, type AvatarState } from '../avatar/GhaithAvatar';
import { Companion, type CompanionMood } from '../avatar/Companion';
import { line, type Situation } from '../avatar/script';
import { QuestionObserver } from '../avatar/observer';
import { decideAdaptation, DEFAULT_ADAPT_RULES, type RecentAttempt } from '../avatar/adapt';
import { summarizeSession } from '../avatar/insights';
import { seedFromString } from '../engine/rng';
import { DEFAULT_CHILD_ID } from '../data/db';

const LESSONS: Record<string, LessonDefinition> = { 'L1A-01': LESSON_L1A_01 };
/** آخر مرة سُجّل فيها حدث استئناف (على مستوى الوحدة حتى لا يتكرر مع كل إعادة تركيب) */
let lastResumeLogAt = 0;

type Stage =
  | { kind: 'loading' }
  | { kind: 'pick_avatar' }
  | { kind: 'welcome' }
  | { kind: 'model'; index: number }
  | { kind: 'question'; index: number }
  | { kind: 'stop_prompt'; afterIndex: number }
  | { kind: 'paused' }
  | { kind: 'end'; short: boolean };

const PHASE_LABEL = { baseline: 'وحدك أولًا', warmup: 'تمرين القفز', guided: 'نلعب معًا', independent: 'وحدك', check: 'أسئلة جديدة' } as const;
const PHASE_INTRO: Record<PlannedQuestion['phase'], Situation> = { baseline: 'baseline_intro', warmup: 'warmup_intro', guided: 'guided_intro', independent: 'independent_intro', check: 'check_intro' };
/** بعد اقتراح التلميح: إن استمر التردد هذه المدة يُعطى التلميح الأول تلقائيًا (الترددات المسجّلة وصلت إلى 273 ثانية) */
const IDLE_AUTO_HINT_MS = 40000;
/** زر "لا أعرف" لا يعمل قبل هذه المدة حتى لا يُضغط عشوائيًا */
const SKIP_DELAY_MS = 6000;
/** الحد الأقصى بعد تجاوز وقت الجلسة في مرحلة التحقق */
const CHECK_GRACE_MS = 5 * 60000;

interface Bubble {
  text: string;
  audioId: string;
  mood: CompanionMood;
}

export function LessonScreen({ lessonCode }: { lessonCode: string }) {
  const lesson = LESSONS[lessonCode];
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [plan, setPlan] = useState<PlannedQuestion[]>([]);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [earned, setEarned] = useState(0);
  const [bubble, setBubble] = useState<Bubble>({ text: '', audioId: '', mood: 'idle' });

  // حالة السؤال الجاري (تُصفَّر مع كل سؤال)
  const [attempts, setAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [extraHighlight, setExtraHighlight] = useState<number[]>([]);
  const [arrow, setArrow] = useState<{ from: number; to: number; labelAr: string } | undefined>();
  const [revealSquare, setRevealSquare] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean | null } | null>(null);
  const [marked, setMarked] = useState<{ cell: number; correct: boolean } | undefined>();
  const [locked, setLocked] = useState(false);
  const [focusedCell, setFocusedCell] = useState<number>(1);
  const [position, setPosition] = useState<number>(1);
  const [avatarAt, setAvatarAt] = useState<number | undefined>();
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [treasureAt, setTreasureAt] = useState<number | undefined>();
  const [path, setPath] = useState<number[]>([]);
  const [busy, setBusy] = useState(false); // أثناء المثال المحلول لا يُقبل إدخال
  const [hintPulse, setHintPulse] = useState(false);
  const [movePulse, setMovePulse] = useState<QuestionHint['pulse']>();
  const [skipReady, setSkipReady] = useState(false);
  const [overTime, setOverTime] = useState(false);

  // مراجع ثابتة لتجنب الإغلاقات القديمة في المؤقتات
  const sessionRef = useRef<{ id: string; startedAt: number; includeBaseline: boolean; readiness: Readiness } | null>(null);
  const planRef = useRef<PlannedQuestion[]>([]);
  const stageRef = useRef<Stage>({ kind: 'loading' });
  const profileRef = useRef<ChildProfile | null>(null);
  const earnedRef = useRef(0);
  const adaptationsRef = useRef<AppliedAdaptation[]>([]);
  const recentRef = useRef<RecentAttempt[]>([]);
  const observerRef = useRef<QuestionObserver>(new QuestionObserver());
  const firstErrorRef = useRef<ErrorTag>('none');
  const timersRef = useRef<number[]>([]);
  const advancingRef = useRef(false);
  const pendingStopRef = useRef<string | null>(null);
  const pendingLineRef = useRef<Situation | null>(null);
  const questionGenRef = useRef(0);
  const overTimeRef = useRef(false);
  // قفل متزامن: يُغلق قبل أي انتظار حتى لا تُسجَّل الإجابة نفسها مرتين من نقرتين أو ضغطتين سريعتين
  const lockedRef = useRef(false);

  planRef.current = plan;
  stageRef.current = stage;
  profileRef.current = profile;
  earnedRef.current = earned;

  const name = profile?.name ?? 'غيث';
  const look: AvatarLook = profile?.avatarLook ?? 'explorer';

  const after = useCallback((ms: number, fn: () => void) => {
    const t = window.setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);
  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const speak = useCallback((situation: Situation, mood: CompanionMood = 'talk', salt = '') => {
    const s = sessionRef.current?.id ?? 'x';
    const l = line(situation, seedFromString(`${s}:${situation}:${salt}`), profileRef.current?.name ?? 'غيث');
    setBubble({ text: l.textAr, audioId: l.id, mood });
    return say(l.textAr, l.id);
  }, []);

  const speakText = useCallback((text: string, audioId = '', mood: CompanionMood = 'talk') => {
    setBubble({ text, audioId, mood });
    return say(text, audioId);
  }, []);

  const persistResume = useCallback((s: Stage) => {
    const ses = sessionRef.current;
    if (!ses || !lesson) return;
    if (s.kind !== 'model' && s.kind !== 'question') return;
    void saveResume({ sessionId: ses.id, lessonCode: lesson.code, includeBaseline: ses.includeBaseline, readiness: ses.readiness, stage: { kind: s.kind, index: s.index }, earned: earnedRef.current, adaptations: adaptationsRef.current });
  }, [lesson]);

  const go = useCallback(
    (s: Stage) => {
      clearTimers();
      stopAudio();
      setStage(s);
      persistResume(s);
    },
    [clearTimers, persistResume],
  );

  // بدء الجلسة أو استئنافها
  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    (async () => {
      const p = await getProfile();
      setVoiceEnabled(p.voiceEnabled);
      if (cancelled) return;
      setProfile(p);
      const resume = await loadResume();
      if (cancelled) return;
      if (resume && resume.lessonCode === lesson.code) {
        const readiness = resume.readiness ?? {};
        sessionRef.current = { id: resume.sessionId, startedAt: Date.now(), includeBaseline: resume.includeBaseline, readiness };
        adaptationsRef.current = resume.adaptations;
        const rebuilt = replayAdaptations(lesson, resume.sessionId, planSession(lesson, resume.sessionId, { includeBaseline: resume.includeBaseline, readiness }), resume.adaptations, readiness);
        setPlan(rebuilt);
        setEarned(resume.earned);
        earnedRef.current = resume.earned;
        const prior = await attemptsForSession(resume.sessionId);
        recentRef.current = prior.map((a) => ({ phase: a.phase, correct: a.correct, firstTryCorrect: a.firstTryCorrect, hintsUsed: a.hintsUsed, errorTag: a.errorTag, firstResponseMs: a.firstResponseMs, representation: a.representation }));
        // إعادة التركيب السريعة (تحديث أو تنقل) لا تُسجَّل كاستئناف جديد؛ الاستئناف الحقيقي يبعد ثوانٍ على الأقل
        if (Date.now() - lastResumeLogAt > 10000) {
          lastResumeLogAt = Date.now();
          void recordSessionEvent(resume.sessionId, 'resume');
        }
        pendingLineRef.current = 'resume';
        setStage(resume.stage.kind === 'model' ? { kind: 'model', index: resume.stage.index } : { kind: 'question', index: resume.stage.index });
        return;
      }
      const [base, since, readiness] = await Promise.all([hasBaseline(lesson.skillCode), sessionsSinceBaseline(lesson.skillCode), readinessFromDb(lesson.skillCode)]);
      const includeBaseline = !base || since >= 5;
      const s = await startSession(lesson.code);
      if (cancelled) return;
      sessionRef.current = { id: s.id, startedAt: s.startedAt, includeBaseline, readiness };
      adaptationsRef.current = [];
      recentRef.current = [];
      setPlan(planSession(lesson, s.id, { includeBaseline, readiness }));
      setStage(p.avatarLook ? { kind: 'welcome' } : { kind: 'pick_avatar' });
    })();
    return () => {
      cancelled = true;
      clearTimers();
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  // نبض الجلسة كل 30 ثانية ليُعرف أين انقطعت إن أُغلق التطبيق
  useEffect(() => {
    const id = sessionRef.current?.id;
    if (!id || stage.kind === 'loading') return;
    const t = window.setInterval(() => void heartbeat(id), 30000);
    return () => window.clearInterval(t);
  }, [stage.kind]);

  const current = stage.kind === 'question' ? plan[stage.index] : undefined;
  const prevPhase = stage.kind === 'question' && stage.index > 0 ? plan[stage.index - 1].phase : undefined;

  const resetQuestionState = useCallback((q: PlannedQuestion) => {
    setAttempts(0);
    setHintLevel(0);
    setExtraHighlight([]);
    setArrow(undefined);
    setMovePulse(undefined);
    setSkipReady(false);
    setRevealSquare(false);
    setFeedback(null);
    setMarked(undefined);
    setLocked(false);
    lockedRef.current = false;
    setBusy(false);
    setHintPulse(false);
    setFocusedCell(q.question.square?.start ?? 1);
    setPosition(q.question.square?.start ?? 1);
    // الأفاتار حاضر على اللوحة في كل سؤال؛ يبدأ من خانة الانطلاق أو من أول الخريطة
    setAvatarAt(q.question.square ? (q.question.square.start ?? 1) : undefined);
    setAvatarState('idle');
    setTreasureAt(undefined);
    setPath([]);
    observerRef.current = new QuestionObserver();
    firstErrorRef.current = 'none';
    advancingRef.current = false;
  }, []);

  const applyHint = useCallback(
    (q: PlannedQuestion, level: number) => {
      const hint = q.question.hints[level - 1];
      if (!hint) return;
      setHintLevel(level);
      setHintPulse(false);
      if (hint.highlight) setExtraHighlight(hint.highlight);
      if (hint.arrow) setArrow(hint.arrow);
      setMovePulse(hint.pulse);
      if (hint.revealSquare) setRevealSquare(true);
      void speakText(hint.textAr, hint.audioId, 'think');
    },
    [speakText],
  );

  /** المثال المحلول: الأفاتار يمشي على المسار ثم يُكشف الكنز، ثم تعود الخريطة ليحل الطفل */
  const playWorked = useCallback(
    (q: PlannedQuestion, gen: number, then: () => void) => {
      const steps = q.question.solutionPath;
      const expected = q.question.matcher.kind === 'exact' ? q.question.matcher.value : steps[steps.length - 1];
      setBusy(true);
      void speak('worked_intro', 'talk');
      void recordSessionEvent(sessionRef.current?.id ?? '', 'worked_example', q.question.id);
      let delay = 1400;
      steps.forEach((cell, i) => {
        after(delay, () => {
          if (gen !== questionGenRef.current) return;
          setAvatarAt(cell);
          setAvatarState('walk');
          setPath(steps.slice(0, i + 1));
          if (i === steps.length - 1) {
            setTreasureAt(expected);
            setAvatarState('happy');
          }
        });
        delay += 800;
      });
      after(delay + 900, () => {
        if (gen !== questionGenRef.current) return;
        setAvatarAt(q.question.square?.start);
        setAvatarState('idle');
        setPath([]);
        setTreasureAt(undefined);
        setBusy(false);
        void speak('worked_done', 'talk').then(() => {
          if (gen !== questionGenRef.current) return;
          then();
        });
      });
    },
    [after, speak],
  );

  // تهيئة كل شاشة: نطق النص، والتلميح التلقائي أو المثال المحلول، وحفظ الاستئناف
  useEffect(() => {
    if (!lesson) return;
    const gen = ++questionGenRef.current;
    if (stage.kind === 'welcome') {
      const pending = pendingLineRef.current;
      pendingLineRef.current = null;
      void (pending ? speak(pending) : speak('welcome')).then(() => {
        if (gen === questionGenRef.current) void speak('goal');
      });
    } else if (stage.kind === 'pick_avatar') {
      void speakText('اختر شكلك على اللوحة.', 'ui.pick_avatar');
    } else if (stage.kind === 'model') {
      const m = lesson.model[stage.index];
      setAvatarAt(m.avatarAt);
      setAvatarState('idle');
      const pending = pendingLineRef.current;
      pendingLineRef.current = null;
      const sayModel = () => {
        if (gen === questionGenRef.current) void speakText(m.textAr, m.audioId);
      };
      if (stage.index === 0 && !pending) void speak('model_intro').then(sayModel);
      else if (pending) void speak(pending).then(sayModel);
      else sayModel();
    } else if (stage.kind === 'question' && current) {
      resetQuestionState(current);
      const q = current.question;
      const sayPrompt = () => {
        if (gen !== questionGenRef.current) return;
        void speakText(q.promptAr, q.audioId, 'talk').then(() => {
          if (gen !== questionGenRef.current) return;
          if (current.support === 'hint1' && current.hintsAllowed) after(600, () => gen === questionGenRef.current && applyHint(current, 1));
        });
      };
      const pending = pendingLineRef.current;
      pendingLineRef.current = null;
      const intro: Situation | null = pending ?? (current.phase !== prevPhase ? PHASE_INTRO[current.phase] : null);
      const start = () => {
        if (current.support === 'worked') playWorked(current, gen, sayPrompt);
        else sayPrompt();
      };
      if (intro) void speak(intro).then(() => gen === questionGenRef.current && start());
      else start();
    } else if (stage.kind === 'end') {
      void speak(stage.short ? 'end_short' : 'end', 'cheer');
    } else if (stage.kind === 'paused') {
      void speak('paused');
    } else if (stage.kind === 'stop_prompt') {
      void speak('fatigue', 'think');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // زر "لا أعرف" يُفعَّل بعد مهلة قصيرة حتى لا يُضغط عشوائيًا (خط الأساس الأول تخطّاه في 30 ثانية)
  useEffect(() => {
    if (stage.kind !== 'question' || !current || current.feedback === 'immediate') return;
    const t = window.setTimeout(() => setSkipReady(true), SKIP_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [stage, current]);

  // اكتشاف التردد: بلا فعل لمدة محددة في المراحل التي يُسمح فيها بالتلميح؛ وإن استمر التردد يُعطى التلميح الأول تلقائيًا
  useEffect(() => {
    if (stage.kind !== 'question' || !current || locked || busy) return;
    if (!current.hintsAllowed) return;
    let autoGiven = false;
    const t = window.setInterval(() => {
      const obs = observerRef.current;
      if (obs.shouldSuggestHint(DEFAULT_ADAPT_RULES.hesitationMs)) {
        obs.markSuggested();
        setHintPulse(true);
        void speak('hesitation', 'think', String(current.index));
        void recordSessionEvent(sessionRef.current?.id ?? '', 'hesitation', current.question.id);
      } else if (!autoGiven && hintLevel === 0 && obs.idleMs() >= DEFAULT_ADAPT_RULES.hesitationMs + IDLE_AUTO_HINT_MS) {
        autoGiven = true;
        void recordSessionEvent(sessionRef.current?.id ?? '', 'hesitation', `${current.question.id}:auto_hint`);
        void speak('idle_hint', 'think').then(() => applyHint(current, 1));
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage, current, locked, busy, speak, hintLevel, applyHint]);

  const squareView = useMemo(() => {
    if (!current?.question.square) return undefined;
    const base = current.question.square;
    return revealSquare ? { ...base, showAll: true } : base;
  }, [current, revealSquare]);

  const finish = useCallback(
    async (reason: 'completed' | 'stopped', short: boolean) => {
      const ses = sessionRef.current;
      if (!ses) return;
      await endSession(ses.id, reason, short);
      const all = await attemptsForSession(ses.id);
      await saveObservation(ses.id, summarizeSession(ses.id, all));
      if (reason === 'completed') setEarned((e) => e + 3);
      go({ kind: 'end', short });
    },
    [go],
  );

  /** الانتقال الوحيد إلى ما بعد السؤال الجاري */
  const advance = useCallback(() => {
    const s = stageRef.current;
    if (s.kind !== 'question' || advancingRef.current) return;
    advancingRef.current = true;
    clearTimers();
    const p = planRef.current;
    const ses = sessionRef.current;
    const lim = (profileRef.current?.sessionMinutes ?? 12) * 60000;
    const elapsed = ses ? Date.now() - ses.startedAt : 0;
    if (pendingStopRef.current) {
      pendingStopRef.current = null;
      go({ kind: 'stop_prompt', afterIndex: s.index });
      return;
    }
    const cur = p[s.index];
    let next = shortcutForTime(p, s.index, elapsed, lim);
    if (next !== s.index + 1 && !overTimeRef.current) {
      overTimeRef.current = true;
      setOverTime(true);
      pendingLineRef.current = 'over_time';
      void recordSessionEvent(ses?.id ?? '', 'over_time');
    }
    // خط الأساس ينتهي بالشرح قبل بقية الأسئلة
    if (cur.phase === 'baseline' && (next >= p.length || p[next].phase !== 'baseline')) {
      pendingLineRef.current = 'baseline_done';
      go({ kind: 'model', index: 0 });
      return;
    }
    // في التحقق: بعد تجاوز الوقت بخمس دقائق تُنهى الجلسة مختصرة (الجلستان المسجّلتان امتدتا إلى 15 و18 دقيقة)
    if (next >= p.length || (cur.phase === 'check' && elapsed > lim + CHECK_GRACE_MS)) {
      void finish('completed', overTimeRef.current || elapsed > lim + CHECK_GRACE_MS);
      return;
    }
    if (next > s.index + 1) next = Math.min(next, p.length - 1);
    go({ kind: 'question', index: next });
  }, [clearTimers, finish, go]);

  const recordFinal = useCallback(
    async (q: PlannedQuestion, correct: boolean, given: string, attemptsCount: number, hintsUsed: number) => {
      const ses = sessionRef.current;
      if (!ses) return;
      const obs = observerRef.current.snapshot();
      const event = await recordAttempt({
        sessionId: ses.id,
        childId: DEFAULT_CHILD_ID,
        skillCode: q.question.skillCode,
        templateCode: q.question.templateCode,
        variant: q.question.variant,
        seed: q.question.seed,
        representation: q.question.representation,
        inputMode: q.question.inputMode,
        phase: q.phase,
        source: 'app',
        givenAnswer: given,
        correct,
        firstTryCorrect: correct && attemptsCount === 1,
        attemptsCount,
        hintsUsed,
        errorTag: firstErrorRef.current,
        responseMs: obs.responseMs,
        firstResponseMs: obs.firstResponseMs,
        hesitationMs: obs.hesitationMs,
        audioReplays: obs.audioReplays,
        hintSuggested: obs.hintSuggested,
        adaptation: q.adaptation,
        isReview: false,
      });
      for (let level = 1; level <= hintsUsed; level++) await recordHelp(event.id, 'hint', level);
      for (let r = 0; r < obs.audioReplays; r++) await recordHelp(event.id, 'audio_replay', r + 1);
      recentRef.current.push({ phase: q.phase, correct, firstTryCorrect: event.firstTryCorrect, hintsUsed, errorTag: event.errorTag, firstResponseMs: obs.firstResponseMs, representation: q.question.representation });
      if (q.phase !== 'baseline') setEarned((e) => e + 1);

      // التكيّف للسؤال التالي (الموجّه والمستقل فقط)
      if ((q.phase === 'guided' || q.phase === 'independent') && lesson) {
        const elapsedMin = (Date.now() - ses.startedAt) / 60000;
        const decision = decideAdaptation(recentRef.current, elapsedMin);
        if (decision) {
          void recordSessionEvent(ses.id, 'adaptation', `${decision.kind}: ${decision.reasonAr}`);
          if (decision.kind === 'suggest_stop') {
            pendingStopRef.current = decision.reasonAr;
          } else {
            const applied: AppliedAdaptation = { atIndex: q.index + 1, kind: decision.kind, reasonAr: decision.reasonAr };
            const nextPlan = applyAdaptation(lesson, ses.id, planRef.current, applied, ses.readiness);
            if (nextPlan !== planRef.current) {
              adaptationsRef.current = [...adaptationsRef.current, applied];
              planRef.current = nextPlan;
              setPlan(nextPlan);
              pendingLineRef.current = decision.kind === 'harder' ? 'harder' : 'easier';
            }
          }
        }
      }
    },
    [lesson],
  );

  const answer = useCallback(
    async (given: string | number) => {
      if (!current || locked || lockedRef.current || busy || !lesson) return;
      observerRef.current.action();
      const q = current.question;
      // جيل السؤال: إن انتقلت الشاشة أثناء الانتظار (مثلًا بنقرة "التالي") فلا يُجدول انتقال ثانٍ على السؤال الجديد
      const gen = questionGenRef.current;
      const result = matchAnswer(q.matcher, given);
      const givenNumber = typeof given === 'number' ? given : parseIntegerAnswer(given);
      const evaluation = q.evaluate(givenNumber);
      if (q.inputMode === 'cell' && typeof given === 'number') setMarked({ cell: given, correct: result.correct });
      const tries = attempts + 1;
      setAttempts(tries);
      if (firstErrorRef.current === 'none' && !result.correct) firstErrorRef.current = evaluation.tag;
      const expected = q.matcher.kind === 'exact' ? q.matcher.value : givenNumber ?? undefined;

      // خط الأساس والتحقق: تسجيل محايد أو مؤجل، محاولة واحدة فقط
      if (current.feedback !== 'immediate') {
        lockedRef.current = true;
        setLocked(true);
        setFeedback({ text: '', ok: null });
        await recordFinal(current, result.correct, result.canonical, 1, 0);
        void speak('baseline_ack', 'idle', String(current.index));
        if (gen !== questionGenRef.current) return;
        after(900, advance);
        return;
      }

      if (result.correct) {
        lockedRef.current = true;
        setLocked(true);
        setFeedback({ text: evaluation.feedbackAr, ok: true });
        setAvatarState('happy');
        if (expected !== undefined) {
          setTreasureAt(expected);
          setAvatarAt(expected);
        }
        void speak(tries > 1 || hintLevel > 0 ? 'correct_after_effort' : 'correct', 'cheer', String(current.index));
        await recordFinal(current, true, result.canonical, tries, hintLevel);
        if (gen !== questionGenRef.current) return;
        after(1600, advance);
        return;
      }

      if (tries >= lesson.counts.maxAttemptsPerQuestion) {
        lockedRef.current = true;
        setLocked(true);
        setFeedback({ text: q.explainAr, ok: false });
        setAvatarState('think');
        setRevealSquare(true);
        setPath(q.solutionPath);
        setExtraHighlight(q.solutionPath);
        if (expected !== undefined) {
          setTreasureAt(expected);
          setAvatarAt(expected);
        }
        void speak('wrong_show', 'talk').then(() => say(q.explainAr));
        await recordFinal(current, false, result.canonical, tries, hintLevel);
        return;
      }
      setFeedback({ text: evaluation.feedbackAr, ok: false });
      setAvatarState('think');
      void speakText(evaluation.feedbackAr, '', 'think');
    },
    [advance, after, attempts, busy, current, hintLevel, lesson, locked, recordFinal, speak, speakText],
  );

  /** "لا أعرف" في خط الأساس والتحقق: يُسجَّل كمحاولة بوسم skipped ويُنتقل بهدوء */
  const skip = useCallback(async () => {
    if (!current || lockedRef.current || busy || current.feedback === 'immediate') return;
    observerRef.current.action();
    lockedRef.current = true;
    setLocked(true);
    firstErrorRef.current = 'skipped';
    setFeedback({ text: '', ok: null });
    const gen = questionGenRef.current;
    await recordFinal(current, false, '', 1, 0);
    if (gen !== questionGenRef.current) return;
    void speak('baseline_ack', 'idle', String(current.index));
    after(900, advance);
  }, [advance, after, busy, current, recordFinal, speak]);

  const showHint = useCallback(() => {
    if (!current || !current.hintsAllowed || locked || busy) return;
    observerRef.current.action();
    const level = Math.min(hintLevel + 1, current.question.hints.length);
    if (level === hintLevel) return;
    applyHint(current, level);
  }, [applyHint, busy, current, hintLevel, locked]);

  const replay = useCallback(() => {
    observerRef.current.replay();
    void say(bubble.text, bubble.audioId);
  }, [bubble]);

  const move = useCallback(
    (delta: 10 | -10 | 1 | -1) => {
      if (locked || busy) return;
      observerRef.current.action();
      const landed = position + delta;
      setPosition(landed);
      setAvatarAt(landed);
      setAvatarState('walk');
      after(350, () => setAvatarState('idle'));
      // في تمرين القفز يُربط اسم العملية بالعدد الذي وصل إليه بصوت ونص: "عشرة أكثر: تسعة وثلاثون"
      if (current?.question.variant === 'column_jumps') {
        const opName = delta === 10 ? 'عشرة أكثر' : delta === -10 ? 'عشرة أقل' : delta === 1 ? 'واحد أكثر' : 'واحد أقل';
        void speakText(`${opName}: ${toArabicIndic(landed)}`, '', 'talk');
      }
    },
    [after, busy, current, locked, position, speakText],
  );

  const pause = useCallback(() => {
    const ses = sessionRef.current;
    if (ses) void recordSessionEvent(ses.id, 'pause');
    persistResume(stageRef.current);
    clearTimers();
    stopAudio();
    setStage({ kind: 'paused' });
  }, [clearTimers, persistResume]);

  const chooseLook = useCallback(async (l: AvatarLook) => {
    const p = await saveProfile({ avatarLook: l });
    setProfile(p);
    setStage({ kind: 'welcome' });
  }, []);

  if (!lesson) {
    return (
      <main className="screen screen-center">
        <p className="subtitle">هذا الدرس غير متاح بعد.</p>
        <button type="button" className="big-button" onClick={() => navigate('/')}>رجوع</button>
      </main>
    );
  }

  if (stage.kind === 'loading') return <main className="screen screen-center" data-stage="loading"><p className="subtitle">لحظة…</p></main>;

  if (stage.kind === 'pick_avatar') {
    return (
      <main className="screen screen-center" data-stage="pick_avatar">
        <Companion textAr={bubble.text} mood="talk" onReplay={replay} />
        <div className="look-row">
          {(['explorer', 'sailor', 'astronaut'] as AvatarLook[]).map((l) => (
            <button type="button" key={l} className="look-card" onClick={() => void chooseLook(l)} data-look={l}>
              <GhaithAvatar look={l} size={120} state="idle" />
              <span>{AVATAR_LOOK_LABELS[l]}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (stage.kind === 'welcome') {
    return (
      <main className="screen screen-center" data-stage="welcome">
        <div className="hero-card">
        <GhaithAvatar look={look} size={170} state="happy" />
        <h1 className="title">{name}</h1>
        <Companion textAr={bubble.text} mood={bubble.mood} onReplay={replay} />
        <div className="button-row">
          <button type="button" className="big-button" autoFocus data-testid="start-session" onClick={() => go(sessionRef.current?.includeBaseline ? { kind: 'question', index: 0 } : { kind: 'model', index: 0 })}>
            ابدأ
          </button>
          <button type="button" className="big-button secondary" onClick={() => navigate('/')}>رجوع</button>
        </div>
        </div>
      </main>
    );
  }

  if (stage.kind === 'paused') {
    return (
      <main className="screen screen-center" data-stage="paused">
        <div className="hero-card">
        <GhaithAvatar look={look} size={150} state="idle" />
        <Companion textAr={bubble.text} mood="talk" />
        <div className="button-row">
          <button type="button" className="big-button" onClick={() => navigate('/')} autoFocus>رجوع</button>
        </div>
        </div>
      </main>
    );
  }

  if (stage.kind === 'stop_prompt') {
    return (
      <main className="screen screen-center" data-stage="stop_prompt">
        <div className="hero-card">
        <GhaithAvatar look={look} size={150} state="think" />
        <Companion textAr={bubble.text} mood="think" onReplay={replay} />
        <div className="button-row">
          <button type="button" className="big-button" autoFocus onClick={() => void finish('stopped', true)}>نكمل غدًا</button>
          <button
            type="button"
            className="big-button secondary"
            onClick={() => {
              const next = stage.afterIndex + 1;
              if (next >= planRef.current.length) void finish('completed', false);
              else go({ kind: 'question', index: next });
            }}
          >
            أكمل الآن
          </button>
        </div>
        </div>
      </main>
    );
  }

  if (stage.kind === 'model') {
    const m = lesson.model[stage.index];
    const last = stage.index === lesson.model.length - 1;
    const firstMain = plan.findIndex((p) => p.phase !== 'baseline');
    return (
      <main className="screen" data-stage="model" data-index={stage.index}>
        <div className="topbar">
          <div className="progress" aria-hidden="true">
            {lesson.model.map((_, i) => <span key={i} className={`progress-dot ${i < stage.index ? 'done' : i === stage.index ? 'now' : ''}`} />)}
            <span className="phase-label">الشرح</span>
          </div>
          <button type="button" className="small-link" onClick={pause}>توقف</button>
        </div>
        <div className="lesson-layout">
          <section className="panel">
            <Companion textAr={bubble.text} mood={bubble.mood} onReplay={replay} />
            <p className="sr-only" data-testid="prompt">{m.textAr}</p>
            <div className="button-row">
              <button type="button" className="big-button" autoFocus data-testid="next" onClick={() => go(last ? { kind: 'question', index: Math.max(firstMain, 0) } : { kind: 'model', index: stage.index + 1 })}>
                {last ? 'ابدأ اللعب' : 'التالي'}
              </button>
              {stage.index > 0 && <button type="button" className="big-button secondary" onClick={() => go({ kind: 'model', index: stage.index - 1 })}>السابق</button>}
            </div>
          </section>
          <HundredSquare view={{ showAll: m.showAll, reveal: m.reveal ?? [], hiddenCell: m.hiddenCell, highlight: m.highlight, clickable: false }} arrow={m.arrow} avatarAt={avatarAt} avatarLook={look} avatarState={avatarState} />
        </div>
      </main>
    );
  }

  if (stage.kind === 'end') {
    const checks = plan.filter((p) => p.phase === 'check');
    const checkResults = recentRef.current.filter((r) => r.phase === 'check');
    return (
      <main className="screen screen-center" data-stage="end">
        <div className="hero-card">
        <GhaithAvatar look={look} size={170} state="happy" />
        <h1 className="title">{stage.short ? `حسنًا يا ${name}` : `أحسنت يا ${name}!`}</h1>
        <Companion textAr={bubble.text} mood="cheer" onReplay={replay} />
        <div className="stars" data-testid="stars">{'★'.repeat(Math.min(earned, 20))}</div>
        <p className="subtitle">نجوم اليوم: {toArabicIndic(earned)}</p>
        {checkResults.length > 0 && (
          <div className="check-results" dir="rtl">
            {checks.map((c, i) => (
              <span key={c.index} className={`check-pill ${checkResults[i]?.correct ? 'ok' : 'bad'}`}>
                {checkResults[i]?.correct ? '✓' : '✗'} {c.question.explainAr}
              </span>
            ))}
          </div>
        )}
        <p className="note">{lesson.paperActivityAr}</p>
        <div className="button-row">
          <button type="button" className="big-button" onClick={() => navigate('/')} autoFocus data-testid="done">انتهيت</button>
        </div>
        </div>
      </main>
    );
  }

  const q = current!.question;
  const phaseItems = plan.filter((p) => p.phase === current!.phase);
  const posInPhase = phaseItems.findIndex((p) => p.index === current!.index);
  const mode = q.inputMode;
  return (
    <main className="screen" data-stage="question" data-index={stage.index} data-phase={current!.phase} data-variant={q.variant} data-mode={mode} data-locked={locked ? '1' : '0'} data-busy={busy ? '1' : '0'}>
      <div className="topbar">
        <div className="progress" aria-hidden="true">
          {phaseItems.map((_, i) => <span key={i} className={`progress-dot ${i < posInPhase ? 'done' : i === posInPhase ? 'now' : ''}`} />)}
          <span className="phase-label">{PHASE_LABEL[current!.phase]}{overTime ? ' · الأخيرة' : ''}</span>
        </div>
        <div className="topbar-right">
          <span className="stars-mini" aria-label={`نجومك ${toArabicIndic(earned)}`}>★ {toArabicIndic(earned)}</span>
          <button type="button" className="small-link" onClick={pause}>توقف</button>
        </div>
      </div>
      <div className="lesson-layout">
        <section className="panel">
          <Companion textAr={bubble.text} mood={bubble.mood} onReplay={replay} compact />
          <div className="prompt-row">
            {/* السؤال بالبطاقات يبقى ظاهرًا دائمًا؛ فقاعة الرفيق تحمل الجملة المنطوقة والتلميحات والتغذية الراجعة */}
            <PromptChips parts={q.promptParts} />
            {current!.hintsAllowed && (
              <button type="button" className={`icon-button ${hintPulse ? 'pulse' : ''}`} aria-label="تلميح" data-testid="hint" disabled={locked || busy || hintLevel >= q.hints.length} onClick={showHint}>
                💡
              </button>
            )}
          </div>
          <div className={`feedback ${feedback ? (feedback.ok === true ? 'ok' : feedback.ok === false ? 'bad' : '') : ''}`} aria-live="assertive" data-testid="feedback">{feedback?.text ?? ''}</div>
          {mode === 'numpad' && <NumberPad resetKey={q.id} disabled={locked || busy} onSubmit={(v) => void answer(v)} onAction={() => observerRef.current.action()} />}
          {mode === 'move' && (
            <MoveControls
              position={position}
              start={q.square?.start ?? position}
              disabled={locked || busy}
              pulse={movePulse}
              onMove={move}
              onArrive={() => void answer(position)}
              onArriveWithoutMove={() => {
                observerRef.current.action();
                void speak('move_first', 'think');
              }}
            />
          )}
          {mode === 'cell' && <p className="subtitle">انقر على الخانة في اللوحة.</p>}
          {current!.feedback !== 'immediate' && !locked && (
            <div className="button-row">
              {/* في خط الأساس والتحقق: "لا أعرف" أصدق من التخمين، ويُسجَّل بوسم خاص */}
              <button type="button" className="big-button secondary small" disabled={!skipReady} onClick={() => void skip()} data-testid="skip">لا أعرف</button>
            </div>
          )}
          {locked && (
            <div className="button-row">
              <button type="button" className="big-button" onClick={advance} autoFocus data-testid="next">التالي</button>
            </div>
          )}
        </section>
        {squareView && (
          <HundredSquare
            view={squareView}
            extraHighlight={extraHighlight}
            arrow={arrow}
            marked={marked}
            focusedCell={focusedCell}
            onFocusMove={(n) => {
              observerRef.current.action();
              setFocusedCell(n);
            }}
            onCellClick={mode === 'cell' && !locked && !busy ? (n) => void answer(n) : undefined}
            avatarAt={avatarAt}
            avatarLook={look}
            avatarState={avatarState}
            treasureAt={treasureAt}
            path={path}
          />
        )}
      </div>
    </main>
  );
}
