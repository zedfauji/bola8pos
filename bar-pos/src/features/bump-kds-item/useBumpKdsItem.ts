import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bumpKdsItem, kdsKeys } from '@entities/kds';

export function useBumpKdsItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, nextStatus }: { itemId: string; nextStatus: 'in_progress' | 'done' }) =>
      bumpKdsItem(itemId, nextStatus),
    onSuccess: result => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: kdsKeys.all });
    },
    onError: () => toast.error('Failed to update item status.'),
  });
}
