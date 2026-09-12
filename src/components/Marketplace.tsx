import { useState } from "react";
import { Search, RefreshCw, ExternalLink } from "lucide-react";
import { money, daysUntil, type Invoice } from "../domain/invoice";
import { explorer } from "../chain/clients";
export function Marketplace({
  invoices,
  demo,
  mine,
  account,
  busy,
  onCreate,
  onAction,
  onRefresh,
  onVerify,
}: {
  invoices: Invoice[];
  demo: boolean;
  mine: boolean;
  account: string;
  busy: boolean;
  onCreate: () => void;
  onAction: (
    item: Invoice,
    action: "finance" | "repay" | "claim" | "cancel",
  ) => void;
  onRefresh: () => void;
  onVerify: (item: Invoice) => void;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All statuses"),
    [selected, setSelected] = useState("");
  const filtered = invoices.filter(
    (i) =>
      (!mine || demo || i.seller.toLowerCase() === account.toLowerCase()) &&
      (status === "All statuses" || i.status === status) &&
      `${i.business} ${i.ensName} ${i.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const item = filtered.find((i) => i.id === selected) || filtered[0];
  const open = invoices.filter((i) => i.status === "Open");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {mine
              ? "Your receivables, in one place."
              : "Put working capital in motion."}
          </h1>
          <p>
            Finance approved receivables. Follow every step from issuance to
            repayment.
          </p>
        </div>
        <button className="button primary" onClick={onCreate}>
          New invoice
        </button>
      </div>
      <div className={`mode-note ${!demo ? "live" : ""}`}>
        {demo
          ? "Demo mode · Sample invoices, no real funds"
          : "Hedera testnet · Transactions use test funds"}
        {!demo && (
          <button className="text-button" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>
      <section className="summary" aria-label="Invoice totals">
        <div>
          <span>Available to finance</span>
          <strong className="green">
            {money(open.reduce((n, i) => n + Number(i.price), 0))}
          </strong>
        </div>
        <div>
          <span>Invoice face value</span>
          <strong>
            {money(open.reduce((n, i) => n + Number(i.faceValue), 0))}
          </strong>
        </div>
        <div>
          <span>Open invoices</span>
          <strong>{open.length}</strong>
        </div>
      </section>
      <div className="market-layout">
        <section className="market-list">
          <h2>{mine ? "My invoices" : "Invoice marketplace"}</h2>
          <div className="filters">
            <label className="search">
              <Search size={21} />
              <input
                aria-label="Search businesses or invoices"
                placeholder="Search businesses or invoices"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {[
                "All statuses",
                "Open",
                "Financed",
                "Repaid",
                "Settled",
                "Cancelled",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Business / Invoice</th>
                  <th>Face value</th>
                  <th>Finance price</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={item?.id === invoice.id ? "selected" : ""}
                  >
                    <td>
                      <button
                        className="row-select"
                        onClick={() => setSelected(invoice.id)}
                        aria-label={`View ${invoice.business} invoice`}
                      >
                        <strong>{invoice.business}</strong>
                        <span>{demo ? invoice.id : `INV-${invoice.id}`}</span>
                      </button>
                    </td>
                    <td>{money(invoice.faceValue)}</td>
                    <td>{money(invoice.price)}</td>
                    <td>
                      {new Date(invoice.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>
                      <span
                        className={`status ${invoice.status.toLowerCase()}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="empty">
              <h3>
                {search || status !== "All statuses"
                  ? "No matching invoices"
                  : "Your marketplace is ready"}
              </h3>
              <p>
                {demo
                  ? "Try a different filter or create an invoice."
                  : "Connect your deployed marketplace in Integrations, then list an ATS receivable."}
              </p>
            </div>
          )}
        </section>
        {item && (
          <aside className="detail" aria-label="Invoice details">
            <h2>{demo ? item.id : `INV-${item.id}`}</h2>
            <h3 className="business-name">{item.business}</h3>
            <span className="muted namespace">{item.ensName}</span>
            <section>
              <h3>Invoice terms</h3>
              <dl>
                <div>
                  <dt>Face value</dt>
                  <dd>{money(item.faceValue)}</dd>
                </div>
                <div>
                  <dt>Finance price</dt>
                  <dd>{money(item.price)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>
                    {(
                      (1 - Number(item.price) / Number(item.faceValue)) *
                      100
                    ).toFixed(2)}
                    %
                  </dd>
                </div>
                <div>
                  <dt>Due in</dt>
                  <dd>
                    {daysUntil(item.dueDate) > 0
                      ? `${daysUntil(item.dueDate)} days`
                      : "Matured"}
                  </dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Invoice lifecycle</h3>
              <ol className="lifecycle">
                {["Issued", "Financed", "Repaid"].map((label, index) => (
                  <li
                    key={label}
                    className={
                      index <=
                      {
                        Open: 0,
                        Financed: 1,
                        Repaid: 2,
                        Settled: 2,
                        Cancelled: -1,
                      }[item.status]
                        ? "done"
                        : ""
                    }
                  >
                    <span />
                    {label}
                  </li>
                ))}
              </ol>
            </section>
            <div className="detail-actions">
              {item.status === "Open" && (
                <button
                  className="button primary full"
                  disabled={busy || daysUntil(item.dueDate) <= 0}
                  onClick={() => onAction(item, "finance")}
                >
                  {busy ? "Waiting for confirmation…" : "Finance invoice"}
                </button>
              )}
              {item.status === "Financed" && (
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={() => onAction(item, "repay")}
                >
                  Repay invoice
                </button>
              )}
              {item.status === "Repaid" && (
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={() => onAction(item, "claim")}
                >
                  Claim repayment
                </button>
              )}
              {item.status === "Settled" && (
                <p className="success-text">
                  Repayment claimed. Lifecycle complete.
                </p>
              )}
              <p className="risk-note">
                Repayment depends on the debtor paying.
              </p>
              {!demo && (
                <button
                  className="button outline full"
                  onClick={() => onVerify(item)}
                  disabled={busy}
                >
                  Verify ENS publication
                </button>
              )}
              {item.status === "Open" &&
                (demo ||
                  item.seller.toLowerCase() === account.toLowerCase()) && (
                  <button
                    className="text-button muted"
                    onClick={() => onAction(item, "cancel")}
                    disabled={busy}
                  >
                    Cancel listing
                  </button>
                )}
            </div>
            {item.activity.length > 1 && (
              <section className="activity">
                <h3>Activity</h3>
                {item.activity.map((a, i) => (
                  <div key={i}>
                    <span>{a.label}</span>
                    {a.hash ? (
                      <a
                        href={explorer(a.hash, a.chain || "hedera")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Receipt <ExternalLink size={12} />
                      </a>
                    ) : (
                      <small>
                        {new Date(a.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    )}
                  </div>
                ))}
              </section>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
