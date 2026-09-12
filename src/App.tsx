import { useCallback, useEffect, useRef, useState } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { Shell, type Page } from './components/Shell';
import { Marketplace } from './components/Marketplace';
import { InvoiceForm } from './components/InvoiceForm';
import { Identity } from './components/Identity';
import { Integrations } from './components/Integrations';
import { seedInvoices } from './domain/demo';
import { transition, type Invoice } from './domain/invoice';
import { defaultConfig, walletFor, hederaTestnet, type Config } from './chain/clients';
import { actOnInvoice, listInvoice, loadInvoices } from './chain/market';
import { publishInvoice, verifyInvoice } from './chain/ens';

function restore<T>(key: string, fallback: T): T { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } }
export default function App() {
  const [page, setPage] = useState<Page>('Marketplace'), [demo, setDemo] = useState(true), [account, setAccount] = useState('');
  const [demoInvoices, setDemoInvoices] = useState<Invoice[]>(() => { const saved = restore<Invoice[]>('invoicex.demo.v1', seedInvoices()); return Array.isArray(saved) && saved.every(i => i.id && i.activity && i.faceValue) ? saved : seedInvoices(); });
  const [chainInvoices, setChainInvoices] = useState<Invoice[]>([]), [config, setConfig] = useState<Config>(() => ({ ...defaultConfig, ...restore('invoicex.config.v1', {}) }));
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const lock = useRef(false), generation = useRef(0);
  useEffect(() => { localStorage.setItem('invoicex.demo.v1', JSON.stringify(demoInvoices)); }, [demoInvoices]);
  useEffect(() => { localStorage.setItem('invoicex.config.v1', JSON.stringify(config)); }, [config]);
  useEffect(() => {
    const provider = window.ethereum as typeof window.ethereum & { on?: (name: string, listener: (...args: any[]) => void) => void; removeListener?: (name: string, listener: (...args: any[]) => void) => void };
    const changed = (accounts: string[]) => setAccount(accounts[0] || '');
    provider?.on?.('accountsChanged', changed);
    return () => provider?.removeListener?.('accountsChanged', changed);
  }, []);
  const run = useCallback(async (fn: () => Promise<string>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice(null);
    try { setNotice({ text: await fn(), error: false }); }
    catch (error) { const message = (error as { shortMessage?: string }).shortMessage || (error as Error).message; setNotice({ text: message || 'The operation could not be completed.', error: true }); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  async function refresh() { const epoch = ++generation.current; const items = await loadInvoices(config); if (epoch === generation.current) setChainInvoices(items); return 'Hedera invoices refreshed.'; }
  function changeMode(next: boolean) { if (busy) return; generation.current++; setDemo(next); setNotice(null); setChainInvoices([]); if (!next && config.market) void run(refresh); }
  async function create(item: Invoice) {
    if (lock.current) throw new Error('Wait for the current operation to finish.');
    if (demo) { setDemoInvoices(current => [item, ...current]); setCreating(false); setNotice({ text: 'Demo invoice created.', error: false }); return; }
    lock.current = true; setBusy(true);
    try {
      // Persist the exact draft for recovery if publication succeeds but listing is rejected.
      localStorage.setItem('invoicex.pending-invoice.v1', JSON.stringify(item));
      await publishInvoice(item, config);
      const hash = await listInvoice(item, config);
      localStorage.removeItem('invoicex.pending-invoice.v1');
      await refresh(); setCreating(false); setNotice({ text: `Invoice published and listed. Hedera receipt: ${hash}`, error: false });
    } finally { lock.current = false; setBusy(false); }
  }
  function action(item: Invoice, type: 'finance' | 'repay' | 'claim' | 'cancel') { void run(async () => {
    if (demo) { const next = transition(item, type); setDemoInvoices(items => items.map(i => i.id === item.id ? next : i)); return `Demo invoice ${next.status.toLowerCase()}. No real funds moved.`; }
    const hash = await actOnInvoice(item, type, config); await refresh(); return `Transaction confirmed on Hedera testnet: ${hash}`;
  }); }
  return <Shell page={page} setPage={setPage} demo={demo} setDemo={changeMode} account={account} connect={() => run(async () => { const wallet = await walletFor(hederaTestnet); setAccount(wallet.account.address); return 'Wallet connected to Hedera testnet.'; })}>
    {busy && <div className="busy-bar" role="status"><LoaderCircle size={16}/> Confirm the transaction in your wallet. Waiting for the network…</div>}
    {notice && <div className={`notice ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.text}</span><button className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {(page === 'Marketplace' || page === 'My invoices') && <Marketplace invoices={demo ? demoInvoices : chainInvoices} demo={demo} mine={page === 'My invoices'} account={account} busy={busy} onCreate={() => setCreating(true)} onAction={action} onRefresh={() => run(refresh)} onVerify={item => run(async () => { const verified = await verifyInvoice(item, config); return `ENSv2 publication verified for ${verified.business}. Terms match the Hedera commitment.`; })}/>}
    {page === 'Business identity' && <Identity demo={demo} config={config} run={run}/>}
    {page === 'Integrations' && <Integrations demo={demo} config={config} setConfig={value => { setConfig(value); setChainInvoices([]); }} run={run}/>}
    {creating && <InvoiceForm demo={demo} account={account} busy={busy} onClose={() => setCreating(false)} onSubmit={create}/>}
  </Shell>;
}
