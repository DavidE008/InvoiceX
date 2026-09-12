import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { mkdirSync, writeFileSync } from "node:fs";
import { compile } from "./compile.js";

const target = process.argv[2] || "hedera";
if (!["hedera", "sepolia"].includes(target))
  throw new Error("Usage: npm run deploy -- hedera|sepolia");
const hedera = target === "hedera";
const key = process.env[hedera ? "HEDERA_PRIVATE_KEY" : "SEPOLIA_PRIVATE_KEY"];
if (!key)
  throw new Error(
    `Set ${hedera ? "HEDERA_PRIVATE_KEY" : "SEPOLIA_PRIVATE_KEY"} in the ignored .env file. Never commit it.`,
  );
const provider = new JsonRpcProvider(
  process.env[hedera ? "HEDERA_RPC_URL" : "SEPOLIA_RPC_URL"],
);
const chainId = Number((await provider.getNetwork()).chainId);
if (chainId !== (hedera ? 296 : 11155111))
  throw new Error("Refusing to deploy: RPC is not the selected testnet.");
const signer = new Wallet(key, provider);
const { contracts } = compile();
const receipts: Record<string, unknown> = {
  chainId,
  deployer: signer.address,
  deployedAt: new Date().toISOString(),
};
async function deploy(file: string, name: string, args: unknown[] = []) {
  const artifact = contracts[file][name];
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.evm.bytecode.object,
    signer,
  ).deploy(...args);
  const receipt = await contract.deploymentTransaction()!.wait();
  const address = await contract.getAddress();
  receipts[name] = {
    address,
    transactionHash: receipt!.hash,
    constructorArguments: args,
  };
  console.log(`${name}: ${address} (${receipt!.hash})`);
  return address;
}
const payment = await deploy("contracts/TestUSD.sol", "TestUSD");
if (hedera)
  await deploy("contracts/InvoiceMarketplace.sol", "InvoiceMarketplace", [
    payment,
    signer.address,
  ]);
mkdirSync("deployments", { recursive: true });
const path = `deployments/${target}-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(receipts, null, 2));
console.log(
  `Public deployment evidence saved to ${path}. TestUSD is freely mintable and has no monetary value.`,
);
