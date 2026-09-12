import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Explicitly synthetic testnet KYC fixtures, not verified customer credentials.
// Uses the actual ATS contract API; production onboarding must verify credentials.
const assetId = process.argv[2];
if (!/^0\.0\.\d+$/.test(assetId || '')) throw new Error('Provide an existing ATS testnet contract ID.');
const provider = new JsonRpcProvider(process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api');
if ((await provider.getNetwork()).chainId !== 296n) throw new Error('Testnet only.');
if (!process.env.HEDERA_PRIVATE_KEY) throw new Error('Configure the ignored .env file.');
const signer = new Wallet(process.env.HEDERA_PRIVATE_KEY, provider);
const mirror = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/${assetId}`);
if (!mirror.ok) throw new Error(`Mirror node: ${mirror.status}`);
const assetAddress = (await mirror.json()).evm_address;
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@hashgraph/asset-tokenization-sdk'));
const { SecurityRole } = require(resolve(root, 'domain/context/security/SecurityRole.js'));
const asset = new Contract(assetAddress, [
  'function hasRole(bytes32,address) view returns(bool)', 'function grantRole(bytes32,address)',
  'function isIssuer(address) view returns(bool)', 'function addIssuer(address)',
  'function getKycStatusFor(address) view returns(uint8)',
  'function grantKyc(address,string,uint256,uint256,address)',
  'function isInternalKycActivated() view returns(bool)', 'function totalSupply() view returns(uint256)',
], signer);
if (!(await asset.isInternalKycActivated())) throw new Error('Internal KYC must remain enabled.');
mkdirSync('work', { recursive: true }); mkdirSync('deployments', { recursive: true });
const walletFile = 'work/demo-investor.local.json';
if (!existsSync(walletFile)) {
  const investor = Wallet.createRandom();
  writeFileSync(walletFile, JSON.stringify({ privateKey: investor.privateKey }, null, 2));
}
const investor = new Wallet(JSON.parse(readFileSync(walletFile, 'utf8')).privateKey, provider);
const evidenceFile = `deployments/ats-setup-${assetId}.json`;
const evidence = existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) : {
  network: 'hedera-testnet', assetId, assetAddress, issuer: signer.address, investor: investor.address,
  kyc: 'SYNTHETIC TESTNET FIXTURES ONLY — not identity verification', transactions: [],
};
async function record(label: string, pending: Promise<any>) {
  const tx = await pending;
  evidence.transactions.push({ label, hash: tx.hash, status: 'pending' });
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label} reverted: ${tx.hash}`);
  evidence.transactions.at(-1).status = 'success';
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log(`${label}: ${tx.hash}`);
}
for (const name of ['_ISSUER_ROLE', '_SSI_MANAGER_ROLE', '_KYC_ROLE']) {
  if (!(await asset.hasRole(SecurityRole[name], signer.address))) await record(name, asset.grantRole(SecurityRole[name], signer.address));
}
if (!(await asset.isIssuer(signer.address))) await record('Register demo credential issuer', asset.addIssuer(signer.address));
const targets = [signer.address, investor.address, process.env.VITE_MARKETPLACE_ADDRESS];
if (!targets[2]) throw new Error('Set VITE_MARKETPLACE_ADDRESS to the deployed marketplace.');
for (const target of targets) {
  if (Number(await asset.getKycStatusFor(target)) !== 1) {
    await record(`Synthetic KYC ${target}`, asset.grantKyc(target, `invoicex:testnet:fixture:${target}`, 0, 1_830_297_600, signer.address));
  }
}
console.log(JSON.stringify({ assetId, assetAddress, investor: investor.address, supply: String(await asset.totalSupply()), internalKyc: true }));
