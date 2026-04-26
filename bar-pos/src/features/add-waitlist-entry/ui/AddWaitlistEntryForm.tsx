import { useReducer } from 'react';

import { toE164 } from '@shared/lib/phone';
import {
  Button,
  FormField,
  Input,
  Label,
  LoadingSpinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { useAddWaitlistEntry } from '../model/useAddWaitlistEntry';

// ────────────────────────────────────────────────────────────────────────────
// State / reducer
// ────────────────────────────────────────────────────────────────────────────

type State = {
  name: string;
  partySize: number;
  phoneRaw: string;
  phoneBlurred: boolean;
};

type Action =
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_PARTY_SIZE'; size: number }
  | { type: 'SET_PHONE'; raw: string }
  | { type: 'PHONE_BLUR' }
  | { type: 'RESET' };

const initialState: State = {
  name: '',
  partySize: 1,
  phoneRaw: '',
  phoneBlurred: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_PARTY_SIZE':
      return { ...state, partySize: action.size };
    case 'SET_PHONE':
      // Clear blur state immediately on change so inline error disappears
      return { ...state, phoneRaw: action.raw, phoneBlurred: false };
    case 'PHONE_BLUR':
      return { ...state, phoneBlurred: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ────────────────────────────────────────────────────────────────────────────

function isPhoneInvalid(state: State): boolean {
  return state.phoneBlurred && state.phoneRaw !== '' && toE164(state.phoneRaw) === null;
}

function isValid(state: State): boolean {
  return (
    state.name.trim().length >= 1 && (state.phoneRaw === '' || toE164(state.phoneRaw) !== null)
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export interface AddWaitlistEntryFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddWaitlistEntryForm({ open, onClose }: AddWaitlistEntryFormProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { addEntry, isPending } = useAddWaitlistEntry();

  function handleClose() {
    dispatch({ type: 'RESET' });
    onClose();
  }

  async function handleSubmit() {
    if (!isValid(state) || isPending) return;
    const result = await addEntry({
      name: state.name.trim(),
      partySize: state.partySize,
      phoneE164: toE164(state.phoneRaw),
    });
    if (result.ok) {
      handleClose();
    }
    // On error: stay open, toast shown by hook
  }

  const phoneError = isPhoneInvalid(state);

  return (
    <Sheet
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) handleClose();
      }}
    >
      {/* Focus is trapped by Radix UI SheetContent — no explicit autoFocus needed */}
      <SheetContent side="right" className="max-w-md w-full flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>Add to waitlist</SheetTitle>
          <SheetDescription>Record a walk-in party waiting for a pool table.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 py-4 flex-1">
          {/* Party name */}
          <FormField label="Party name" required>
            <Input
              placeholder="e.g. García"
              maxLength={100}
              value={state.name}
              onChange={e => {
                dispatch({ type: 'SET_NAME', name: e.target.value });
              }}
            />
          </FormField>

          {/* Party size */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Party size{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Select
              value={String(state.partySize)}
              onValueChange={val => {
                dispatch({ type: 'SET_PARTY_SIZE', size: Number(val) });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone number */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="waitlist-phone">Phone number</Label>
            <Input
              id="waitlist-phone"
              type="tel"
              inputMode="tel"
              placeholder="e.g. 55 1234 5678"
              value={state.phoneRaw}
              aria-describedby={phoneError ? 'waitlist-phone-error' : undefined}
              onChange={e => {
                dispatch({ type: 'SET_PHONE', raw: e.target.value });
              }}
              onBlur={() => {
                dispatch({ type: 'PHONE_BLUR' });
              }}
            />
            <span className="text-sm text-muted-foreground">
              MX/US number. Used to send WhatsApp notification.
            </span>
            {phoneError && (
              <span id="waitlist-phone-error" role="alert" className="text-sm text-destructive">
                Not a valid MX or US phone number.
              </span>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 flex gap-3">
          <Button size="lg" variant="outline" className="flex-1" onClick={handleClose}>
            Discard
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={!isValid(state) || isPending}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {isPending ? <LoadingSpinner size={16} className="p-0" /> : 'Add to waitlist'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
