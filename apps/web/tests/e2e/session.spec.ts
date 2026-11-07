// اختبار الجلسة الكاملة في متصفح حقيقي: خط الأساس ← الشرح ← موجّه ← وحدك ← تحقق ← نهاية،
// ثم لوحة الأب، والاستئناف بعد إعادة التحميل، ومنع التقدم المزدوج بضغطتي Enter
// الإجابات الصحيحة تُحسب من المخطط نفسه (حتمي من معرّف الجلسة) لا من الواجهة
import { expect, test, type Page } from '@playwright/test';
import { planSession, replayAdaptations, type AppliedAdaptation, type PlannedQuestion } from '../../src/session/planner';
import { LESSON_L1A_01 } from '../../src/content/lessons/L1A-01';

interface ResumeRow {
  sessionId: string;
  includeBaseline: boolean;
  adaptations: AppliedAdaptation[];
  stage: { kind: string; index: number };
}

/** يقرأ حالة الاستئناف من IndexedDB داخل الصفحة */
async function readResume(page: Page): Promise<ResumeRow | undefined> {
  return page.evaluate(
    () =>
      new Promise<ResumeRow | undefined>((resolve, reject) => {
        const req = indexedDB.open('ghaith-learning');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('resume');
          const g = tx.objectStore('resume').get('current');
          g.onsuccess = () => {
            db.close();
            resolve(g.result as ResumeRow | undefined);
          };
          g.onerror = () => reject(g.error);
        };
      }),
  );
}

async function countStore(page: Page, store: string, filter?: (row: Record<string, unknown>) => boolean): Promise<number> {
  const rows = await page.evaluate(
    (s) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open('ghaith-learning');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const g = db.transaction(s).objectStore(s).getAll();
          g.onsuccess = () => {
            db.close();
            resolve(g.result as Record<string, unknown>[]);
          };
          g.onerror = () => reject(g.error);
        };
      }),
    store,
  );
  return filter ? rows.filter(filter).length : rows.length;
}

function expectedOf(p: PlannedQuestion): number {
  const m = p.question.matcher;
  return m.kind === 'exact' ? m.value : m.kind === 'set' ? m.values[0] : m.min;
}

/** يجيب عن السؤال الحالي إجابة صحيحة بطريقة الإدخال المناسبة */
async function answerCurrent(page: Page, p: PlannedQuestion): Promise<void> {
  const main = page.locator('main[data-stage="question"]');
  await expect(main).toHaveAttribute('data-busy', '0');
  await expect(main).toHaveAttribute('data-locked', '0');
  const expected = expectedOf(p);
  const mode = await main.getAttribute('data-mode');
  if (mode === 'numpad') {
    await page.keyboard.type(String(expected));
    await page.keyboard.press('Enter');
  } else if (mode === 'cell') {
    await page.locator(`button[data-cell="${expected}"]`).click();
  } else {
    const start = p.question.square!.start!;
    let delta = expected - start;
    while (delta >= 10) {
      await page.locator('button[data-move="10"]').click();
      delta -= 10;
    }
    while (delta <= -10) {
      await page.locator('button[data-move="-10"]').click();
      delta += 10;
    }
    while (delta > 0) {
      await page.locator('button[data-move="1"]').click();
      delta -= 1;
    }
    while (delta < 0) {
      await page.locator('button[data-move="-1"]').click();
      delta += 1;
    }
    await page.getByTestId('move-arrive').click();
  }
}

async function currentPlan(page: Page): Promise<{ plan: PlannedQuestion[]; resume: ResumeRow }> {
  const resume = (await readResume(page))!;
  expect(resume).toBeTruthy();
  const base = planSession(LESSON_L1A_01, resume.sessionId, { includeBaseline: resume.includeBaseline });
  return { plan: replayAdaptations(LESSON_L1A_01, resume.sessionId, base, resume.adaptations), resume };
}

async function startFresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('start').click();
  await page.locator('button[data-look="explorer"]').click();
  await page.getByTestId('start-session').click();
}

test('جلسة كاملة بإجابات صحيحة: 19 محاولة ونهاية واحدة، ثم لوحة الأب تعرض الملاحظات', async ({ page }) => {
  await startFresh(page);
  const stages: string[] = [];
  for (let guard = 0; guard < 80; guard++) {
    const main = page.locator('main[data-stage]');
    await expect(main).toBeVisible();
    const stage = (await main.getAttribute('data-stage'))!;
    stages.push(stage);
    if (stage === 'end') break;
    if (stage === 'model') {
      await page.getByTestId('next').click();
      continue;
    }
    if (stage === 'question') {
      const index = Number(await main.getAttribute('data-index'));
      const { plan } = await currentPlan(page);
      await answerCurrent(page, plan[index]);
      // ننتظر الانتقال إلى سؤال آخر أو مرحلة أخرى (الانتقال التلقائي أو زر التالي)
      await expect.poll(async () => `${await main.getAttribute('data-stage')}:${await main.getAttribute('data-index')}`, { timeout: 15_000 }).not.toBe(`question:${index}`);
      continue;
    }
    throw new Error(`مرحلة غير متوقعة: ${stage}`);
  }
  expect(stages.at(-1)).toBe('end');
  expect(stages.filter((s) => s === 'question')).toHaveLength(19);
  expect(stages.filter((s) => s === 'model')).toHaveLength(5);
  // 11 نجمة للأسئلة (عدا خط الأساس) + 3 لإكمال الجلسة
  await expect(page.getByTestId('stars')).toHaveText('★'.repeat(14));
  await page.screenshot({ path: 'test-results/end.png' });

  expect(await countStore(page, 'attempts')).toBe(19);
  expect(await countStore(page, 'attempts', (a) => a.phase === 'baseline')).toBe(8);
  expect(await countStore(page, 'attempts', (a) => a.correct === true)).toBe(19);
  expect(await countStore(page, 'sessions', (s) => s.endReason === 'completed')).toBe(1);
  expect(await countStore(page, 'observations')).toBe(1);
  expect(await readResume(page)).toBeUndefined();

  // لوحة الأب
  await page.getByTestId('done').click();
  await page.goto('/#/parent');
  await page.getByTestId('pin').fill('1234');
  await page.getByTestId('unlock').click();
  await expect(page.getByTestId('assessment')).toContainText('يتعلم بمساعدة');
  await expect(page.locator('.observation').first()).toContainText('قبل الدرس أصاب');
  await page.screenshot({ path: 'test-results/parent.png', fullPage: true });
});

test('الاستئناف بعد إعادة التحميل يعود إلى السؤال نفسه', async ({ page }) => {
  await startFresh(page);
  const main = page.locator('main[data-stage="question"]');
  await expect(main).toHaveAttribute('data-index', '0');
  const { plan } = await currentPlan(page);
  await answerCurrent(page, plan[0]);
  await expect(main).toHaveAttribute('data-index', '1');
  await answerCurrent(page, plan[1]);
  await expect(main).toHaveAttribute('data-index', '2');
  // إعادة التحميل تبقي العنوان نفسه فتُستأنف الجلسة مباشرة من السؤال الثالث بلا جلسة جديدة
  await page.reload();
  await expect(page.locator('main[data-stage="question"]')).toHaveAttribute('data-index', '2');
  expect(await countStore(page, 'attempts')).toBe(2);
  expect(await countStore(page, 'sessions')).toBe(1);
  // ومن شاشة البداية يظهر زر "نكمل" ويعود إلى الموضع نفسه
  await page.goto('/');
  await expect(page.getByTestId('start')).toContainText('نكمل');
  await page.getByTestId('start').click();
  await expect(page.locator('main[data-stage="question"]')).toHaveAttribute('data-index', '2');
  expect(await countStore(page, 'sessions')).toBe(1);
  await page.screenshot({ path: 'test-results/resumed.png' });
});

test('ضغطتا Enter متتاليتان لا تتخطيان سؤالًا', async ({ page }) => {
  await startFresh(page);
  const main = page.locator('main[data-stage="question"]');
  const { plan } = await currentPlan(page);
  // نبحث عن أول سؤال كتابي ونجيب عنه ثم نضغط Enter مرتين بسرعة
  let index = 0;
  while ((await main.getAttribute('data-mode')) !== 'numpad') {
    await answerCurrent(page, plan[index]);
    index++;
    await expect(main).toHaveAttribute('data-index', String(index));
  }
  await page.keyboard.type(String(expectedOf(plan[index])));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(main).toHaveAttribute('data-index', String(index + 1));
  await page.waitForTimeout(1500);
  await expect(main).toHaveAttribute('data-index', String(index + 1));
  expect(await countStore(page, 'attempts')).toBe(index + 1);
});

test('خريطة الكنز: سؤال الحركة يظهر الأفاتار والأزرار، وصورة للمراجعة البصرية', async ({ page }) => {
  await startFresh(page);
  const main = page.locator('main[data-stage]');
  for (let guard = 0; guard < 40; guard++) {
    const stage = await main.getAttribute('data-stage');
    if (stage === 'model') {
      await page.getByTestId('next').click();
      continue;
    }
    const mode = await main.getAttribute('data-mode');
    if (stage === 'question' && mode === 'move') break;
    const index = Number(await main.getAttribute('data-index'));
    const { plan } = await currentPlan(page);
    await answerCurrent(page, plan[index]);
    await expect.poll(async () => `${await main.getAttribute('data-stage')}:${await main.getAttribute('data-index')}`).not.toBe(`question:${index}`);
  }
  await expect(main).toHaveAttribute('data-mode', 'move');
  await expect(main).toHaveAttribute('data-busy', '0', { timeout: 20_000 });
  await expect(page.locator('.hs-avatar')).toHaveCount(1);
  await expect(page.locator('button[data-move="10"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/move-question.png' });
});
