import { useState } from "react";
import { isAddress, type Address } from "viem";
import { delegateInvoice, resolveInvoice, INVOICE_RECORD } from "../chain/ens";
import type { Config } from "../chain/clients";
export function Identity({
  demo,
  config,
  run,
}: {
  demo: boolean;
  config: Config;
  run: (fn: () => Promise<string>) => Promise<void>;
}) {
  const [name, setName] = useState("inv-001.acme.eth"),
    [delegate, setDelegate] = useState(""),
    [record, setRecord] = useState(""),
    [demoGrant, setDemoGrant] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A business identity with boundaries.</h1>
          <p>
            Delegate invoice publication. Keep control of the rest of your
            business.
          </p>
        </div>
      </div>
      <div className="mode-note">
        {demo
          ? "Demo mode · Permissions are simulated"
          : "ENSv2 · Sepolia permissioned resolver"}
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>Invoice namespace</h2>
          <p className="muted">
            Each invoice uses its own name beneath your business. Its published
            commitment binds the asset, issuer, debtor, price and maturity.
          </p>
          <label>
            Invoice ENS subname
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="inv-001.yourbusiness.eth"
            />
          </label>
          <button
            className="button outline"
            onClick={() =>
              run(async () => {
                if (demo) {
                  setRecord("Demo namespace · No onchain lookup performed.");
                  return "Demo namespace inspected.";
                }
                const result = await resolveInvoice(name, config);
                setRecord(JSON.stringify(result, null, 2));
                return result.resolver
                  ? "Live resolver found on Sepolia."
                  : "No resolver found on Sepolia.";
              })
            }
          >
            Look up namespace
          </button>
          {record && <pre className="record-view">{record}</pre>}
        </section>
        <section className="settings-section">
          <h2>Finance officer permissions</h2>
          <p className="muted">
            Grant a wallet access to the invoice record only. The wallet cannot
            change payment addresses or unrelated records through this grant.
          </p>
          <dl className="permission-info">
            <div>
              <dt>Record</dt>
              <dd>
                <code>{INVOICE_RECORD}</code>
              </dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>This invoice name only</dd>
            </div>
          </dl>
          <label>
            Finance officer wallet
            <input
              value={delegate}
              onChange={(e) => setDelegate(e.target.value)}
              placeholder="0x…"
            />
          </label>
          <div className="button-row">
            {[true, false].map((grant) => (
              <button
                key={String(grant)}
                className={`button ${grant ? "primary" : "outline"}`}
                onClick={() =>
                  run(async () => {
                    if (!isAddress(delegate))
                      throw new Error(
                        "Enter a valid finance officer wallet address.",
                      );
                    if (demo) {
                      setDemoGrant(grant);
                      return `Demo permission ${grant ? "granted" : "revoked"}.`;
                    }
                    const hash = await delegateInvoice(
                      name,
                      delegate as Address,
                      grant,
                      config,
                    );
                    return `Permission ${grant ? "granted" : "revoked"} on Sepolia. Receipt: ${hash}`;
                  })
                }
              >
                {grant ? "Grant publication rights" : "Revoke rights"}
              </button>
            ))}
          </div>
          {demo && (
            <p className="form-hint">
              Demo permission: {demoGrant ? "Granted" : "Not granted"}
            </p>
          )}
        </section>
      </div>
      <p className="form-hint">
        Revocation blocks future writes under this grant. It does not erase
        previously published records or block existing repayment rights. Broader
        permissions held by the delegate must be managed separately in ENS.
      </p>
    </>
  );
}
