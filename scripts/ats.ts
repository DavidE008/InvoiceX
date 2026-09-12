import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, id } from 'ethers';

// ATS 8.0 ships CommonJS and extensionless ESM. CommonJS works in Node without a custom loader.
const require = createRequire(import.meta.url);
const sdk = require('@hashgraph/asset-tokenization-sdk');
const root = dirname(require.resolve('@hashgraph/asset-tokenization-sdk'));
const internal = (path: string) => require(resolve(root, path));
const args = process.argv.slice(2), command = args[0];
if (!command || command === 'help') {
  console.log('ATS commands: create <terms.json> | role <asset> <target> <ROLE_NAME> | kyc <asset> <target> <credential.base64.txt> | issue <asset> <issuer> | inspect <asset> | pause <asset> | unpause <asset>');
  process.exit(0);
}
if (!['create', 'role', 'kyc', 'issue', 'inspect', 'pause', 'unpause'].includes(command)) throw new Error('Unknown ATS command. Run npm run ats -- help.');
const key = process.env.HEDERA_PRIVATE_KEY;
if (!key) throw new Error('Configure HEDERA_PRIVATE_KEY in the ignored .env file.');
const provider = new JsonRpcProvider(process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api');
if (Number((await provider.getNetwork()).chainId) !== 296) throw new Error('ATS operations are restricted to Hedera testnet.');
const signer = new Wallet(key, provider);
const accountId = process.env.HEDERA_ACCOUNT_ID;
if (!accountId) throw new Error('Configure HEDERA_ACCOUNT_ID.');
// Follow the upstream RPCTransactionAdapter signer injection pattern used by ATS integration tests.
const Injectable = internal('core/injectable/Injectable.js').default;
const { RPCTransactionAdapter } = internal('port/out/rpc/RPCTransactionAdapter.js');
const NetworkService = internal('app/service/network/NetworkService.js').default;
const { MirrorNodeAdapter } = internal('port/out/mirror/MirrorNodeAdapter.js');
const { RPCQueryAdapter } = internal('port/out/rpc/RPCQueryAdapter.js');
const mirrorNode = { name: 'Hedera testnet', baseUrl: 'https://testnet.mirrornode.hedera.com/api/v1/' };
const rpcNode = { name: 'Hedera testnet RPC', baseUrl: process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api' };
const network = Injectable.resolve(NetworkService);
network.environment = 'testnet'; network.mirrorNode = mirrorNode; network.rpcNode = rpcNode;
network.configuration = { factoryAddress: process.env.ATS_FACTORY_ID || '', resolverAddress: process.env.ATS_RESOLVER_ID || '' };
Injectable.resolve(MirrorNodeAdapter).set(mirrorNode);
Injectable.resolve(RPCQueryAdapter).init();
const adapter = Injectable.resolve(RPCTransactionAdapter);
await adapter.init(true);
adapter.setSignerOrProvider(signer);
Injectable.registerTransactionHandler(adapter);
// Do not pass private keys into SDK request objects or logging transports.
await sdk.Network.connect(new sdk.ConnectRequest({ account: { accountId, evmAddress: signer.address }, network: 'testnet',
  wallet: sdk.SupportedWallets.METAMASK, mirrorNode, rpcNode, debug: true }));
let result;
if (command === 'create') {
  if (!process.env.ATS_FACTORY_ID || !process.env.ATS_RESOLVER_ID) throw new Error('Set the current ATS 8.0 testnet factory and resolver IDs from the official ATS deployment.');
  const input = JSON.parse(readFileSync(args[1], 'utf8'));
  if (!input.isin || !input.configId || !input.maturityDate || !input.faceValue) throw new Error('Terms require name, symbol, isin, faceValue, maturityDate, configId and configVersion.');
  result = await sdk.Bond.create(new sdk.CreateBondRequest({
    name: input.name, symbol: input.symbol, isin: input.isin, decimals: 0, isWhiteList: false,
    erc20VotesActivated: false, isControllable: false, arePartitionsProtected: false, isMultiPartition: false,
    clearingActive: false, internalKycActivated: true, diamondOwnerAccount: accountId,
    currency: '0x555344', numberOfUnits: '1', nominalValue: String(input.faceValue), nominalValueDecimals: 2,
    startingDate: String(Math.floor(Date.now() / 1000)), maturityDate: String(Math.floor(Date.parse(input.maturityDate) / 1000)),
    regulationType: 0, regulationSubType: 0, isCountryControlListWhiteList: false, countries: '',
    info: 'InvoiceX testnet receivable; no legal claim to a real invoice.', configId: input.configId, configVersion: input.configVersion || 1,
  }));
} else if (command === 'role') {
  if (!/^_[A-Z_]+_ROLE$/.test(args[3])) throw new Error('Use an ATS role name, for example _ISSUER_ROLE.');
  result = await sdk.Role.grantRole(new sdk.RoleRequest({ securityId: args[1], targetId: args[2], role: id(args[3]) }));
} else if (command === 'kyc') {
  result = await sdk.Kyc.grantKyc(new sdk.GrantKycRequest({ securityId: args[1], targetId: args[2], vcBase64: readFileSync(args[3], 'utf8').trim() }));
} else if (command === 'issue') {
  result = await sdk.Security.issue(new sdk.IssueRequest({ securityId: args[1], targetId: args[2], amount: '1' }));
} else if (command === 'inspect') {
  result = await sdk.Bond.getBondDetails(new sdk.GetBondDetailsRequest({ bondId: args[1] }));
} else {
  result = await sdk.Security[command](new sdk.PauseRequest({ securityId: args[1] }));
}
// Never save request objects: they can contain credentials. Only public result/receipt data.
mkdirSync('deployments', { recursive: true });
const file = `deployments/ats-${command}-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
console.log(`ATS ${command} result saved to ${file}`);
await sdk.Network.disconnect();
