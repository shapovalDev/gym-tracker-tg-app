import { NoteIcon } from '@/components/icons';
import { t } from '@/i18n';

/** Technique note (library) and plan note (this workout), shown where the exercise is. */
export function ExerciseNotes({
  technique,
  plan,
}: {
  technique?: string | null;
  plan?: string | null;
}) {
  if (!technique && !plan) return null;
  return (
    <div className="space-y-1.5">
      {plan && (
        <p className="flex gap-2 rounded-xl bg-primary-soft px-3 py-2 text-[14px] text-ink">
          <span className="mt-0.5 shrink-0 text-primary">
            <NoteIcon />
          </span>
          <span>
            <span className="font-semibold">{t('In this workout:')} </span>
            {plan}
          </span>
        </p>
      )}
      {technique && (
        <p className="flex gap-2 rounded-xl bg-inset px-3 py-2 text-[14px] whitespace-pre-line text-ink">
          <span className="mt-0.5 shrink-0 text-muted">
            <NoteIcon />
          </span>
          <span>
            <span className="font-semibold">{t('Technique:')} </span>
            {technique}
          </span>
        </p>
      )}
    </div>
  );
}
