/**
 * UPDATE AVAILABLE DIALOG COMPONENT
 *
 * Four-state dialog: idle → downloading → restart-ready → error.
 * Wraps shadcn AlertDialog with Progress bar for download phase.
 * State machine owned by useAppUpdater hook (shared/lib/useAppUpdater.ts).
 */

import { Loader2 } from 'lucide-react';
import type { UpdaterState } from '@shared/lib/useAppUpdater';
import { ScrollArea } from './ScrollArea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Badge } from './badge';
import { Button } from './button';
import { Progress } from './progress';

export interface UpdateAvailableDialogProps {
  state: UpdaterState;
  onInstall: () => void | Promise<void>;
  onRemindLater: () => void;
  onDismiss: () => void;
  onRestart: () => Promise<void>;
}

export function UpdateAvailableDialog({
  state,
  onInstall,
  onRemindLater,
  onDismiss,
  onRestart,
}: UpdateAvailableDialogProps) {
  const isOpen = state.phase !== 'idle';
  const isDownloading = state.phase === 'downloading';

  const version =
    state.phase === 'available' || state.phase === 'downloading' || state.phase === 'restart-ready'
      ? state.version
      : undefined;

  const titleMap: Record<Exclude<UpdaterState['phase'], 'idle'>, string> = {
    available: 'Update Available',
    downloading: 'Downloading Update',
    'restart-ready': 'Ready to Restart',
    error: 'Update Failed',
  };

  const descriptionMap: Record<Exclude<UpdaterState['phase'], 'idle'>, string> = {
    available: version ? `Version ${version} is ready to install.` : 'A new version is ready.',
    downloading: 'Please wait — do not close the app.',
    'restart-ready': 'Update installed. Restart now to apply changes.',
    error: 'Could not download the update. Try again later.',
  };

  const title = state.phase !== 'idle' ? titleMap[state.phase] : '';
  const description = state.phase !== 'idle' ? descriptionMap[state.phase] : '';

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Block dismiss during download (T-9-04-03 mitigation)
        if (!open && !isDownloading) {
          if (state.phase === 'available') {
            onRemindLater();
          } else {
            onDismiss();
          }
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        {/* Hidden state marker for tests and E2E */}
        <div data-testid="update-dialog-state" data-state={state.phase} className="sr-only" />

        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {version != null && (
              <Badge variant="secondary" className="text-xs font-semibold">
                {version}
              </Badge>
            )}
          </div>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* Changelog — available state only */}
        {state.phase === 'available' && (
          <div>
            <p className="text-sm font-semibold mb-2">What&apos;s new</p>
            <ScrollArea className="max-h-48 rounded-md border p-3">
              {/* Render as pre-formatted text — never dangerouslySetInnerHTML (XSS, ASVS V5) */}
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {state.changelog}
              </p>
            </ScrollArea>
          </div>
        )}

        {/* Progress bar — downloading state only */}
        {state.phase === 'downloading' && (
          <div className="space-y-1">
            <Progress
              data-testid="update-progress"
              value={state.percent}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Downloading {state.percent}%</p>
          </div>
        )}

        <AlertDialogFooter>
          {/* Available state: Remind Later (ghost) + Install Now (default) */}
          {state.phase === 'available' && (
            <>
              <Button variant="ghost" onClick={onRemindLater}>
                Remind Later
              </Button>
              <Button variant="default" onClick={() => { void onInstall(); }}>
                Install Now
              </Button>
            </>
          )}

          {/* Downloading state — both buttons disabled */}
          {state.phase === 'downloading' && (
            <>
              <Button variant="ghost" disabled>
                Remind Later
              </Button>
              <Button variant="default" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </Button>
            </>
          )}

          {/* Restart-ready state: Later (ghost) + Restart Now (default) */}
          {state.phase === 'restart-ready' && (
            <>
              <Button variant="ghost" onClick={onDismiss}>
                Later
              </Button>
              <Button variant="default" onClick={() => { void onRestart(); }}>
                Restart Now
              </Button>
            </>
          )}

          {/* Error state: Close (ghost) only */}
          {state.phase === 'error' && (
            <Button variant="ghost" onClick={onDismiss}>
              Close
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
