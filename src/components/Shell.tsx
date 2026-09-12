import { LayoutGrid, FileText, Building2, Plug, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { shortAddress } from '../domain/invoice';
export const pages = ['Marketplace', 'My invoices', 'Business identity', 'Integrations'] as const;
export type Page = typeof pages[number];
const icons = [LayoutGrid, FileText, Building2, Plug];
export function Shell({ page, setPage, demo, setDemo, account, connect, children }: {
  page: Page; setPage: (page: Page) => void; demo: boolean; setDemo: (demo: boolean) => void;
  account: string; connect: () => void; children: ReactNode;
}) {
  return <div className="app-shell"><aside className="sidebar"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); setPage('Marketplace'); }}>InvoiceX</a>
    <nav aria-label="Main navigation">{pages.map((name, i) => { const Icon = icons[i]; return <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => setPage(name)} aria-current={page === name ? 'page' : undefined}><Icon size={21}/><span>{name}</span></button>; })}</nav>
    <div className="sidebar-bottom"><p>ETHOnline 2026</p><label className="workspace-switch"><Building2 size={19}/><span className="sr-only">Workspace mode</span><select aria-label="Workspace mode" value={demo ? 'demo' : 'testnet'} onChange={e => setDemo(e.target.value === 'demo')}><option value="demo">Demo workspace</option><option value="testnet">Testnet workspace</option></select><ChevronDown size={16}/></label></div>
  </aside><div className="main-shell"><header className="topbar"><span>Workspace <span className="slash">/</span> {page}</span><button className="button outline" onClick={connect}>{account ? shortAddress(account) : 'Connect wallet'}</button></header><main>{children}</main></div></div>;
}
