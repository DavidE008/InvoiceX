import { parseAbi, namehash, toHex, type Address, type Hex } from "viem";
import { normalize, packetToBytes } from "viem/ens";
import {
  publicClient,
  walletFor,
  confirmed,
  sepolia,
  type Config,
  type ChainWallet,
} from "./clients";
import { invoiceCommitment, type Invoice } from "../domain/invoice";
export const INVOICE_RECORD = "org.invoicex.invoice";
export const resolverAbi = parseAbi([
  "function authorizeTextRoles(bytes toName, string key, address account, bool grant)",
  "function setText(bytes32 node, string key, string value)",
]);
export async function resolveInvoice(name: string, config: Config) {
  const normalized = normalize(name);
  const client = publicClient(sepolia, config);
  const [resolver, record] = await Promise.all([
    client.getEnsResolver({ name: normalized }),
    client.getEnsText({ name: normalized, key: INVOICE_RECORD }),
  ]);
  return { name: normalized, resolver, record };
}
export async function delegateInvoice(
  name: string,
  delegate: Address,
  grant: boolean,
  config: Config,
  suppliedWallet?: ChainWallet,
): Promise<Hex> {
  const client = publicClient(sepolia, config);
  const normalized = normalize(name);
  // Always discover the current resolver; never cache a proxy from a prior write.
  const address = await client.getEnsResolver({ name: normalized });
  if (!address)
    throw new Error(
      "This name has no resolver on Sepolia. Configure its ENSv2 parent first.",
    );
  const wallet = suppliedWallet || (await walletFor(sepolia));
  if ((await wallet.getChainId()) !== sepolia.id)
    throw new Error("ENS wallet must use Sepolia.");
  const { request } = await client.simulateContract({
    address,
    abi: resolverAbi,
    functionName: "authorizeTextRoles",
    args: [toHex(packetToBytes(normalized)), INVOICE_RECORD, delegate, grant],
    account: wallet.account,
  });
  return confirmed(await wallet.writeContract(request), sepolia, config);
}
export async function publishInvoice(
  item: Invoice,
  config: Config,
  suppliedWallet?: ChainWallet,
): Promise<Hex> {
  const client = publicClient(sepolia, config);
  const name = normalize(item.ensName);
  const address = await client.getEnsResolver({ name });
  if (!address)
    throw new Error(
      "Configure an ENSv2 parent resolver for this invoice namespace first.",
    );
  const wallet = suppliedWallet || (await walletFor(sepolia));
  if ((await wallet.getChainId()) !== sepolia.id)
    throw new Error("ENS wallet must use Sepolia.");
  const value = JSON.stringify({
    version: 1,
    commitment: invoiceCommitment(item),
    business: item.business,
  });
  const { request } = await client.simulateContract({
    address,
    abi: resolverAbi,
    functionName: "setText",
    args: [namehash(name), INVOICE_RECORD, value],
    account: wallet.account,
  });
  return confirmed(await wallet.writeContract(request), sepolia, config);
}
export async function verifyInvoice(item: Invoice, config: Config) {
  const result = await resolveInvoice(item.ensName, config);
  if (!result.record)
    throw new Error("Invoice publication is missing from ENSv2.");
  let record: { commitment: string; business?: string };
  try {
    record = JSON.parse(result.record);
  } catch {
    throw new Error("ENS invoice record is not valid JSON.");
  }
  const expected = invoiceCommitment(item);
  if (
    record.commitment !== expected ||
    (item.commitment && item.commitment !== expected)
  )
    throw new Error("ENS publication does not match the invoice terms.");
  return { ...result, business: record.business || item.business };
}
