import test from "tape";
import { rozoSolana, rozoStellar, solana } from "../src/chain";
import {
  getKnownSourceToken,
  getKnownToken,
  isNativeToken,
  rozoStellarUSDT0,
  solanaSOL,
  solanaUSDT,
  solanaWSOL,
  stellarXLM,
  supportedPayoutTokens,
  supportedTokens,
} from "../src/token";

test("finds Solana USDT by its native chain ID", (t) => {
  t.equal(solanaUSDT.chainId, solana.chainId, "Solana USDT belongs to Solana");
  t.equal(
    getKnownToken(solana.chainId, solanaUSDT.token)?.fiatISO,
    "USD",
    "Solana USDT resolves with its fiat currency",
  );
  t.end();
});

test("finds Stellar USDT0 by its Rozo Stellar chain ID", (t) => {
  t.equal(rozoStellarUSDT0.chainId, rozoStellar.chainId, "USDT0 belongs to Rozo Stellar");
  t.ok(supportedTokens.get(rozoStellar.chainId)?.includes(rozoStellarUSDT0), "USDT0 is available for pay-in");
  t.ok(supportedPayoutTokens.get(rozoStellar.chainId)?.includes(rozoStellarUSDT0), "USDT0 is available for payout");
  t.equal(
    getKnownToken(rozoStellar.chainId, rozoStellarUSDT0.token)?.symbol,
    "USDT0",
    "Stellar USDT0 resolves by CODE:ISSUER address",
  );
  t.end();
});

test("keeps native SOL/XLM out of supportedTokens but resolvable as sources", (t) => {
  t.notOk(
    supportedTokens.get(solana.chainId)?.includes(solanaSOL),
    "SOL is not a supported (pay-in/payout) token",
  );
  t.notOk(
    supportedTokens.get(rozoSolana.chainId)?.includes(solanaSOL),
    "SOL is not in the Rozo Solana supported set",
  );
  t.notOk(
    supportedTokens.get(rozoStellar.chainId)?.includes(stellarXLM),
    "XLM is not in the Rozo Stellar supported set",
  );
  t.equal(
    getKnownToken(solana.chainId, solanaSOL.token),
    undefined,
    "native SOL is not resolvable via getKnownToken (destination path)",
  );
  t.equal(getKnownSourceToken(solana.chainId, "native")?.symbol, "SOL", "native alias resolves as SOL source");
  t.equal(
    getKnownSourceToken(rozoSolana.chainId, "11111111111111111111111111111112")?.symbol,
    "SOL",
    "legacy SOL alias resolves as native source",
  );
  t.equal(getKnownSourceToken(rozoStellar.chainId, "XLM")?.symbol, "XLM", "XLM resolves as native source");
  t.end();
});

test("models native SOL and XLM with their transfer units", (t) => {
  t.ok(isNativeToken(solanaSOL.token), "System Program sentinel is native SOL");
  t.notOk(
    isNativeToken("11111111111111111111111111111112"),
    "legacy proxy alias requires adapter normalization",
  );
  t.notOk(isNativeToken(solanaWSOL.token), "WSOL mint is never a native transfer");
  t.ok(isNativeToken(stellarXLM.token), "XLM sentinel is native");
  t.equal(stellarXLM.decimals, 7, "XLM uses stroops");
  t.end();
});
