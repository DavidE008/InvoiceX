import { keccak256, toHex, isAddress, type Address, type Hex } from 'viem';
import { normalize } from 'viem/ens';

export type Status = 'Open' | 'Financed' | 'Repaid' | 'Settled' | 'Cancelled';
export interface Invoice {
  id: string; business: string; ensName: string; asset: Address; seller: Address; debtor: Address;
  faceValue: string; price: string; dueDate: string; status: Status; commitment?: Hex;
  holder?: Address; activity: { label: string; at: string; hash?: Hex; chain?: 'hedera' | 'sepolia' }[];
}
export function moneyToUnits(input: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, cents = ''] = input.split('.');
  const units = BigInt(whole) * 1_000_000n + BigInt(cents.padEnd(6, '0'));
  if (units <= 0n || units > 1_000_000_000_000_000n) throw new Error('Amount must be between $0.01 and $1 billion.');
  return units;
}
export function validateInvoice(item: Pick<Invoice, 'business' | 'ensName' | 'faceValue' | 'price' | 'dueDate'>) {
  if (!item.business.trim() || item.business.length > 100) throw new Error('Enter a business name of at most 100 characters.');
  normalize(item.ensName);
  if (item.ensName.split('.').length < 3) throw new Error('Use an invoice subname, for example inv-001.acme.eth.');
  if (moneyToUnits(item.price) > moneyToUnits(item.faceValue)) throw new Error('Finance price cannot exceed face value.');
  if (!Number.isFinite(Date.parse(item.dueDate)) || Date.parse(item.dueDate) <= Date.now()) throw new Error('Due date must be in the future.');
}
export function invoiceCommitment(item: Pick<Invoice, 'ensName' | 'asset' | 'seller' | 'debtor' | 'faceValue' | 'price' | 'dueDate'>): Hex {
  for (const address of [item.asset, item.seller, item.debtor]) if (!isAddress(address)) throw new Error('Invalid invoice address.');
  // Fixed ordering, base units, lowercase addresses and UTC seconds prevent ambiguous commitments.
  return keccak256(toHex(JSON.stringify({ version: 1, chainId: 296, name: normalize(item.ensName),
    asset: item.asset.toLowerCase(), seller: item.seller.toLowerCase(), debtor: item.debtor.toLowerCase(),
    faceValue: moneyToUnits(item.faceValue).toString(), price: moneyToUnits(item.price).toString(),
    dueDate: Math.floor(Date.parse(item.dueDate) / 1000) })));
}
export function transition(item: Invoice, action: 'finance' | 'repay' | 'claim' | 'cancel'): Invoice {
  const rules = { finance: ['Open', 'Financed'], repay: ['Financed', 'Repaid'], claim: ['Repaid', 'Settled'], cancel: ['Open', 'Cancelled'] } as const;
  if (item.status !== rules[action][0]) throw new Error(`Cannot ${action} an invoice that is ${item.status.toLowerCase()}.`);
  if (action === 'finance' && Date.parse(item.dueDate) <= Date.now()) throw new Error('This invoice has matured and cannot be financed.');
  return { ...item, status: rules[action][1], activity: [...item.activity, { label: `Demo: ${rules[action][1]}`, at: new Date().toISOString() }] };
}
export const money = (value: string | number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value));
export const daysUntil = (date: string) => Math.ceil((Date.parse(date) - Date.now()) / 86_400_000);
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
