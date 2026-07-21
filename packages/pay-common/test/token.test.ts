import test from "tape";
import {
  arbitrum,
  base,
  bsc,
  ethereum,
  polygon,
  rozoSolana,
  rozoStellar,
} from "../src/chain";
import {
  arbitrumETH,
  baseETH,
  bscBNB,
  ethereumETH,
  polygonPOL,
  solanaSOL,
  stellarXLM,
  supportedTokens,
} from "../src/token";

test("supportedTokens includes native ETH for arbitrum, base, ethereum", (t) => {
  t.ok(
    supportedTokens.get(arbitrum.chainId)?.includes(arbitrumETH),
    "arbitrum supportedTokens includes arbitrumETH"
  );
  t.ok(
    supportedTokens.get(base.chainId)?.includes(baseETH),
    "base supportedTokens includes baseETH"
  );
  t.ok(
    supportedTokens.get(ethereum.chainId)?.includes(ethereumETH),
    "ethereum supportedTokens includes ethereumETH"
  );
  t.end();
});

test("supportedTokens includes native BNB for bsc", (t) => {
  t.ok(
    supportedTokens.get(bsc.chainId)?.includes(bscBNB),
    "bsc supportedTokens includes bscBNB"
  );
  t.end();
});

test("supportedTokens includes native POL for polygon", (t) => {
  t.ok(
    supportedTokens.get(polygon.chainId)?.includes(polygonPOL),
    "polygon supportedTokens includes polygonPOL"
  );
  t.end();
});

test("supportedTokens includes native SOL for rozoSolana", (t) => {
  t.ok(
    supportedTokens.get(rozoSolana.chainId)?.includes(solanaSOL),
    "rozoSolana supportedTokens includes solanaSOL"
  );
  t.end();
});

test("supportedTokens includes native XLM for rozoStellar", (t) => {
  t.ok(
    supportedTokens.get(rozoStellar.chainId)?.includes(stellarXLM),
    "rozoStellar supportedTokens includes stellarXLM"
  );
  t.end();
});
