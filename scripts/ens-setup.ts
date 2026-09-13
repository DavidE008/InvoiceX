import {
  Contract,
  JsonRpcProvider,
  Wallet,
  Interface,
  ZeroAddress,
  ZeroHash,
  randomBytes,
  hexlify,
  id,
  AbiCoder,
} from "ethers";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { namehash } from "viem";

// Official ENSv2 Sepolia deployments, pinned to the revision linked by ENS docs.
const revision = "97a57293f3b4279d94b571e678edb53ce62638f4";
async function artifact(name: string) {
  const response = await fetch(
    `https://raw.githubusercontent.com/ensdomains/contracts-v2/${revision}/contracts/deployments/sepolia/${name}.json`,
  );
  if (!response.ok) throw new Error(`ENS artifact unavailable: ${name}`);
  return response.json();
}
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
if ((await provider.getNetwork()).chainId !== 11155111n)
  throw new Error("Sepolia only.");
if (!process.env.SEPOLIA_PRIVATE_KEY)
  throw new Error("Configure SEPOLIA_PRIVATE_KEY locally.");
const owner = new Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
const [factoryData, registrarData, usdcData] = await Promise.all(
  ["VerifiableFactory", "ETHRegistrar", "MockUSDC"].map(artifact),
);
const factory = new Contract(factoryData.address, factoryData.abi, owner);
const registrar = new Contract(registrarData.address, registrarData.abi, owner);
const usdc = new Contract(usdcData.address, usdcData.abi, owner);
mkdirSync("work", { recursive: true });
mkdirSync("deployments", { recursive: true });
const stateFile = "deployments/ensv2.json",
  secretFile = "work/ens-registration.local.json";
const state = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile, "utf8"))
  : {
      network: "sepolia",
      owner: owner.address,
      label: "invoicex-2026",
      revision,
      transactions: [],
    };
if (state.owner !== owner.address)
  throw new Error("Configured wallet differs from the saved ENS owner.");
if (!existsSync(secretFile))
  writeFileSync(
    secretFile,
    JSON.stringify({ secret: hexlify(randomBytes(32)) }),
  );
const { secret } = JSON.parse(readFileSync(secretFile, "utf8"));
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
for (const entry of state.transactions) {
  if (entry.status !== "pending") continue;
  const receipt = await provider.getTransactionReceipt(entry.hash);
  if (!receipt) throw new Error(`Receipt still pending: ${entry.hash}`);
  entry.status = receipt.status === 1 ? "success" : "reverted";
  save();
}
async function record(label: string, pending: Promise<any>) {
  const tx = await pending;
  state.transactions.push({ label, hash: tx.hash, status: "pending" });
  save();
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label} reverted`);
  state.transactions.at(-1).status = "success";
  save();
  console.log(`${label}: ${tx.hash}`);
  return receipt;
}
const allRoles = BigInt("0x" + "1".repeat(64)),
  duration = 31_536_000;
if (
  !state.registered &&
  !state.commitment &&
  !(await registrar.isAvailable(state.label))
)
  throw new Error(
    "Project name is unavailable; choose another label before deployment.",
  );
for (const [field, implementation, init, params, saltName] of [
  [
    "resolver",
    "0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e",
    "function initialize(address,uint256,bytes[])",
    [owner.address, allRoles, []],
    "OwnedResolver",
  ],
  [
    "registry",
    "0x624a25d67b59d587752ebec8dded8827dae52050",
    "function initialize(address,uint256)",
    [owner.address, allRoles],
    "UserRegistry",
  ],
] as const) {
  if (state[field]) continue;
  const salt = BigInt(
    id(`InvoiceX:${saltName}:${owner.address}:${state.label}:v1`),
  );
  const receipt = await record(
    `Deploy ENSv2 ${field}`,
    factory.deployProxy(
      implementation,
      salt,
      new Interface([init]).encodeFunctionData("initialize", params),
    ),
  );
  const event = receipt.logs
    .map((log: any) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log: any) => log?.name === "ProxyDeployed");
  if (!event)
    throw new Error(
      "Missing proxy deployment event; reconcile receipt before retrying.",
    );
  state[field] = event.args.proxyAddress;
  save();
}
const args = [
  state.label,
  owner.address,
  secret,
  state.registry,
  state.resolver,
  duration,
  ZeroHash,
];
if (!state.commitment) {
  const commitment = await registrar.makeCommitment(...args);
  const receipt = await record(
    "Commit project name",
    registrar.commit(commitment),
  );
  state.commitment = commitment;
  state.committedAt = (await provider.getBlock(receipt.blockNumber))!.timestamp;
  save();
}
if (!state.registered) {
  const age =
    (await provider.getBlock("latest"))!.timestamp - state.committedAt;
  const minAge = Number(await registrar.MIN_COMMITMENT_AGE());
  if (age < minAge) {
    console.log(
      `Commitment saved. Rerun in ${minAge - age + 1} seconds to register ${state.label}.eth.`,
    );
  } else {
    const [base, premium] = await registrar.getRegisterPrice(
      state.label,
      duration,
      usdcData.address,
    );
    if ((await usdc.balanceOf(owner.address)) < base + premium)
      await record(
        "Mint free ENS test USDC",
        usdc.mint(owner.address, base + premium),
      );
    await record(
      "Approve test registration payment",
      usdc.approve(registrarData.address, base + premium),
    );
    await record(
      "Register project ENSv2 name",
      registrar.register(...args.slice(0, 6), usdcData.address, ZeroHash),
    );
    state.registered = true;
    state.name = `${state.label}.eth`;
    save();
  }
}
if (state.registered && !state.invoiceName) {
  const registry = new Contract(
    state.registry,
    [
      "function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns(uint256)",
    ],
    owner,
  );
  await record(
    "Register invoice subname",
    registry.register(
      "inv-001",
      owner.address,
      ZeroAddress,
      state.resolver,
      0,
      Math.floor(Date.now() / 1000) + 30_000_000,
    ),
  );
  state.invoiceName = `inv-001.${state.name}`;
  save();
  const resolver = new Contract(
    state.resolver,
    ["function setAddr(bytes32,address)"],
    owner,
  );
  await record(
    "Set business wallet record",
    resolver.setAddr(namehash(state.name), owner.address),
  );
}
console.log(
  JSON.stringify({
    name: state.name,
    invoiceName: state.invoiceName,
    resolver: state.resolver,
    registry: state.registry,
    registered: !!state.registered,
  }),
);
