import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { hederaTestnet, sepolia } from "viem/chains";
export { hederaTestnet, sepolia };
export type ChainWallet = import("viem").WalletClient<
  import("viem").Transport,
  Chain,
  import("viem").Account
>;
export interface Config {
  market: string;
  payment: string;
  outputToken: string;
  sepoliaRpc: string;
  hederaRpc: string;
}
const env = import.meta.env ?? {};
export const defaultConfig: Config = {
  market:
    env.VITE_MARKETPLACE_ADDRESS ||
    "0x975B3eE7B0085d1FC3Ef286D5e95B25101D0f364",
  payment:
    env.VITE_PAYMENT_TOKEN_ADDRESS ||
    "0x783b71AFBBfC814081E53bE19003b9400Fdd4EDb",
  outputToken:
    env.VITE_UNISWAP_OUTPUT_TOKEN ||
    "0x768f42455a2d082e23ceef7d51e5787c82d67a39",
  sepoliaRpc:
    env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  hederaRpc: env.VITE_HEDERA_RPC_URL || "https://testnet.hashio.io/api",
};
export function publicClient(chain: Chain, config: Config) {
  return createPublicClient({
    chain,
    transport: http(chain.id === 296 ? config.hederaRpc : config.sepoliaRpc, {
      timeout: 20_000,
      retryCount: 1,
    }),
  });
}
declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
export async function walletFor(chain: Chain) {
  if (!window.ethereum)
    throw new Error(
      "Install or open an Ethereum-compatible wallet to use testnet transactions.",
    );
  const wallet = createWalletClient({ transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("No wallet account was selected.");
  try {
    await wallet.switchChain({ id: chain.id });
  } catch (error) {
    if (
      (error as { code?: number }).code !== 4902 &&
      !(error as Error).message?.includes("4902")
    )
      throw error;
    await wallet.addChain({ chain });
    await wallet.switchChain({ id: chain.id });
  }
  return createWalletClient({
    account,
    chain,
    transport: custom(window.ethereum),
  });
}
export async function confirmed(hash: Hex, chain: Chain, config: Config) {
  const receipt = await publicClient(chain, config).waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  if (receipt.status !== "success")
    throw new Error(`Transaction reverted: ${hash}`);
  return hash;
}
export function explorer(hash: string, chain: "hedera" | "sepolia") {
  return chain === "hedera"
    ? `https://hashscan.io/testnet/transaction/${hash}`
    : `https://sepolia.etherscan.io/tx/${hash}`;
}
export async function requireCode(
  address: Address,
  chain: Chain,
  config: Config,
) {
  const code = await publicClient(chain, config).getCode({ address });
  if (!code || code === "0x")
    throw new Error(`No contract at ${address} on ${chain.name}.`);
}
