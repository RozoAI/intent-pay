import test from "tape";
import { rozoStellar, solana } from "../src/chain";
import {
  getKnownToken,
  isNativeToken,
  rozoStellarUSDT0,
  solanaSOL,
  solanaUSDT,
  solanaWSOL,
  stellarXLM,
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
  t.equal(
    getKnownToken(rozoStellar.chainId, rozoStellarUSDT0.token)?.symbol,
    "USDT0",
    "Stellar USDT0 resolves by CODE:ISSUER address",
  );
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
