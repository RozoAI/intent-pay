import test from "tape";
import { createPaymentBridgeConfig, PaymentBridgeConfig } from "../src/bridge-utils";
import { base, bsc, polygon, rozoSolana, rozoStellar } from "../src/chain";
import {
  baseUSDC,
  polygonUSDC,
  rozoSolanaUSDC,
  rozoStellarUSDC,
  rozoStellarUSDT0,
  solanaSOL,
  stellarXLM,
} from "../src/token";

// Valid addresses for testing
const VALID_EVM_ADDRESS = "0x1a5FdBc891c5D4E6aD68064Ae45D43146D4F9f3a";
const VALID_SOLANA_ADDRESS = "E35325pbtxCRsA4uVoC3cyBDZy8BMpmxvsvGcHNUa18k";
const VALID_STELLAR_ADDRESS = "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY";

test("createPaymentBridgeConfig - native deposit sources reach the fee request builder", (t) => {
  const sources = [
    { chain: base.chainId, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH" },
    { chain: bsc.chainId, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "BNB" },
    {
      chain: polygon.chainId,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      symbol: "POL",
    },
    { chain: rozoSolana.chainId, address: solanaSOL.token, symbol: "SOL" },
    { chain: rozoStellar.chainId, address: "XLM", symbol: "XLM" },
    { chain: rozoStellar.chainId, address: stellarXLM.token, symbol: "XLM" },
  ];
  for (const source of sources) {
    const config = createPaymentBridgeConfig({
      toChain: base.chainId,
      toToken: baseUSDC.token,
      toAddress: VALID_EVM_ADDRESS,
      toUnits: "1",
      preferredChain: source.chain,
      preferredTokenAddress: source.address,
    });
    t.equal(
      config.preferred.preferredToken,
      source.symbol,
      `${source.symbol} source is recognized`,
    );
  }
  t.end();
});

test("createPaymentBridgeConfig - Cross-chain payment (Polygon USDC to Base USDC)", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1", // 1 USDC
    preferredChain: polygon.chainId,
    preferredTokenAddress: polygonUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(
    result.preferred.preferredChain,
    String(polygon.chainId),
    "Preferred chain should be Polygon",
  );
  t.equal(result.preferred.preferredToken, "USDC", "Preferred token should be USDC");
  t.equal(
    result.preferred.preferredTokenAddress,
    polygonUSDC.token,
    "Preferred token address should match Polygon USDC",
  );

  t.equal(result.destination.chainId, String(base.chainId), "Destination chain should be Base");
  t.equal(result.destination.tokenSymbol, "USDC", "Destination token symbol should be USDC");
  t.equal(
    result.destination.tokenAddress,
    baseUSDC.token,
    "Destination token address should match Base USDC",
  );
  t.equal(
    result.destination.destinationAddress,
    VALID_EVM_ADDRESS,
    "Destination address should match",
  );
  t.equal(result.destination.amountUnits, "1", "Amount units should match");

  t.equal(result.isIntentPayment, true, "Should be an intent payment (different chains)");

  t.end();
});

test("createPaymentBridgeConfig - Same-chain payment (Base USDC to Base USDC)", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.preferred.preferredChain, String(base.chainId), "Preferred chain should be Base");
  t.equal(result.preferred.preferredToken, "USDC", "Preferred token should be USDC");

  t.equal(result.destination.chainId, String(base.chainId), "Destination chain should be Base");

  t.equal(result.isIntentPayment, false, "Should not be an intent payment (same chain and token)");

  t.end();
});

test("createPaymentBridgeConfig - EVM token casing does not create intent", (t) => {
  for (const toToken of [
    baseUSDC.token.toLowerCase(),
    baseUSDC.token.toUpperCase().replace("0X", "0x"),
    baseUSDC.token,
  ]) {
    const result = createPaymentBridgeConfig({
      toChain: base.chainId,
      toToken,
      toAddress: VALID_EVM_ADDRESS,
      toUnits: "1",
      preferredChain: base.chainId,
      preferredTokenAddress: baseUSDC.token,
    });

    t.equal(result.isIntentPayment, false, "same EVM token should not require intent");
    t.equal(result.destination.tokenAddress, toToken, "destination preserves input casing");
  }
  t.end();
});

test("createPaymentBridgeConfig - Payment to Stellar destination", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: rozoStellar.chainId,
    toToken: rozoStellarUSDC.token,
    toAddress: VALID_STELLAR_ADDRESS,
    toUnits: "1", // 1 USDC
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.preferred.preferredChain, String(base.chainId), "Preferred chain should be Base");
  t.equal(result.preferred.preferredToken, "USDC", "Preferred token should be USDC");

  // Destination should be configured for Stellar
  t.equal(
    result.destination.chainId,
    String(rozoStellarUSDC.chainId),
    "Destination chain should be Stellar",
  );
  t.equal(
    result.destination.tokenSymbol,
    rozoStellarUSDC.symbol,
    "Destination token symbol should be Stellar USDC",
  );
  t.equal(
    result.destination.tokenAddress,
    rozoStellarUSDC.token,
    "Destination token address should match Stellar USDC",
  );
  t.equal(
    result.destination.destinationAddress,
    VALID_STELLAR_ADDRESS,
    "Destination address should match Stellar address",
  );

  t.equal(result.isIntentPayment, true, "Should be an intent payment (Base to Stellar)");

  t.end();
});

test("createPaymentBridgeConfig - Stellar USDT0 payout retains requested asset", (t) => {
  const result = createPaymentBridgeConfig({
    toChain: rozoStellar.chainId,
    toToken: rozoStellarUSDT0.token,
    toAddress: VALID_STELLAR_ADDRESS,
    toUnits: "1",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  });

  t.equal(result.destination.tokenSymbol, "USDT0");
  t.equal(result.destination.tokenAddress, rozoStellarUSDT0.token);
  t.end();
});

test("createPaymentBridgeConfig - Stellar USDT0 pay-in to USDC payout needs intent", (t) => {
  const result = createPaymentBridgeConfig({
    toChain: rozoStellar.chainId,
    toToken: rozoStellarUSDC.token,
    toAddress: VALID_STELLAR_ADDRESS,
    toUnits: "1",
    preferredChain: rozoStellar.chainId,
    preferredTokenAddress: rozoStellarUSDT0.token,
  });

  t.equal(result.preferred.preferredToken, "USDT0");
  t.equal(result.preferred.preferredTokenAddress, rozoStellarUSDT0.token);
  t.equal(result.destination.tokenAddress, rozoStellarUSDC.token);
  t.equal(result.isIntentPayment, true, "same-chain token swap requires intent");
  t.end();
});

test("createPaymentBridgeConfig - Payment to Solana destination", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: rozoSolana.chainId,
    toToken: rozoSolanaUSDC.token,
    toAddress: VALID_SOLANA_ADDRESS,
    toUnits: "1", // 1 USDC
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.preferred.preferredChain, String(base.chainId), "Preferred chain should be Base");
  t.equal(result.preferred.preferredToken, "USDC", "Preferred token should be USDC");

  // Destination should be configured for Solana
  t.equal(
    result.destination.chainId,
    String(rozoSolanaUSDC.chainId),
    "Destination chain should be Solana",
  );
  t.equal(
    result.destination.tokenSymbol,
    rozoSolanaUSDC.symbol,
    "Destination token symbol should be Solana USDC",
  );
  t.equal(
    result.destination.tokenAddress,
    rozoSolanaUSDC.token,
    "Destination token address should match Solana USDC",
  );
  t.equal(
    result.destination.destinationAddress,
    VALID_SOLANA_ADDRESS,
    "Destination address should match Solana address",
  );

  t.equal(result.isIntentPayment, true, "Should be an intent payment (Base to Solana)");

  t.end();
});

// test("createPaymentBridgeConfig - Error: Unsupported token", (t) => {
//   const config: PaymentBridgeConfig = {
//     toChain: base.chainId,
//     toToken: "0x0000000000000000000000000000000000000000", // Invalid token
//     toAddress: VALID_EVM_ADDRESS,
//     toUnits: "1",
//     preferredChain: base.chainId,
//     preferredTokenAddress: baseUSDC.token,
//   };

//   t.throws(
//     () => createPaymentBridgeConfig(config),
//     /(Unsupported token|or token)/,
//     "Should throw error for unsupported token"
//   );

//   t.end();
// });

test("createPaymentBridgeConfig - Error: Invalid address for chain", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: "invalid-address",
    toUnits: "1",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  t.throws(
    () => createPaymentBridgeConfig(config),
    (err: any) => {
      // viem's getAddress throws InvalidAddressError when address is invalid
      // The error will be thrown from validateAddressForChain before the bridge function can catch it
      return (
        err.name === "InvalidAddressError" ||
        err.message?.includes("Address") ||
        err.message?.includes("invalid")
      );
    },
    "Should throw error for invalid address",
  );

  t.end();
});

test("createPaymentBridgeConfig - native deposit sources preserve their chain and address", (t) => {
  for (const [chainId, address, expectedChain, symbol] of [
    [8453, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", 8453, "ETH"],
    [501, "11111111111111111111111111111111", 900, "SOL"],
    [1500, "XLM", 1500, "XLM"],
  ] as const) {
    const config = createPaymentBridgeConfig({
      toChain: base.chainId,
      toToken: baseUSDC.token,
      toAddress: VALID_EVM_ADDRESS,
      toUnits: "5",
      preferredChain: chainId,
      preferredTokenAddress: address,
    });
    t.equal(config.preferred.preferredChain, String(expectedChain), `${symbol} source chain`);
    t.equal(config.preferred.preferredToken, symbol, `${symbol} source symbol`);
    t.equal(config.preferred.preferredTokenAddress, address, `${symbol} source address`);
  }
  t.end();
});

test("createPaymentBridgeConfig - Error: Unsupported preferred token", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1",
    preferredChain: polygon.chainId,
    preferredTokenAddress: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // Truly invalid token address
  };

  t.throws(
    () => createPaymentBridgeConfig(config),
    /Unknown token/,
    "Should throw error for unsupported preferred token",
  );

  t.end();
});

test("createPaymentBridgeConfig - Error: Unsupported chain or token", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: 99999, // Unsupported chain
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  t.throws(
    () => createPaymentBridgeConfig(config),
    /Unknown chainId/,
    "Should throw error for unsupported chain",
  );

  t.end();
});

test("createPaymentBridgeConfig - Intent payment detection: different chain, same token", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1",
    preferredChain: polygon.chainId,
    preferredTokenAddress: polygonUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.isIntentPayment, true, "Should be intent payment when chains differ");

  t.end();
});

test("createPaymentBridgeConfig - Intent payment detection: same chain and token", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(
    result.isIntentPayment,
    false,
    "Should not be intent payment when same chain and token"
  );

  t.end();
});

test("createPaymentBridgeConfig - Large amount units", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "1000000", // 1 million USDC
    preferredChain: polygon.chainId,
    preferredTokenAddress: polygonUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.destination.amountUnits, "1000000", "Should handle large amount units correctly");

  t.end();
});

test("createPaymentBridgeConfig - Zero amount units", (t) => {
  const config: PaymentBridgeConfig = {
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "0",
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
  };

  const result = createPaymentBridgeConfig(config);

  t.equal(result.destination.amountUnits, "0", "Should handle zero amount units correctly");

  t.end();
});
