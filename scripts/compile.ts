import solc from "solc";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function compile() {
  const paths = [
    "contracts/InvoiceMarketplace.sol",
    "contracts/TestUSD.sol",
    "contracts/test/ComplianceAsset.sol",
  ];
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      paths.map((path) => [path, { content: readFileSync(path, "utf8") }]),
    ),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "metadata"] },
      },
    },
  };
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import: (path: string) => {
        try {
          const contents = readFileSync(resolve("node_modules", path), "utf8");
          input.sources[path] = { content: contents };
          return { contents };
        } catch {
          return { error: `Missing import: ${path}` };
        }
      },
    }),
  );
  const errors = output.errors?.filter(
    (e: { severity: string }) => e.severity === "error",
  );
  if (errors?.length)
    throw new Error(
      errors
        .map((e: { formattedMessage: string }) => e.formattedMessage)
        .join("\n"),
    );
  return { input, contracts: output.contracts };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = compile();
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/solc-input.json",
    JSON.stringify(result.input, null, 2),
  );
  for (const file of Object.values(result.contracts) as Record<
    string,
    unknown
  >[]) {
    for (const [name, artifact] of Object.entries(file))
      writeFileSync(
        `artifacts/${name}.json`,
        JSON.stringify(artifact, null, 2),
      );
  }
  console.log(
    "Compiled marketplace, test currency and test doubles with Solidity 0.8.30 (Paris EVM).",
  );
}
