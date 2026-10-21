'use client';

import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent',
  secondary: 'bg-surface-2 text-text',
  ghost: 'bg-transparent text-link',
  danger: 'bg-danger/12 text-danger',
  success: 'bg-success text-white',
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
  size?: 'sm' | 'md' | 'lg';
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
        'press inline-flex items-center justify-center gap-2 rounded-2xl font-semibold select-none disabled:opacity-50',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-12 px-4 text-[15px]',
        size === 'lg' && 'h-14 px-5 text-[17px]',
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
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'press inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold',
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx(
        'block w-full rounded-3xl bg-surface p-4 text-left',
        onClick && 'press',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {(title || action) && (
        <div className="flex items-center justify-between px-1">
          {title && (
            <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

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
    <div className={cx('space-y-1', className)}>
      <label htmlFor={id} className="block px-1 text-[13px] font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[16px] text-text outline-none placeholder:text-muted/70 focus:border-accent"
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={cx('px-1 text-xs', error ? 'text-danger' : 'text-muted')}>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block px-1 text-[13px] font-medium text-muted">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[16px] text-text outline-none placeholder:text-muted/70 focus:border-accent"
      />
    </div>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
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
    <div role="alert" className="space-y-3 rounded-3xl bg-surface p-6 text-center">
      <p className="text-[15px]">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="anim-in space-y-3 rounded-3xl bg-surface px-6 py-10 text-center">
      <div className="text-4xl" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="text-[15px] text-muted">{text}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pt-2 pb-1">
      <div className="min-w-0">
        {subtitle && <p className="truncate text-[13px] font-medium text-muted">{subtitle}</p>}
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** Bottom sheet dialog — reachable with the thumb, closes on backdrop/Escape. */
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
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
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="anim-sheet relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface px-4 pt-3 outline-none"
        style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
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
          Отмена
        </Button>
      </div>
    </Sheet>
  );
}

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
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 flex-1 rounded-xl text-sm font-semibold transition-colors',
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted',
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
        'press h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap',
        active ? 'bg-accent text-on-accent' : 'bg-surface text-text',
      )}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted">—</span>;
  const up = pct > 0;
  return (
    <span
      className={cx(
        'num font-semibold',
        pct === 0 ? 'text-muted' : up ? 'text-success' : 'text-danger',
      )}
    >
      {up ? '↑' : pct < 0 ? '↓' : ''} {Math.abs(pct)}%
    </span>
  );
}
