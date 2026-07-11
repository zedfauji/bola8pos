import { useState, type SyntheticEvent } from 'react';
import { z } from 'zod';
import type { Category } from '@shared/lib/domain';
import { CategoryCreateSchema, CategoryUpdateSchema } from '@shared/lib/domain';
import { FormField } from '@shared/ui/FormField';
import { POSButton } from '@shared/ui/POSButton';
import { Input } from '@shared/ui/input';

export type CategoryFormProps = {
  initialCategory?: Category | null;
  submitting?: boolean;
  onSubmitCreate: (payload: z.infer<typeof CategoryCreateSchema>) => void;
  onSubmitUpdate: (payload: z.infer<typeof CategoryUpdateSchema>) => void;
  onCancel: () => void;
};

function normalizeHex(raw: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  return t.startsWith('#') ? t : `#${t}`;
}

export function CategoryForm({
  initialCategory,
  submitting = false,
  onSubmitCreate,
  onSubmitUpdate,
  onCancel,
}: CategoryFormProps) {
  const isEdit = initialCategory != null;

  const [name, setName] = useState(initialCategory?.name ?? '');
  // TOKEN-01 exempt: category.color is arbitrary per-row USER DATA (each category
  // picks its own color), not an app theme color. Do not map to a Tailwind CSS-variable
  // token — see 31-CONTEXT.md D-08.
  const [color, setColor] = useState(initialCategory?.color ?? '#6B7280');
  const [sortOrder, setSortOrder] = useState(String(initialCategory?.sortOrder ?? 0));
  const [happyStart, setHappyStart] = useState(() => {
    const s = initialCategory?.happyHourStart;
    if (s == null) return '';
    return s.length >= 5 ? s.slice(0, 5) : s;
  });
  const [happyEnd, setHappyEnd] = useState(() => {
    const s = initialCategory?.happyHourEnd;
    if (s == null) return '';
    return s.length >= 5 ? s.slice(0, 5) : s;
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});

    const sortParsed = Number.parseInt(sortOrder, 10);
    if (Number.isNaN(sortParsed) || sortParsed < 0) {
      setFieldErrors({ sortOrder: 'Sort order must be a non-negative integer' });
      return;
    }

    const start = happyStart.trim() === '' ? null : happyStart.trim();
    const end = happyEnd.trim() === '' ? null : happyEnd.trim();
    if ((start == null) !== (end == null)) {
      setFieldErrors({
        happyHour: 'Set both happy hour start and end, or leave both empty.',
      });
      return;
    }

    const hex = normalizeHex(color);

    if (initialCategory != null) {
      const parsed = CategoryUpdateSchema.safeParse({
        id: initialCategory.id,
        name,
        color: hex,
        sortOrder: sortParsed,
        happyHourStart: start,
        happyHourEnd: end,
      });
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(flat.fieldErrors)) {
          const first = Array.isArray(v) ? v[0] : undefined;
          if (first) next[k] = first;
        }
        setFieldErrors(next);
        return;
      }
      onSubmitUpdate(parsed.data);
      return;
    }

    const parsed = CategoryCreateSchema.safeParse({
      name,
      color: hex,
      sortOrder: sortParsed,
      happyHourStart: start,
      happyHourEnd: end,
    });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat.fieldErrors)) {
        const first = Array.isArray(v) ? v[0] : undefined;
        if (first) next[k] = first;
      }
      setFieldErrors(next);
      return;
    }
    onSubmitCreate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fieldErrors.happyHour ? (
        <p className="text-sm text-destructive">{fieldErrors.happyHour}</p>
      ) : null}

      <FormField label="Name" required error={fieldErrors.name ?? ''}>
        <Input
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField
        label="Color"
        required
        error={fieldErrors.color ?? ''}
        hint="Hex or use the picker"
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* native color input — no shared/ui color-picker primitive exists, see 31-CONTEXT.md D-05 */}
          <input
            type="color"
            aria-label="Color picker"
            className="h-9 w-14 cursor-pointer rounded border bg-transparent p-0"
            value={color.startsWith('#') ? color.slice(0, 7) : `#${color}`.slice(0, 7)}
            onChange={e => {
              setColor(e.target.value.toUpperCase());
            }}
            disabled={submitting}
          />
          {/* TOKEN-01 exempt: category.color is arbitrary per-row USER DATA (each category
              picks its own color), not an app theme color. Do not map to a Tailwind CSS-variable
              token — see 31-CONTEXT.md D-08. */}
          <Input
            className="max-w-[9rem] font-mono text-sm"
            value={color}
            onChange={e => {
              setColor(e.target.value);
            }}
            placeholder="#6B7280"
            disabled={submitting}
          />
        </div>
      </FormField>

      <FormField label="Sort order" required error={fieldErrors.sortOrder ?? ''}>
        <Input
          inputMode="numeric"
          value={sortOrder}
          onChange={e => {
            setSortOrder(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField label="Happy hour start" error={fieldErrors.happyHourStart ?? ''}>
        <Input
          type="time"
          value={happyStart}
          onChange={e => {
            setHappyStart(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField label="Happy hour end" error={fieldErrors.happyHourEnd ?? ''}>
        <Input
          type="time"
          value={happyEnd}
          onChange={e => {
            setHappyEnd(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <POSButton
          type="button"
          variant="outline"
          touchSize="default"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </POSButton>
        <POSButton type="submit" touchSize="default" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save category' : 'Create category'}
        </POSButton>
      </div>
    </form>
  );
}
