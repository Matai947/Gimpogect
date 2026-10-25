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
  items?: { id: string; qty: number }[]; // shop: what was sold, so the shelf count follows
  refundOf?: string; // refund / debt payment: the row it belongs to
  synced?: boolean; // reached the server
};

/** What a row adds to the income: refunds and open debts take money away, debt payments bring it back on the day it arrives. */
export const saleValue = (s: Sale): number => (s.kind === 'refund' || s.kind === 'debt' ? -s.amount : s.amount);

/** The bar (goods) or memberships (plans and personal training); a refund belongs where the sale it returns did.
    Debts and debt payments are left out: they are not a sale of either. */
export type SaleGroup = 'bar' | 'plans';
export const saleGroup = (s: Sale, byId: (id: string) => Sale | undefined): SaleGroup | null => {
  const kind = s.kind === 'refund' && s.refundOf ? byId(s.refundOf)?.kind : s.kind;
  return kind === 'shop' ? 'bar' : kind === 'plan' || kind === 'personal' ? 'plans' : null;
};
/** Sums per group, cash and non-cash apart, refunds taken off. */
export function groupTotals(rows: Sale[], byId: (id: string) => Sale | undefined) {
  const out = { bar: { cash: 0, nonCash: 0 }, plans: { cash: 0, nonCash: 0 } };
  for (const s of rows) {
    const g = saleGroup(s, byId);
    if (!g || s.method === 'desk') continue;
    out[g][s.method === 'cash' ? 'cash' : 'nonCash'] += s.kind === 'refund' ? -s.amount : s.amount;
  }
  return out;
}

/** Real payments only; the demo history is gone with the demo members. */
export const mockSales: Sale[] = [];
