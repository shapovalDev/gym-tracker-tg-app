'use client';

import { t } from '@/i18n';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- buttons */

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'success';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-[0_1px_0_rgba(0,0,0,0.08)]',
  secondary: 'bg-card text-ink border border-line',
  soft: 'bg-primary-soft text-primary',
  ghost: 'bg-transparent text-primary',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-done text-white',
};
const sizes = {
  sm: 'h-10 px-3.5 text-[15px] rounded-xl',
  md: 'h-12 px-4 text-[16px] rounded-2xl',
  lg: 'h-14 px-5 text-[17px] rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  block?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'press inline-flex items-center justify-center gap-2 font-semibold select-none disabled:opacity-45',
        sizes[size],
        block && 'w-full',
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner small /> : children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'press inline-flex items-center justify-center gap-2 font-semibold',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  tone = 'muted',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: 'muted' | 'danger' | 'primary';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'press grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-30',
        tone === 'danger' ? 'text-danger' : tone === 'primary' ? 'text-primary' : 'text-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- surfaces */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-[22px] border border-line bg-card', className)}>{children}</div>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
            {hint && <p className="text-[13px] text-muted">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-2 px-1 pt-3">
      <div className="min-w-0">
        {subtitle && <div className="mb-1 truncate text-[14px] text-muted">{subtitle}</div>}
        <h1 className="font-display text-[26px] leading-[1.1] font-semibold tracking-tight break-words">
          {title}
        </h1>
      </div>
      {right && <div className="-mr-2 shrink-0">{right}</div>}
    </header>
  );
}

/**
 * Workout identity: a coloured disc in competition-plate colours
 * (A red, B blue, C yellow, D green, E white, then repeats).
 */
export function PlateBadge({ index, size = 'md' }: { index: number; size?: 'sm' | 'md' | 'lg' }) {
  const letter = String.fromCharCode(65 + (index % 26));
  const color = `var(--plate-${(index % 5) + 1})`;
  const px = size === 'lg' ? 52 : size === 'md' ? 40 : 30;
  return (
    <span
      aria-hidden
      className="font-display grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: px,
        height: px,
        fontSize: px * 0.42,
        background: `color-mix(in srgb, ${color} 16%, var(--card))`,
        color,
        boxShadow: `inset 0 0 0 ${Math.round(px / 11)}px ${color}`,
      }}
    >
      {letter}
    </span>
  );
}

/** Primary action pinned to the thumb zone (above the tab bar unless `flush`). */
export function BottomBar({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-line bg-bg/92 backdrop-blur"
      style={{
        bottom: flush ? 0 : 'calc(var(--nav-h, 60px) + var(--safe-bottom))',
        paddingBottom: flush ? 'var(--safe-bottom)' : 0,
      }}
    >
      <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block px-1 text-[14px] font-medium">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        className="h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-primary"
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={cx('px-1 text-[13px]', error ? 'text-danger' : 'text-muted')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block px-1 text-[14px] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-primary"
      />
      {hint && <p className="px-1 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block px-1 text-[14px] font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-ink"
      >
        {children}
      </select>
    </div>
  );
}

/* ---------------------------------------------------------------- states */

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label={t('Loading')}
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-r-transparent',
        small ? 'size-4' : 'size-6',
      )}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16 text-muted">
      <Spinner />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="space-y-3 p-6 text-center">
      <p role="alert" className="text-[16px]">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('Retry')}
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-line px-6 py-9 text-center">
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {text && <p className="mx-auto mt-1.5 max-w-xs text-[15px] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- overlays */

/** Bottom sheet — reachable with the thumb, closes on backdrop/Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers that change on every render; keep the latest
  // one in a ref so the effect below runs only when the sheet opens. Re-running
  // it on each render used to steal focus from inputs inside the sheet (and
  // close the keyboard on phones) whenever the parent re-rendered.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    // move focus into the sheet only if nothing inside it is focused yet (autoFocus wins)
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={t('Close')}
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="anim-sheet relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg px-4 pt-2.5 outline-none"
        style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="mb-4 text-center text-[17px] font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({
  open,
  title,
  text,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="mb-5 text-center text-[15px] text-muted">{text}</p>}
      <div className="space-y-2">
        <Button
          block
          size="lg"
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button block size="lg" variant="secondary" onClick={onClose}>
          {t('Not now')}
        </Button>
      </div>
    </Sheet>
  );
}

export interface SheetAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
}

/** A list of secondary actions behind a "⋯" button. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: (SheetAction | false | null | undefined)[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Card className="divide-y divide-line overflow-hidden">
        {actions.filter(Boolean).map((a) => {
          const action = a as SheetAction;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                onClose();
                action.onClick();
              }}
              className={cx(
                'block min-h-14 w-full px-4 py-3 text-left text-[16px] font-medium',
                action.danger && 'text-danger',
              )}
            >
              {action.label}
              {action.hint && (
                <span className="block text-[13px] font-normal text-muted">{action.hint}</span>
              )}
            </button>
          );
        })}
      </Card>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- controls */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-2xl border border-line bg-inset p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-10 flex-1 rounded-xl text-[15px] font-semibold transition-colors',
            value === o.value
              ? 'bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'press h-10 shrink-0 rounded-full border px-4 text-[15px] font-medium whitespace-nowrap',
        active ? 'border-primary bg-primary text-on-primary' : 'border-line bg-card text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="num mt-1 text-[24px] leading-tight font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
    </Card>
  );
}

export function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted">{t('no data to compare')}</span>;
  const up = pct > 0;
  return (
    <span
      className={cx('font-semibold', pct === 0 ? 'text-muted' : up ? 'text-done' : 'text-danger')}
    >
      {up ? '+' : pct < 0 ? '−' : ''}
      {t('{pct}% vs previous period', { pct: Math.abs(pct) })}
    </span>
  );
}
