import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { JsonRpcProvider, Wallet, parseEther } from "ethers";
import {
  createWalletClient,
  http,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
  namehash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { defaultConfig, publicClient } from "../src/chain/clients.js";
import {
  delegateInvoice,
  publishInvoice,
  verifyInvoice,
  resolverAbi,
} from "../src/chain/ens.js";
import { invoiceCommitment, type Invoice } from "../src/domain/invoice.js";

const config = { ...defaultConfig, sepoliaRpc: process.env.SEPOLIA_RPC_URL! };
const provider = new JsonRpcProvider(config.sepoliaRpc);
assert.equal((await provider.getNetwork()).chainId, 11155111n);
const owner = new Wallet(process.env.SEPOLIA_PRIVATE_KEY!, provider);
const officerKey = JSON.parse(
  readFileSync("work/demo-investor.local.json", "utf8"),
).privateKey as Hex;
const officer = new Wallet(officerKey, provider);
const ens = JSON.parse(readFileSync("deployments/ensv2.json", "utf8"));
assert.equal(ens.owner, owner.address);
assert.ok(ens.invoiceName);
const wallet = createWalletClient({
  account: privateKeyToAccount(owner.privateKey as Hex),
  chain: sepolia,
  transport: http(config.sepoliaRpc),
});
const officerWallet = createWalletClient({
  account: privateKeyToAccount(officerKey),
  chain: sepolia,
  transport: http(config.sepoliaRpc),
});
const item: Invoice = {
  id: "connected-demo",
  business: "InvoiceX Demo Business",
  ensName: ens.invoiceName,
  asset: "0x94a777e32bc8dc5d7dcb1f59d1ab08a7b14bacae",
  seller: "0x474a6b1fa5dcfb636ad0fdf7373f323c9d41bd6e",
  debtor: "0x474a6b1fa5dcfb636ad0fdf7373f323c9d41bd6e",
  faceValue: "1000",
  price: "970",
  dueDate: "2026-12-01T00:00:00Z",
  status: "Open",
  activity: [],
};
item.commitment = invoiceCommitment(item);
const file = "deployments/ensv2-permissions.json";
const state = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : {
      name: ens.invoiceName,
      owner: owner.address,
      officer: officer.address,
      invoice: item,
    };
const save = () => writeFileSync(file, JSON.stringify(state, null, 2));
if ((await provider.getBalance(officer.address)) < parseEther("0.001")) {
  const tx = await owner.sendTransaction({
    to: officer.address,
    value: parseEther("0.003"),
  });
  state.fundingHash = tx.hash;
  save();
  assert.equal((await tx.wait())!.status, 1);
}
if (!state.grantHash) {
  state.grantHash = await delegateInvoice(
    item.ensName,
    officer.address as Hex,
    true,
    config,
    wallet,
  );
  save();
}
if (!state.publishHash) {
  state.publishHash = await publishInvoice(item, config, officerWallet);
  save();
}
const verified = await verifyInvoice(item, config);
assert.equal(verified.business, item.business);
state.resolutionVerified = true;
save();
await assert.rejects(
  () => verifyInvoice({ ...item, price: "969" }, config),
  /does not match/,
);
state.tamperedTermsRejected = true;
save();
const client = publicClient(sepolia, config);
const resolver = await client.getEnsResolver({ name: item.ensName });
assert.ok(resolver);
const isRevert = (error: unknown) =>
  error instanceof BaseError &&
  !!error.walk((cause) => cause instanceof ContractFunctionRevertedError);
await assert.rejects(
  () =>
    client.simulateContract({
      address: resolver,
      abi: resolverAbi,
      functionName: "setText",
      args: [namehash(item.ensName), "com.twitter", "unauthorized-test"],
      account: officerWallet.account,
    }),
  isRevert,
);
state.otherRecordRejected = true;
save();
if (!state.revokeHash) {
  state.revokeHash = await delegateInvoice(
    item.ensName,
    officer.address as Hex,
    false,
    config,
    wallet,
  );
  save();
}
await assert.rejects(
  () =>
    publishInvoice(
      { ...item, business: "Unauthorized change" },
      config,
      officerWallet,
    ),
  isRevert,
);
state.revokedPublicationRejected = true;
save();
await verifyInvoice(item, config); // Revocation removes write access; existing economic terms remain readable.
console.log(
  JSON.stringify({
    name: state.name,
    resolutionVerified: true,
    tamperedTermsRejected: true,
    otherRecordRejected: true,
    revokedPublicationRejected: true,
    grantHash: state.grantHash,
    publishHash: state.publishHash,
    revokeHash: state.revokeHash,
  }),
);
