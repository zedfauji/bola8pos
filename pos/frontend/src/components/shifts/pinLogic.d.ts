export interface PinPayoutParams {
  amount: number;
  threshold: number;
  globallyRequired: boolean;
}

export function needsPinForPayout(params: PinPayoutParams): boolean;
