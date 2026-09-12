import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maximumInput,
  executeTreasury,
  quoteTreasury,
  type TreasuryQuote,
} from "../src/chain/uniswap.js";
import { defaultConfig } from "../src/chain/clients.js";

test("exact-output maximum input rounds upward without floating point loss", () => {
  assert.equal(maximumInput(1n, 50), 2n);
  assert.equal(
    maximumInput(1_000_000_000_000_000_000n, 50),
    1_005_000_000_000_000_000n,
  );
  for (const bps of [0, -1, 301, NaN, 1.5])
    assert.throws(() => maximumInput(100n, bps));
});
test("expired and configuration-mismatched quotes fail before connecting a wallet", async () => {
  const quote: TreasuryQuote = {
    tokenOut: "0x1111111111111111111111111111111111111111",
    amountOut: 100n,
    amountIn: 1n,
    maxInput: 2n,
    fee: 3000,
    expiresAt: 0,
    decimals: 6,
    symbol: "TEST",
    rpc: defaultConfig.sepoliaRpc,
  };
  await assert.rejects(() => executeTreasury(quote, defaultConfig), /expired/);
  await assert.rejects(
    () =>
      executeTreasury(
        { ...quote, expiresAt: Date.now() + 60_000 },
        defaultConfig,
      ),
    /Configuration changed/,
  );
  await assert.rejects(
    () => quoteTreasury("100", 50, { ...defaultConfig, outputToken: "" }),
    /valid Sepolia output token/,
  );
});
