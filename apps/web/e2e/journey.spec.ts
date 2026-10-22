import { expect, test, type Page } from '@playwright/test';

/**
 * The critical user journey from the product spec, end to end, against the
 * real API and database.
 */
test.describe.configure({ mode: 'serial' });

const WORKOUTS = ['A — грудь', 'B — спина', 'C — ноги', 'D — плечи'];

async function addExerciseToWorkout(page: Page, workout: string, exercise: string) {
  await page.getByRole('link', { name: new RegExp(workout) }).click();
  await page.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill(exercise);
  await page.getByRole('button', { name: new RegExp(`New exercise “${exercise}”`) }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('listitem').getByText(exercise, { exact: true })).toBeVisible();
  await page.goBack();
}

/** Opens an exercise card on the active workout screen. */
async function openExercise(page: Page, name: string) {
  await page
    .getByRole('listitem')
    .getByRole('button', { name: new RegExp(name) })
    .first()
    .click();
}

async function recordSet(page: Page, weight: string, reps: string) {
  const w = page.getByRole('textbox', { name: 'Weight, kg' });
  const r = page.getByRole('textbox', { name: 'Reps' });
  await w.fill(weight);
  await r.fill(reps);
  await page.getByRole('button', { name: /Record set/ }).click();
}

async function finishWorkout(page: Page) {
  await page.getByRole('button', { name: 'Workout actions' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finish workout' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /finish/i })
    .click();
  await expect(page.getByRole('heading', { name: 'Workout finished' })).toBeVisible();
}

test('full journey: program → workout → history → progress → cycle', async ({ page }) => {
  // 1. open app: empty state
  await page.goto('/');
  // generous timeout: the dev server compiles pages on first request
  await expect(page.getByText('Start with a program')).toBeVisible({ timeout: 60_000 });

  // 2. program with four workouts
  await page.getByRole('link', { name: 'Create program' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Сплит ABCD');
  await page.getByRole('textbox', { name: 'Workout 1' }).fill(WORKOUTS[0]!);
  await page.getByRole('textbox', { name: 'Workout 2' }).fill(WORKOUTS[1]!);
  await page.getByRole('button', { name: 'Add workout' }).click();
  await page.getByRole('textbox', { name: 'Workout 3' }).fill(WORKOUTS[2]!);
  await page.getByRole('button', { name: 'Add workout' }).click();
  await page.getByRole('textbox', { name: 'Workout 4' }).fill(WORKOUTS[3]!);
  await page.getByRole('button', { name: 'Create program' }).click();
  await expect(page.getByRole('heading', { name: 'Сплит ABCD' })).toBeVisible();
  await expect(page.getByText(/4 workouts in the cycle/)).toBeVisible();

  // 3. exercises
  await addExerciseToWorkout(page, WORKOUTS[0]!, 'Жим лёжа');
  await addExerciseToWorkout(page, WORKOUTS[1]!, 'Тяга');
  await addExerciseToWorkout(page, WORKOUTS[2]!, 'Присед');
  await addExerciseToWorkout(page, WORKOUTS[3]!, 'Жим стоя');

  // 4. start the first workout from home
  await page.goto('/');
  await expect(page.getByText(WORKOUTS[0]!)).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/workout$/);

  // 5. several sets with different weights and reps
  await openExercise(page, 'Жим лёжа');
  await expect(page.getByText('First time: no previous results')).toBeVisible();
  await recordSet(page, '40', '12');
  await recordSet(page, '45', '10');
  await recordSet(page, '47,5', '8');
  await expect(page.getByLabel('Set 3 done')).toBeVisible();

  // reload mid-workout: session and sets are restored from the server
  await page.reload();
  await openExercise(page, 'Жим лёжа');
  await expect(page.getByLabel(/Set \d done/)).toHaveCount(3);

  // 6. finish
  await finishWorkout(page);
  await expect(page.getByText(/1,310\skg/)).toBeVisible(); // 40×12 + 45×10 + 47.5×8
});

test('history and progress survive a reload', async ({ page }) => {
  // 7–8. reload → history
  await page.goto('/history');
  await page.reload();
  await expect(page.getByRole('link', { name: new RegExp(WORKOUTS[0]!) })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(WORKOUTS[0]!) }).click();
  await expect(page.getByText('47.5', { exact: false })).toBeVisible();

  // 9–10. progress from saved data (single session → value card)
  await page.goto('/progress');
  await expect(page.getByRole('combobox', { name: 'Choose an exercise' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Choose an exercise' })
    .selectOption({ label: 'Жим лёжа' });
  await page.getByRole('button', { name: 'Weight' }).click();
  await expect(page.getByText('47.5 kg').first()).toBeVisible();
});

test('cycle advances B → C → D → A and the chart is drawn from two sessions', async ({ page }) => {
  for (const [i, name] of WORKOUTS.slice(1).entries()) {
    await page.goto('/');
    await expect(page.getByText(name)).toBeVisible();
    await page.getByRole('button', { name: 'Start workout' }).click();
    await openExercise(page, ['Тяга', 'Присед', 'Жим стоя'][i]!);
    await recordSet(page, '50', '5');
    await finishWorkout(page);
  }
  // after D comes A again
  await page.goto('/');
  await expect(page.getByText(WORKOUTS[0]!)).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await openExercise(page, 'Жим лёжа');
  // the matching set from last time is shown right in the entry form
  await expect(page.getByText('40 kg × 12')).toBeVisible();

  // a warm-up with a comment: shown, but not counted
  await page.getByRole('radio', { name: 'Warm-up' }).click();
  await expect(page.getByText('No such set last time')).toBeVisible();
  await page.getByRole('button', { name: '+ Comment' }).click();
  await page.getByRole('textbox', { name: 'Set comment' }).fill('лёгкий разогрев');
  await recordSet(page, '20', '15');
  await expect(page.getByText('лёгкий разогрев')).toBeVisible();
  await expect(page.getByLabel('Warm-up 1 done')).toBeVisible();

  await page.getByRole('radio', { name: 'Working' }).click();
  await expect(page.getByText('Set 1', { exact: true })).toBeVisible();
  await recordSet(page, '50', '8');
  await expect(page.getByLabel('Set 1 done')).toBeVisible();

  // full history of the exercise in a sheet
  await page.getByRole('button', { name: /Last time/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('47.5 kg × 8')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).first().click();

  await finishWorkout(page);
  // warm-up excluded from the summary: one working set of 50 × 8
  await expect(page.getByText(/^400\skg$/)).toBeVisible();

  await page.goto('/progress');
  await page
    .getByRole('combobox', { name: 'Choose an exercise' })
    .selectOption({ label: 'Жим лёжа' });
  await expect(page.getByRole('figure', { name: /Chart/ })).toBeVisible();
  await expect(page.locator('.recharts-line-dot')).toHaveCount(2);
});

test('sets entered offline are kept and synced without duplicates', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await openExercise(page, 'Тяга');
  await context.setOffline(true);
  await recordSet(page, '60', '10');
  await expect(page.getByText(/not sent/)).toBeVisible();
  await expect(page.getByText('saving…', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/not sent/)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  await openExercise(page, 'Тяга');
  await expect(page.getByLabel(/Set \d done/)).toHaveCount(1);

  // cancel: not counted, cycle stays
  await page.getByRole('button', { name: 'All exercises' }).click();
  await page.getByRole('button', { name: 'Workout actions' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Cancel workout/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel workout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(WORKOUTS[1]!)).toBeVisible();
});

test('workout editor: one-tap remove with undo, several exercises at once, notes visible', async ({
  page,
}) => {
  await page.goto('/programs');
  await page.getByRole('link', { name: /Сплит ABCD/ }).click();
  await page.getByRole('link', { name: new RegExp(WORKOUTS[0]!) }).click();
  // add two more exercises in one go from the library
  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByRole('button', { name: 'Add Тяга' }).click();
  await page.getByRole('button', { name: 'Add Присед' }).click();
  await expect(page.getByRole('button', { name: 'Тяга, already added' })).toBeDisabled();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(3);

  // remove immediately, then undo — order is restored
  await page.getByRole('button', { name: 'Remove “Жим лёжа” from the workout' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('main').getByRole('listitem').first()).toContainText('Жим лёжа');

  // plan note is shown in the list
  await page.getByRole('main').getByRole('listitem').first().getByRole('button').first().click();
  await page
    .getByRole('textbox', { name: 'Note for this exercise in this workout' })
    .fill('Пауза внизу');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Пауза внизу')).toBeVisible();
});

test('the workout can be left at any time; a banner leads back to it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await page.getByRole('navigation').getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/\/history$/);
  const banner = page.getByRole('link', { name: /Workout in progress/ });
  await expect(banner).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Programs' }).click();
  await expect(banner).toBeVisible();
  await banner.click();
  await expect(page).toHaveURL(/\/workout$/);
  // tidy up for the next tests
  await page.getByRole('button', { name: 'Workout actions' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Cancel workout/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel workout' }).click();
  await expect(banner).toBeHidden();
});

test('the interface language can be switched to Ukrainian and back, and is remembered', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Українська' }).click();
  await expect(page.getByRole('heading', { name: 'Ще' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Головна' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ще' })).toBeVisible();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
});

test('layout fits a small phone without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const url of ['/', '/programs', '/history', '/progress', '/settings']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
