import { AlertTriangle, Check, X } from 'lucide-react';
import type { PendingConfirmation } from '@shared/lib/agent/brain';
import { Button } from '@shared/ui/button';

interface Props {
  pending: PendingConfirmation;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  close_tab: 'Cerrar cuenta',
  stop_pool_session: 'Detener sesión de billar',
  stop_and_move_table: 'Detener y mover mesa',
  deactivate_product: 'Desactivar producto',
  bulk_import_products: 'Importar productos',
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function renderPreview(preview: unknown): React.ReactNode {
  if (!preview || typeof preview !== 'object') return null;
  const entries = Object.entries(preview as Record<string, unknown>).filter(
    ([k]) => k !== 'action'
  );
  return entries.map(([k, v]) => (
    <PreviewRow key={k} label={k} value={String(v)} />
  ));
}

export function ConfirmActionCard({ pending, onConfirm, onCancel, isLoading }: Props) {
  const label = TOOL_LABELS[pending.toolName] ?? pending.toolName;

  return (
    <div className="mx-3 mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">{label}</span>
      </div>

      <div className="mb-3 divide-y divide-border/40 rounded-lg bg-background/60 px-3 py-1">
        {renderPreview(pending.preview)}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 gap-1"
          onClick={onConfirm}
          disabled={isLoading}
        >
          <Check className="size-3.5" />
          Confirmar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
