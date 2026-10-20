export const OWNER_DEMO_CODE = '1357';

export type PayMethod = 'kaspi' | 'card' | 'cash' | 'transfer' | 'split' | 'desk';

export type SaleKind = 'plan' | 'shop' | 'personal' | 'debt' | 'debt_payment' | 'refund';

export type Sale = {
  id: string;
  ts: number;
  memberId?: string;
  name: string; // client
  title: string; // plan name or product
  kind: SaleKind;
  amount: number;
  clubId: string;
  method: PayMethod;
  staff: string;
  trainerId?: string; // personal training: whose
  remaining?: number; // debt: still owed
  refunded?: number; // sale: already returned
  reason?: string; // refund: why the money went back
  refundOf?: string; // refund / debt payment: the row it belongs to
  synced?: boolean; // reached the server
};

/** What a row adds to the income: refunds and open debts take money away, debt payments bring it back on the day it arrives. */
export const saleValue = (s: Sale): number => (s.kind === 'refund' || s.kind === 'debt' ? -s.amount : s.amount);

/** Real payments only; the demo history is gone with the demo members. */
export const mockSales: Sale[] = [];
