import test from "tape";
import {
  generateEVMDeepLink,
  generateSolanaDeepLink,
  generateStellarDeepLink,
} from "../src/format";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const DEST = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMK";

test("native and token deposit deeplinks use distinct transfer formats", (t) => {
  const evmAddress = "0x0000000000000000000000000000000000000001";
  t.equal(
    generateEVMDeepLink({
      tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      chainId: 8453,
      recipientAddress: evmAddress,
      amountUnits: "125000000000000000",
    }),
    `ethereum:${evmAddress}@8453?value=125000000000000000`,
    "native ETH uses value transfer to recipient",
  );
  t.equal(
    generateEVMDeepLink({
      tokenAddress: evmAddress,
      chainId: 8453,
      recipientAddress: evmAddress,
      amountUnits: "10",
    }),
    `ethereum:${evmAddress}@8453/transfer?address=${evmAddress}&uint256=10`,
    "ERC20 keeps contract transfer URI",
  );
  const solAddress = "11111111111111111111111111111111";
  t.equal(
    generateSolanaDeepLink({
      amountUnits: "0.125",
      recipientAddress: solAddress,
      tokenAddress: solAddress,
    }),
    `solana:${solAddress}?amount=0.125`,
    "native SOL does not advertise an SPL mint",
  );
  t.equal(
    generateSolanaDeepLink({
      amountUnits: "1",
      recipientAddress: solAddress,
      tokenAddress: "So11111111111111111111111111111111111111112",
    }),
    `solana:${solAddress}?amount=1&spl-token=So11111111111111111111111111111111111111112`,
    "WSOL retains SPL mint",
  );
  t.end();
});

test("Stellar deeplink uses CODE:ISSUER form with MEMO_TEXT", (t) => {
  t.equal(
    generateStellarDeepLink({
      destination: DEST,
      amount: "10.5",
      tokenAddress: `USDC:${ISSUER}`,
      tokenSymbol: "USDC",
      memo: "12345",
    }),
    `web+stellar:pay?destination=${DEST}&amount=10.5&asset_code=USDC&asset_issuer=${ISSUER}&memo=12345&memo_type=MEMO_TEXT`,
  );
  t.end();
});

test("Stellar deeplink handles bare-issuer token and text memos", (t) => {
  t.equal(
    generateStellarDeepLink({
      destination: DEST,
      amount: "1",
      tokenAddress: ISSUER,
      tokenSymbol: "USDC",
      memo: "order-7",
    }),
    `web+stellar:pay?destination=${DEST}&amount=1&asset_code=USDC&asset_issuer=${ISSUER}&memo=order-7&memo_type=MEMO_TEXT`,
  );
  t.end();
});

test("Stellar deeplink omits asset fields for native XLM", (t) => {
  t.equal(
    generateStellarDeepLink({
      destination: DEST,
      tokenAddress: "11111111111111111111111111111111",
      tokenSymbol: "XLM",
    }),
    `web+stellar:pay?destination=${DEST}`,
  );
  t.end();
});

test("Stellar deeplink handles EURC CODE:ISSUER form", (t) => {
  const eurcIssuer = "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";
  t.equal(
    generateStellarDeepLink({
      destination: DEST,
      amount: "9.25",
      tokenAddress: `EURC:${eurcIssuer}`,
      tokenSymbol: "EURC",
      memo: "invoice-42",
    }),
    `web+stellar:pay?destination=${DEST}&amount=9.25&asset_code=EURC&asset_issuer=${eurcIssuer}&memo=invoice-42&memo_type=MEMO_TEXT`,
  );
  t.end();
});
