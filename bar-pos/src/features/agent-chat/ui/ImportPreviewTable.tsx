import { Button } from '@shared/ui/button';

interface ImportPreviewTableProps {
  products: Array<{ name: string; price: number }>;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const MAX_DISPLAY = 20;

export function ImportPreviewTable({
  products,
  onConfirm,
  onCancel,
  isLoading,
}: ImportPreviewTableProps) {
  const displayed = products.slice(0, MAX_DISPLAY);
  const remaining = products.length - MAX_DISPLAY;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-sm font-medium text-foreground">
        Vista previa — {products.length} producto{products.length !== 1 ? 's' : ''}
      </p>
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-1 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="pb-1 text-right font-medium text-muted-foreground">Precio</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p, idx) => (
              <tr key={idx} className="border-b border-border/50 last:border-0">
                <td className="py-1 text-left text-foreground">{p.name}</td>
                <td className="py-1 text-right text-foreground">
                  ${p.price.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {remaining > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">y {remaining} más...</p>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Importando...' : 'Confirmar importación'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
