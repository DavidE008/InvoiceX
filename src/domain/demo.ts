import type { Invoice } from './invoice';
const seller = '0x474a6b1fa5dcfb636ad0fdf7373f323c9d41bd6e' as const;
export function seedInvoices(): Invoice[] {
  return [
    ['Acme Studio', 'acme', '10000', '9700', 60],
    ['Northstar Supply', 'northstar', '24000', '23280', 45],
    ['Fieldwork Labs', 'fieldwork', '11500', '11120', 75],
  ].map(([business, label, faceValue, price, days], index) => ({
    id: `INV-00${index + 1}`, business: String(business), ensName: `inv-00${index + 1}.${label}.eth`,
    faceValue: String(faceValue), price: String(price), dueDate: new Date(Date.now() + Number(days) * 86_400_000).toISOString().slice(0, 10),
    status: 'Open', seller, debtor: '0x1111111111111111111111111111111111111111',
    asset: `0x${String(index + 1).padStart(40, '0')}`, activity: [{ label: 'Demo: Issued', at: new Date().toISOString() }],
  }));
}
