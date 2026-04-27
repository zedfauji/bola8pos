import * as React from 'react';
import type { Category } from '@entities/product/model/types';
import { cn } from '@shared/lib/utils';

export interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onChange: (categoryId: string | null) => void;
  className?: string;
}

const pillClass = (active: boolean) =>
  cn(
    'flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
  );

export function CategoryTabs({
  categories,
  activeCategory,
  onChange,
  className,
}: CategoryTabsProps) {
  const allRef = React.useRef<HTMLButtonElement>(null);
  const categoryRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const setCategoryRef = React.useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) categoryRefs.current.set(id, el);
    else categoryRefs.current.delete(id);
  }, []);

  React.useLayoutEffect(() => {
    const target =
      activeCategory === null ? allRef.current : (categoryRefs.current.get(activeCategory) ?? null);
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCategory, categories]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, categoryId: string | null) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(categoryId);
    }
  };

  return (
    <div
      className={cn(
        'w-full overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex w-max min-w-full gap-2 p-2">
        <button
          ref={allRef}
          type="button"
          onClick={() => {
            onChange(null);
          }}
          onKeyDown={e => {
            handleKeyDown(e, null);
          }}
          className={pillClass(activeCategory === null)}
          aria-label="Show all categories"
          aria-pressed={activeCategory === null}
        >
          All
        </button>

        {categories.map(category => (
          <button
            key={category.id}
            ref={el => {
              setCategoryRef(category.id, el);
            }}
            type="button"
            onClick={() => {
              onChange(category.id);
            }}
            onKeyDown={e => {
              handleKeyDown(e, category.id);
            }}
            className={pillClass(activeCategory === category.id)}
            aria-label={`Filter by ${category.name}`}
            aria-pressed={activeCategory === category.id}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden="true"
            />
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
