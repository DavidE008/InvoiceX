import { useState } from "react";
import { formatUnits } from "viem";
import { type Config, explorer } from "../chain/clients";
import {
  executeTreasury,
  quoteTreasury,
  type TreasuryQuote,
} from "../chain/uniswap";
export function Integrations({
  config,
  setConfig,
  demo,
  run,
}: {
  config: Config;
  setConfig: (config: Config) => void;
  demo: boolean;
  run: (fn: () => Promise<string>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(config),
    [amount, setAmount] = useState("0.1"),
    [bps, setBps] = useState("50");
  const [quote, setQuote] = useState<TreasuryQuote | null>(null),
    [receipt, setReceipt] = useState("");
  const fields: [keyof Config, string, string][] = [
    ["market", "Hedera marketplace address", "0x…"],
    ["payment", "Hedera payment token address", "0x…"],
    ["outputToken", "Sepolia treasury output token", "0x…"],
    ["hederaRpc", "Hedera testnet RPC", "https://…"],
    ["sepoliaRpc", "Sepolia RPC", "https://…"],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Three integrations. One working flow.</h1>
          <p>
            Tokenize on Hedera, authorize with ENSv2, and manage treasury swaps
            with Uniswap.
          </p>
        </div>
      </div>
      <div className="mode-note">
        {demo
          ? "Demo workspace · Switch to Testnet workspace to send transactions"
          : "Testnet workspace · Sepolia and Hedera testnet"}
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>Network configuration</h2>
          <p className="muted">
            Public contract addresses and endpoints only. Private keys never
            belong in this form.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                for (const url of [draft.hederaRpc, draft.sepoliaRpc]) {
                  const u = new URL(url);
                  if (
                    u.protocol !== "https:" &&
                    u.hostname !== "127.0.0.1" &&
                    u.hostname !== "localhost"
                  )
                    throw new Error("Use HTTPS for remote RPC endpoints.");
                }
                setConfig(draft);
                setQuote(null);
                return "Configuration saved in this browser.";
              });
            }}
          >
            {fields.map(([key, label, placeholder]) => (
              <label key={key}>
                {label}
                <input
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value.trim() })
                  }
                  placeholder={placeholder}
                  required={key.includes("Rpc")}
                />
              </label>
            ))}
            <button className="button primary">Save configuration</button>
          </form>
          <p className="form-hint">
            Hedera issuer account: 0.0.10505222. Deploy InvoiceMarketplace and
            TestUSD using the repository deployment script, then enter their
            addresses here.
          </p>
        </section>
        <section className="settings-section">
          <h2>Uniswap treasury funding</h2>
          <p className="muted">
            Receive an exact amount of your chosen Sepolia token. InvoiceX finds
            the lowest input quote across four Uniswap v3 fee tiers.
          </p>
          <label>
            Amount to receive
            <input
              type="number"
              min="0.000001"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
            />
          </label>
          <label>
            Maximum slippage
            <select
              value={bps}
              onChange={(e) => {
                setBps(e.target.value);
                setQuote(null);
              }}
            >
              <option value="25">0.25%</option>
              <option value="50">0.50%</option>
              <option value="100">1.00%</option>
            </select>
          </label>
          <button
            className="button outline"
            disabled={demo}
            onClick={() =>
              run(async () => {
                setReceipt("");
                setQuote(null);
                const result = await quoteTreasury(amount, Number(bps), config);
                setQuote(result);
                return "Live Uniswap quote received. Valid for two minutes.";
              })
            }
          >
            Get live quote
          </button>
          {demo && (
            <p className="form-hint">
              Switch to Testnet workspace to request a live quote. No simulated
              swap rates are shown.
            </p>
          )}
          {quote && (
            <div className="quote-result">
              <dl>
                <div>
                  <dt>You receive</dt>
                  <dd>
                    {formatUnits(quote.amountOut, quote.decimals)}{" "}
                    {quote.symbol}
                  </dd>
                </div>
                <div>
                  <dt>Expected input</dt>
                  <dd>{formatUnits(quote.amountIn, 18)} WETH</dd>
                </div>
                <div>
                  <dt>Maximum input</dt>
                  <dd>{formatUnits(quote.maxInput, 18)} WETH</dd>
                </div>
                <div>
                  <dt>Pool fee</dt>
                  <dd>{quote.fee / 10000}%</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{new Date(quote.expiresAt).toLocaleTimeString()}</dd>
                </div>
              </dl>
              <button
                className="button primary full"
                disabled={demo}
                onClick={() =>
                  run(async () => {
                    const hash = await executeTreasury(quote, config);
                    setReceipt(hash);
                    setQuote(null);
                    return "Treasury swap confirmed on Sepolia.";
                  })
                }
              >
                Confirm treasury swap
              </button>
            </div>
          )}
          {receipt && (
            <a
              className="receipt-link"
              href={explorer(receipt, "sepolia")}
              target="_blank"
              rel="noreferrer"
            >
              View confirmed swap
            </a>
          )}
          <p className="form-hint">
            Swaps may wrap ETH and approve a bounded amount of WETH first. Funds
            stay on Sepolia. This does not bridge funds or finance a Hedera
            invoice.
          </p>
          <div className="integration-links">
            <h3>Implementation resources</h3>
            <a
              href="https://github.com/hashgraph/asset-tokenization-studio"
              target="_blank"
              rel="noreferrer"
            >
              Hedera Asset Tokenization Studio
            </a>
            <a
              href="https://docs.ens.domains/ensv2/permissioned-resolver/"
              target="_blank"
              rel="noreferrer"
            >
              ENSv2 permissioned resolver
            </a>
            <a
              href="https://github.com/DavidE008/InvoiceX/blob/main/FEEDBACK.md"
              target="_blank"
              rel="noreferrer"
            >
              Uniswap developer feedback
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
