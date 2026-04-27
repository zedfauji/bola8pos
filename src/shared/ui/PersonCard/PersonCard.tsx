/**
 * PERSON CARD COMPONENT
 *
 * Extends SubTabColumn by replacing the static label with an editable Input.
 * Used exclusively in By Person split mode inside SplitTabSheet.
 *
 * The name Input programmatically focuses (via ref) when autoFocusName=true
 * so that users can immediately type after adding a new person.
 */

import { useEffect, useRef } from 'react';

import type { SubTabColumnProps } from '@shared/ui/SubTabColumn';
import { SubTabColumn } from '@shared/ui/SubTabColumn';
import { Input } from '@shared/ui/input';

export interface PersonCardProps extends Omit<SubTabColumnProps, 'label'> {
  /** Editable name shown in the column header */
  name: string;
  /** Called whenever the user changes the name */
  onNameChange: (name: string) => void;
  /** Programmatically focus the name input on mount (use when PersonCard is newly added) */
  autoFocusName?: boolean;
}

/**
 * A split-bill column card with an editable name label.
 *
 * @example
 * ```tsx
 * <PersonCard
 *   name="Alice"
 *   onNameChange={name => updatePerson(id, name)}
 *   items={aliceItems}
 *   total={aliceTotal}
 *   isSelected={activeColumn === id}
 *   onSelect={() => setActiveColumn(id)}
 *   onRemoveItem={handleRemove}
 *   autoFocusName
 * />
 * ```
 */
export function PersonCard({
  name,
  onNameChange,
  autoFocusName = false,
  ...rest
}: PersonCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusName) {
      inputRef.current?.focus();
    }
    // Focus only on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelSlot = (
    <Input
      ref={inputRef}
      value={name}
      onChange={e => {
        onNameChange(e.target.value);
      }}
      placeholder="Person name"
      className="text-sm font-semibold h-7 border-0 px-1 bg-transparent focus-visible:ring-1 max-w-[100px]"
      maxLength={30}
      onClick={e => {
        e.stopPropagation();
      }}
    />
  );

  return <SubTabColumn label={name} labelSlot={labelSlot} {...rest} />;
}
