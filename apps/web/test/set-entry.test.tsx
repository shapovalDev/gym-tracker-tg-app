import { act, cleanup, render, screen } from '@testing-library/react';
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
      durationSec: null,
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
      durationSec: null,
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
      durationSec: null,
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
      durationSec: null,
      status: 'completed',
      setType: 'warmup',
      note: 'Easy',
    });
    // the comment belongs to one set only; weight, reps and type stay for the next set
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      weightKg: 20,
      reps: 15,
      durationSec: null,
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

  it('records a timed set from typed time; "1.30" means 1 min 30 s', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry trackingType="duration" onSubmit={onSubmit} />);
    expect(screen.queryByRole('textbox', { name: 'Reps' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Time/);
    await userEvent.type(screen.getByRole('textbox', { name: 'Time' }), '1.30');
    await userEvent.click(screen.getByRole('button', { name: 'Time: increase by 5' }));
    expect((screen.getByRole('textbox', { name: 'Time' }) as HTMLInputElement).value).toBe('1:35');
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      weightKg: 0,
      reps: 0,
      durationSec: 95,
      status: 'completed',
      setType: 'working',
      note: null,
    });
  });

  it('measures a timed set with the stopwatch; recording stops it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onSubmit = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SetEntry trackingType="duration" onSubmit={onSubmit} />);
      await user.click(screen.getByRole('button', { name: 'Start stopwatch' }));
      await act(() => vi.advanceTimersByTimeAsync(42_000));
      expect((screen.getByRole('textbox', { name: 'Time' }) as HTMLInputElement).value).toBe(
        '0:42',
      );
      await user.click(screen.getByRole('button', { name: /Record set/ }));
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ durationSec: 42, reps: 0 });
      expect(screen.getByRole('button', { name: 'Start stopwatch' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('records body-weight reps with optional extra weight', async () => {
    const onSubmit = vi.fn();
    render(<SetEntry trackingType="bodyweight" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Reps' }), '12');
    await userEvent.click(screen.getByRole('button', { name: /Record set/ }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ weightKg: 0, reps: 12, durationSec: null });
    expect(screen.getByRole('textbox', { name: 'Extra weight, kg' })).toBeTruthy();
  });

  it('labels the weight as a counterweight and shows last time with a minus', () => {
    render(
      <SetEntry
        trackingType="assisted"
        lastTime={() => ({ weightKg: 30, reps: 8, status: 'completed' })}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Counterweight, kg' })).toBeTruthy();
    expect(screen.getByText('−30 kg × 8')).toBeTruthy();
  });
});
