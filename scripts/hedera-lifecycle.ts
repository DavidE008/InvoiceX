import assert from "node:assert/strict";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  parseEther,
  type TransactionRequest,
} from "ethers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { compile } from "./compile.js";
import { invoiceCommitment } from "../src/domain/invoice.js";

// Hedera-only integration test against an actual ATS asset. Does NOT prove ENS publication.
const setup = JSON.parse(
  readFileSync("deployments/ats-setup-0.0.10506298.json", "utf8"),
);
const provider = new JsonRpcProvider(
  process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
);
if ((await provider.getNetwork()).chainId !== 296n)
  throw new Error("Testnet only.");
class BufferedWallet extends Wallet {
  async estimateGas(tx: TransactionRequest) {
    return ((await super.estimateGas(tx)) * 13n) / 10n;
  }
}
const seller = new BufferedWallet(process.env.HEDERA_PRIVATE_KEY!, provider);
const investor = new BufferedWallet(
  JSON.parse(readFileSync("work/demo-investor.local.json", "utf8")).privateKey,
  provider,
);
assert.equal(seller.address, setup.issuer);
assert.equal(investor.address, setup.investor);
const contracts = compile().contracts;
const market = new Contract(
  process.env.VITE_MARKETPLACE_ADDRESS!,
  contracts["contracts/InvoiceMarketplace.sol"].InvoiceMarketplace.abi,
  seller,
);
const usd = new Contract(
  process.env.VITE_PAYMENT_TOKEN_ADDRESS!,
  contracts["contracts/TestUSD.sol"].TestUSD.abi,
  seller,
);
const asset = new Contract(
  setup.assetAddress,
  [
    "function approve(address,uint256) returns(bool)",
    "function balanceOf(address) view returns(uint256)",
    "function revokeKyc(address)",
    "function grantKyc(address,string,uint256,uint256,address)",
    "function getKycStatusFor(address) view returns(uint8)",
    "function totalSupply() view returns(uint256)",
  ],
  seller,
);
const file = "deployments/hedera-lifecycle.json";
const evidence = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : {
      network: "hedera-testnet",
      asset: setup.assetAddress,
      marketplace: await market.getAddress(),
      seller: seller.address,
      investor: investor.address,
      ensPublished: false,
      scope:
        "Hedera-only synthetic receivable lifecycle, not an ENS integration proof",
      transactions: [],
    };
for (const tx of evidence.transactions) {
  if (tx.status !== "pending" && tx.status !== "unknown") continue;
  const receipt = await provider.getTransactionReceipt(tx.hash);
  if (!receipt)
    throw new Error(`Reconcile pending receipt before proceeding: ${tx.hash}`);
  tx.status = receipt.status === 1 ? "success" : "reverted";
}
async function record(label: string, pending: Promise<any>) {
  const tx = await pending;
  evidence.transactions.push({ label, hash: tx.hash, status: "pending" });
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  let receipt;
  try {
    receipt = await tx.wait();
  } catch (error) {
    evidence.transactions.at(-1).status =
      (error as any).receipt?.status === 0 ? "reverted" : "unknown";
    writeFileSync(file, JSON.stringify(evidence, null, 2));
    throw error;
  }
  assert.equal(receipt.status, 1);
  evidence.transactions.at(-1).status = "success";
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(`${label}: ${tx.hash}`);
}
assert.equal(await asset.totalSupply(), 1n, "Issue the ATS unit first");
if ((await provider.getBalance(investor.address)) < parseEther("2"))
  await record(
    "Fund test investor with 5 test HBAR",
    seller.sendTransaction({ to: investor.address, value: parseEther("5") }),
  );
const marketAddress = await market.getAddress();
if (!evidence.invoiceId) {
  if (await market.usedAsset(setup.assetAddress))
    throw new Error(
      "Asset already listed; reconcile invoice ID before retrying.",
    );
  await record(
    "Approve actual ATS provenance",
    market.approveAsset(setup.assetAddress, seller.address),
  );
  await record("Approve one ATS unit", asset.approve(marketAddress, 1));
  const item = {
    asset: setup.assetAddress,
    seller: seller.address,
    debtor: seller.address,
    ensName: "inv-001.unpublished-invoicex.eth",
    faceValue: "10000",
    price: "9700",
    dueDate: "2026-11-11T00:00:00Z",
  };
  await record(
    "List Hedera-only fixture",
    market.list(
      item.asset,
      item.debtor,
      10_000_000_000n,
      9_700_000_000n,
      Math.floor(Date.parse(item.dueDate) / 1000),
      invoiceCommitment(item),
      item.ensName,
    ),
  );
  evidence.invoiceId = String(await market.invoiceCount());
  writeFileSync(file, JSON.stringify(evidence, null, 2));
}
const invoiceId = BigInt(evidence.invoiceId);
if (Number((await market.invoices(invoiceId)).status) === 1) {
  if ((await usd.balanceOf(investor.address)) < 9_700_000_000n)
    await record(
      "Mint test USD to investor",
      usd.mint(investor.address, 9_700_000_000n),
    );
  await record(
    "Investor payment approval",
    (usd.connect(investor) as any).approve(marketAddress, 9_700_000_000n),
  );
  if (Number(await asset.getKycStatusFor(investor.address)) === 1)
    await record("Revoke test investor KYC", asset.revokeKyc(investor.address));
  const before = await usd.balanceOf(investor.address);
  await assert.rejects(() =>
    (market.connect(investor) as any).finance.staticCall(invoiceId),
  );
  assert.equal(await usd.balanceOf(investor.address), before);
  assert.equal(Number((await market.invoices(invoiceId)).status), 1);
  evidence.nonKycFinanceSimulationRejected = true;
  await record(
    "Restore synthetic test investor KYC",
    asset.grantKyc(
      investor.address,
      "invoicex:testnet:fixture:investor",
      0,
      1_830_297_600,
      seller.address,
    ),
  );
  await record(
    "Finance with atomic ATS delivery",
    (market.connect(investor) as any).finance(invoiceId),
  );
  assert.equal(await asset.balanceOf(investor.address), 1n);
}
if (Number((await market.invoices(invoiceId)).status) === 2) {
  if ((await usd.balanceOf(seller.address)) < 10_000_000_000n)
    await record(
      "Mint debtor test USD",
      usd.mint(seller.address, 10_000_000_000n),
    );
  await record(
    "Approve face-value repayment",
    usd.approve(marketAddress, 10_000_000_000n),
  );
  await record("Repay invoice", market.repay(invoiceId));
}
if (Number((await market.invoices(invoiceId)).status) === 3) {
  await record(
    "Approve ATS redemption",
    (asset.connect(investor) as any).approve(marketAddress, 1),
  );
  await record(
    "Claim repayment as ATS holder",
    (market.connect(investor) as any).claim(invoiceId),
  );
}
assert.equal(Number((await market.invoices(invoiceId)).status), 4);
assert.equal(await asset.balanceOf(marketAddress), 1n);
assert.equal(await usd.balanceOf(investor.address), 10_000_000_000n);
evidence.finalStatus = "Settled";
evidence.investorPaymentBalance = String(await usd.balanceOf(investor.address));
writeFileSync(file, JSON.stringify(evidence, null, 2));
console.log(
  "Verified: real ATS issuance, KYC rejection, atomic financing, repayment and holder redemption.",
);
