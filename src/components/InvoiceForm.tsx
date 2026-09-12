import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { isAddress, type Address } from 'viem';
import { validateInvoice, type Invoice } from '../domain/invoice';
export function InvoiceForm({ demo, account, busy, onClose, onSubmit }: { demo: boolean; account: string; busy: boolean; onClose: () => void; onSubmit: (item: Invoice) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const item: Invoice = { id: `INV-${Date.now().toString().slice(-6)}`, business: String(values.business).trim(), ensName: String(values.ensName).trim().toLowerCase(),
        faceValue: String(values.faceValue), price: String(values.price), dueDate: String(values.dueDate), status: 'Open',
        seller: (account || '0x474a6b1fa5dcfb636ad0fdf7373f323c9d41bd6e') as Address,
        debtor: (demo ? '0x1111111111111111111111111111111111111111' : values.debtor) as Address,
        asset: (demo ? `0x${Date.now().toString(16).padStart(40, '0')}` : values.asset) as Address,
        activity: [{ label: demo ? 'Demo: Issued' : 'Issued', at: new Date().toISOString() }],
      };
      validateInvoice(item);
      if (!isAddress(item.asset) || !isAddress(item.debtor)) throw new Error('Enter valid asset and debtor EVM addresses.');
      if (!demo && !account) throw new Error('Connect the Hedera issuer wallet before listing.');
      await onSubmit(item);
    } catch (err) { setError((err as Error).message); }
  }
  return <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}><form onSubmit={submit}><div className="dialog-heading"><h2>New invoice</h2><button type="button" className="icon-button" aria-label="Close new invoice" onClick={onClose} disabled={busy}><X/></button></div><p className="muted">{demo ? 'Create a sample receivable and explore the financing lifecycle.' : 'Publish the terms to ENSv2, then list your approved ATS asset on Hedera.'}</p>
    <div className="form-grid"><label>Business name<input name="business" required maxLength={100} placeholder="Acme Studio"/></label><label>Invoice ENS subname<input name="ensName" required placeholder="inv-004.acme.eth"/></label><label>Face value (USD)<input name="faceValue" type="number" min="0.01" step="0.01" required placeholder="10000"/></label><label>Finance price (USD)<input name="price" type="number" min="0.01" step="0.01" required placeholder="9700"/></label><label>Due date<input name="dueDate" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required/></label>{!demo && <><label>ATS asset EVM address<input name="asset" required placeholder="0x…"/></label><label className="span-two">Debtor EVM address<input name="debtor" required placeholder="0x…"/></label></>}</div>
    {!demo && <p className="form-hint">Issue and configure the asset with the ATS script first. Your finance wallet needs permission for this invoice's ENS record. Listing may require Sepolia publication, Hedera approval, and a listing confirmation.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="form-footer"><button type="button" className="button outline" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Waiting for confirmation…' : demo ? 'Create invoice' : 'Publish and list invoice'}</button></div></form></dialog>;
}
