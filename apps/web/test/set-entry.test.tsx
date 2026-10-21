import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { SetEntry } from '@/features/workout/set-entry';

describe('SetEntry', () => {
  it('records nothing until the user confirms, then submits typed values', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry setNumber={1} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Вес, кг' }), '22,5');
    await userEvent.type(screen.getByRole('textbox', { name: 'Повторы' }), '8');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Записать подход/ }));
    expect(onSubmit).toHaveBeenCalledWith({ weightKg: 22.5, reps: 8, status: 'completed' });
  });

  it('blocks a completed set without repetitions', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry setNumber={1} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Вес, кг' }), '40');
    await userEvent.click(screen.getByRole('button', { name: /Записать подход/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Повторы/);
  });

  it('allows marking a set as skipped', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry setNumber={2} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить подход' }));
    expect(onSubmit).toHaveBeenCalledWith({ weightKg: 0, reps: 0, status: 'skipped' });
  });

  it('pre-fills a suggestion that steppers can adjust', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry setNumber={2} suggestion={{ weightKg: 40, reps: 10 }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Вес, кг: увеличить на 2.5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Повторы: уменьшить на 1' }));
    await userEvent.click(screen.getByRole('button', { name: /Записать подход/ }));
    expect(onSubmit).toHaveBeenCalledWith({ weightKg: 42.5, reps: 9, status: 'completed' });
  });
});
