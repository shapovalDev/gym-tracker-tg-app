import { expect, test, type Page } from '@playwright/test';

/**
 * The critical user journey from the product spec, end to end, against the
 * real API and database.
 */
test.describe.configure({ mode: 'serial' });

const WORKOUTS = ['A — грудь', 'B — спина', 'C — ноги', 'D — плечи'];

async function addExerciseToWorkout(page: Page, workout: string, exercise: string) {
  await page.getByRole('link', { name: new RegExp(workout) }).click();
  await page.getByRole('button', { name: 'Добавить упражнения' }).click();
  await page.getByRole('searchbox', { name: 'Поиск' }).fill(exercise);
  await page.getByRole('button', { name: new RegExp(`Новое упражнение «${exercise}»`) }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
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
  const w = page.getByRole('textbox', { name: 'Вес, кг' });
  const r = page.getByRole('textbox', { name: 'Повторы' });
  await w.fill(weight);
  await r.fill(reps);
  await page.getByRole('button', { name: /Записать подход/ }).click();
}

async function finishWorkout(page: Page) {
  await page.getByRole('button', { name: 'Действия с тренировкой' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить тренировку' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /завершить/i })
    .click();
  await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible();
}

test('full journey: program → workout → history → progress → cycle', async ({ page }) => {
  // 1. open app: empty state
  await page.goto('/');
  // generous timeout: the dev server compiles pages on first request
  await expect(page.getByText('Начните с программы')).toBeVisible({ timeout: 60_000 });

  // 2. program with four workouts
  await page.getByRole('link', { name: 'Создать программу' }).click();
  await page.getByRole('textbox', { name: 'Название' }).fill('Сплит ABCD');
  await page.getByRole('textbox', { name: 'Тренировка 1' }).fill(WORKOUTS[0]!);
  await page.getByRole('textbox', { name: 'Тренировка 2' }).fill(WORKOUTS[1]!);
  await page.getByRole('button', { name: 'Добавить тренировку' }).click();
  await page.getByRole('textbox', { name: 'Тренировка 3' }).fill(WORKOUTS[2]!);
  await page.getByRole('button', { name: 'Добавить тренировку' }).click();
  await page.getByRole('textbox', { name: 'Тренировка 4' }).fill(WORKOUTS[3]!);
  await page.getByRole('button', { name: 'Создать программу' }).click();
  await expect(page.getByRole('heading', { name: 'Сплит ABCD' })).toBeVisible();
  await expect(page.getByText(/4 тренировки в цикле/)).toBeVisible();

  // 3. exercises
  await addExerciseToWorkout(page, WORKOUTS[0]!, 'Жим лёжа');
  await addExerciseToWorkout(page, WORKOUTS[1]!, 'Тяга');
  await addExerciseToWorkout(page, WORKOUTS[2]!, 'Присед');
  await addExerciseToWorkout(page, WORKOUTS[3]!, 'Жим стоя');

  // 4. start the first workout from home
  await page.goto('/');
  await expect(page.getByText(WORKOUTS[0]!)).toBeVisible();
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await expect(page).toHaveURL(/\/workout$/);

  // 5. several sets with different weights and reps
  await openExercise(page, 'Жим лёжа');
  await expect(page.getByText('Первый раз: прошлых результатов нет')).toBeVisible();
  await recordSet(page, '40', '12');
  await recordSet(page, '45', '10');
  await recordSet(page, '47,5', '8');
  await expect(page.getByLabel('Подход 3 выполнен')).toBeVisible();

  // reload mid-workout: session and sets are restored from the server
  await page.reload();
  await openExercise(page, 'Жим лёжа');
  await expect(page.getByLabel(/Подход \d выполнен/)).toHaveCount(3);

  // 6. finish
  await finishWorkout(page);
  await expect(page.getByText(/1\s310\sкг/)).toBeVisible(); // 40×12 + 45×10 + 47.5×8
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
  await expect(page.getByRole('combobox', { name: 'Выберите упражнение' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Выберите упражнение' })
    .selectOption({ label: 'Жим лёжа' });
  await page.getByRole('button', { name: 'Вес' }).click();
  await expect(page.getByText('47.5 кг').first()).toBeVisible();
});

test('cycle advances B → C → D → A and the chart is drawn from two sessions', async ({ page }) => {
  for (const [i, name] of WORKOUTS.slice(1).entries()) {
    await page.goto('/');
    await expect(page.getByText(name)).toBeVisible();
    await page.getByRole('button', { name: 'Начать тренировку' }).click();
    await openExercise(page, ['Тяга', 'Присед', 'Жим стоя'][i]!);
    await recordSet(page, '50', '5');
    await finishWorkout(page);
  }
  // after D comes A again
  await page.goto('/');
  await expect(page.getByText(WORKOUTS[0]!)).toBeVisible();
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await openExercise(page, 'Жим лёжа');
  await expect(page.getByText('В прошлый раз', { exact: false })).toBeVisible();
  await recordSet(page, '50', '8');
  await finishWorkout(page);

  await page.goto('/progress');
  await page
    .getByRole('combobox', { name: 'Выберите упражнение' })
    .selectOption({ label: 'Жим лёжа' });
  await expect(page.getByRole('figure', { name: /График/ })).toBeVisible();
  await expect(page.locator('.recharts-line-dot')).toHaveCount(2);
});

test('sets entered offline are kept and synced without duplicates', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await openExercise(page, 'Тяга');
  await context.setOffline(true);
  await recordSet(page, '60', '10');
  await expect(page.getByText(/не отправлено/)).toBeVisible();
  await expect(page.getByText('сохраняется…')).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/не отправлено/)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  await openExercise(page, 'Тяга');
  await expect(page.getByLabel(/Подход \d выполнен/)).toHaveCount(1);

  // cancel: not counted, cycle stays
  await page.getByRole('button', { name: 'Все упражнения' }).click();
  await page.getByRole('button', { name: 'Действия с тренировкой' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Отменить тренировку/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отменить тренировку' }).click();
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
  await page.getByRole('button', { name: 'Упражнения', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить Тяга' }).click();
  await page.getByRole('button', { name: 'Добавить Присед' }).click();
  await expect(page.getByRole('button', { name: 'Тяга, уже добавлено' })).toBeDisabled();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(3);

  // remove immediately, then undo — order is restored
  await page.getByRole('button', { name: 'Убрать «Жим лёжа» из тренировки' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Вернуть' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('main').getByRole('listitem').first()).toContainText('Жим лёжа');

  // plan note is shown in the list
  await page.getByRole('main').getByRole('listitem').first().getByRole('button').first().click();
  await page
    .getByRole('textbox', { name: 'Заметка к упражнению в этой тренировке' })
    .fill('Пауза внизу');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Пауза внизу')).toBeVisible();
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
