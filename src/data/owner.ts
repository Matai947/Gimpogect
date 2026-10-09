export const OWNER_DEMO_CODE = '1357';

export type PayMethod = 'kaspi' | 'card' | 'cash' | 'split' | 'desk';

export type Sale = {
  id: string;
  ts: number;
  memberId?: string;
  name: string; // client
  title: string; // plan name or product
  kind: 'plan' | 'shop';
  amount: number;
  clubId: string;
  method: PayMethod;
  staff: string;
};

/** Real payments only; the demo history is gone with the demo members. */
export const mockSales: Sale[] = [];
