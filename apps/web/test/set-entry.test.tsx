import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { SetEntry } from '@/features/workout/set-entry';

describe('SetEntry', () => {
  it('records nothing until the user confirms, then submits typed values', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Weight, kg' }), '22,5');
    await userEvent.type(screen.getByRole('textbox', { name: 'Reps' }), '8');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      weightKg: 22.5,
      reps: 8,
      status: 'completed',
      setType: 'working',
      note: null,
    });
  });

  it('blocks a completed set without repetitions', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Weight, kg' }), '40');
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Reps/);
  });

  it('allows marking a set as skipped', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip set' }));
    expect(onSubmit).toHaveBeenCalledWith({
      weightKg: 0,
      reps: 0,
      status: 'skipped',
      setType: 'working',
      note: null,
    });
  });

  it('pre-fills a suggestion that steppers can adjust', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry suggestion={{ weightKg: 40, reps: 10 }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Weight, kg: increase by 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reps: decrease by 1' }));
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      weightKg: 41,
      reps: 9,
      status: 'completed',
      setType: 'working',
      note: null,
    });
  });

  it('marks a set as warm-up and attaches a comment (quick option or typed)', async () => {
    const onSubmit = vi.fn();
    render(
      <SetEntry
        counts={{ working: 0, warmup: 0 }}
        suggestion={{ weightKg: 20, reps: 15 }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('Set 1')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Warm-up' }));
    expect(screen.getByText('Warm-up 1')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '+ Comment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      weightKg: 20,
      reps: 15,
      status: 'completed',
      setType: 'warmup',
      note: 'Easy',
    });
    // the comment belongs to one set only; weight, reps and type stay for the next set
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      weightKg: 20,
      reps: 15,
      status: 'completed',
      setType: 'warmup',
      note: null,
    });
  });

  it('shows what was done in the matching set last time, per set type', async () => {
    const lastTime = (type: string) =>
      type === 'warmup'
        ? { weightKg: 20, reps: 15, status: 'completed' }
        : { weightKg: 60, reps: 8, status: 'completed', note: 'тяжело' };
    render(<SetEntry counts={{ working: 0, warmup: 0 }} lastTime={lastTime} onSubmit={vi.fn()} />);
    expect(screen.getByText('60 kg × 8')).toBeTruthy();
    expect(screen.getByText(/«тяжело»/)).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Warm-up' }));
    expect(screen.getByText('20 kg × 15')).toBeTruthy();
  });

  it('says so when there was no such set last time', () => {
    render(
      <SetEntry counts={{ working: 3, warmup: 0 }} lastTime={() => null} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('No such set last time')).toBeTruthy();
    expect(screen.getByText('Set 4')).toBeTruthy();
  });
});
