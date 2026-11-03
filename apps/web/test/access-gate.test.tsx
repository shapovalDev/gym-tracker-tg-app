import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

const get = vi.fn();
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<object>()),
  http: { get: (...a: unknown[]) => get(...a) },
}));

import { AccessGate } from '@/components/access-gate';

afterEach(() => {
  cleanup();
  get.mockReset();
});

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccessGate>
        <nav>
          <button>Programs</button>
        </nav>
      </AccessGate>
    </QueryClientProvider>,
  );
}

describe('AccessGate', () => {
  it('renders the app for an allowed user', async () => {
    get.mockResolvedValue({ id: 'u1', telegramId: '1', locale: 'en' });
    renderGate();
    expect(await screen.findByRole('button', { name: 'Programs' })).toBeTruthy();
  });

  it('shows a dead-end screen with nothing to tap for a user outside the allowlist', async () => {
    get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'This app is private'));
    const { container } = renderGate();
    expect((await screen.findByRole('alert')).textContent).toBe('This app is private');
    expect(container.querySelectorAll('button, a, input, nav')).toHaveLength(0);
  });

  it('does not block the app on other errors', async () => {
    get.mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'));
    renderGate();
    expect(await screen.findByRole('button', { name: 'Programs' })).toBeTruthy();
  });
});
