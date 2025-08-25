import {
  assert,
  assertNotNull,
  debugJson,
  DepositAddressPaymentOptionData,
  DepositAddressPaymentOptionMetadata,
  DepositAddressPaymentOptions,
  ethereum,
  ExternalPaymentOptionMetadata,
  ExternalPaymentOptions,
  getOrderDestChainId,
  isCCTPV1Chain,
  PlatformType,
  readRozoPayOrderID,
  RozoPayHydratedOrderWithOrg,
  WalletPaymentOption,
  writeRozoPayOrderID,
} from "@rozoai/intent-common";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, getAddress, Hex, hexToBytes, zeroAddress } from "viem";
import {
  useAccount,
  useEnsName,
  useSendTransaction,
  useWriteContract,
} from "wagmi";

import { ALBEDO_ID } from "@creit.tech/stellar-wallets-kit";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Asset,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import bs58 from "bs58";
import { PayButtonPaymentProps } from "../components/DaimoPayButton";
import { ROUTES } from "../constants/routes";
import {
  STELLAR_USDC_ASSET_CODE,
  STELLAR_USDC_ISSUER_PK,
} from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { useStellar } from "../provider/StellarContextProvider";
import { detectPlatform } from "../utils/platform";
import { TrpcClient } from "../utils/trpc";
import { WalletConfigProps } from "../wallets/walletConfigs";
import { useRozoPay } from "./useDaimoPay";
import { useDepositAddressOptions } from "./useDepositAddressOptions";
import { useExternalPaymentOptions } from "./useExternalPaymentOptions";
import useIsMobile from "./useIsMobile";
import { useOrderUsdLimits } from "./useOrderUsdLimits";
import { useSolanaPaymentOptions } from "./useSolanaPaymentOptions";
import { useStellarDestination } from "./useStellarDestination";
import { useStellarPaymentOptions } from "./useStellarPaymentOptions";
import { useWalletPaymentOptions } from "./useWalletPaymentOptions";

/** Wallet payment details, sent to processSourcePayment after submitting tx. */
export type SourcePayment = Parameters<
  TrpcClient["processSourcePayment"]["mutate"]
>[0];

/** Creates (or loads) a payment and manages the corresponding modal. */
export interface PaymentState {
  generatePreviewOrder: () => void;
  resetOrder: (payParams?: Partial<PayParams>) => Promise<void>;

  /// RozoPayButton props
  buttonProps: PayButtonPaymentProps | undefined;
  setButtonProps: (props: PayButtonPaymentProps | undefined) => void;

  /// Pay ID for loading an existing order
  setPayId: (id: string | undefined) => void;
  /// Pay params for creating an order on the fly,
  setPayParams: (payParams: PayParams | undefined) => Promise<void>;
  payParams: PayParams | undefined;

  /// True if the user is entering an amount (deposit) vs preset (checkout).
  isDepositFlow: boolean;
  paymentWaitingMessage: string | undefined;
  /// External payment options, loaded from server and filtered by EITHER
  /// 1. the RozoPayButton paymentOptions, or 2. those of rozoPayOrder
  externalPaymentOptions: ReturnType<typeof useExternalPaymentOptions>;
  selectedWallet: WalletConfigProps | undefined;
  selectedWalletDeepLink: string | undefined;
  showSolanaPaymentMethod: boolean;
  showStellarPaymentMethod: boolean;
  walletPaymentOptions: ReturnType<typeof useWalletPaymentOptions>;
  solanaPaymentOptions: ReturnType<typeof useSolanaPaymentOptions>;
  stellarPaymentOptions: ReturnType<typeof useStellarPaymentOptions>;
  depositAddressOptions: ReturnType<typeof useDepositAddressOptions>;
  selectedExternalOption: ExternalPaymentOptionMetadata | undefined;
  selectedTokenOption: WalletPaymentOption | undefined;
  selectedSolanaTokenOption: WalletPaymentOption | undefined;
  selectedStellarTokenOption: WalletPaymentOption | undefined;
  selectedDepositAddressOption: DepositAddressPaymentOptionMetadata | undefined;
  getOrderUsdLimit: () => number;
  setPaymentWaitingMessage: (message: string | undefined) => void;
  tokenMode: "evm" | "solana" | "stellar" | "all";
  setTokenMode: (mode: "evm" | "solana" | "stellar" | "all") => void;
  setSelectedWallet: (wallet: WalletConfigProps | undefined) => void;
  setSelectedWalletDeepLink: (deepLink: string | undefined) => void;
  setSelectedExternalOption: (
    option: ExternalPaymentOptionMetadata | undefined
  ) => void;
  setSelectedTokenOption: (option: WalletPaymentOption | undefined) => void;
  setSelectedSolanaTokenOption: (
    option: WalletPaymentOption | undefined
  ) => void;
  setSelectedStellarTokenOption: (
    option: WalletPaymentOption | undefined
  ) => void;
  setSelectedDepositAddressOption: (
    option: DepositAddressPaymentOptionMetadata | undefined
  ) => void;
  setChosenUsd: (usd: number) => void;
  payWithToken: (
    walletOption: WalletPaymentOption
  ) => Promise<{ txHash: Hex; success: boolean }>;
  payWithExternal: (option: ExternalPaymentOptions) => Promise<string>;
  payWithDepositAddress: (
    option: DepositAddressPaymentOptions
  ) => Promise<DepositAddressPaymentOptionData | null>;
  payWithSolanaToken: (
    walletPaymentOption: WalletPaymentOption
  ) => Promise<{ txHash: string; success: boolean }>;
  payWithSolanaTokenRozo: (
    walletPaymentOption: WalletPaymentOption,
    rozoPayment: {
      tokenAddress: string;
      destAddress: string;
      usdcAmount: string;
      solanaAmount: string;
      memo?: string;
    }
  ) => Promise<{ txHash: string; success: boolean }>;
  payWithStellarToken: (
    option: WalletPaymentOption,
    rozoPayment: {
      destAddress: string;
      usdcAmount: string;
      stellarAmount: string;
      memo?: string;
    }
  ) => Promise<{ signedTx: string; success: boolean }>;
  openInWalletBrowser: (wallet: WalletConfigProps, amountUsd?: number) => void;
  senderEnsName: string | undefined;
  setTxHash: (txHash: string) => void;
  txHash: string | undefined;
  setRozoPaymentId: (paymentId: string) => void;
  rozoPaymentId: string | undefined;
}

export function usePaymentState({
  trpc,
  lockPayParams,
  setRoute,
  log,
  redirectReturnUrl,
}: {
  trpc: TrpcClient;
  lockPayParams: boolean;
  setRoute: (route: ROUTES, data?: Record<string, any>) => void;
  log: (...args: any[]) => void;
  redirectReturnUrl?: string;
}): PaymentState {
  const pay = useRozoPay();

  // Browser state.
  const [platform, setPlatform] = useState<PlatformType>();
  useEffect(() => {
    setPlatform(detectPlatform(window.navigator.userAgent));
  }, []);

  // Wallet state.
  const { address: ethWalletAddress } = useAccount();
  const { data: senderEnsName } = useEnsName({
    chainId: ethereum.chainId,
    address: ethWalletAddress,
  });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // Solana wallet state.
  const solanaWallet = useWallet();
  const { connection } = useConnection();
  const solanaPubKey = solanaWallet.publicKey?.toBase58();

  // Stellar wallet state.
  const {
    publicKey: stellarPublicKey,
    account: stellarAccount,
    kit: stellarKit,
    connector: stellarConnector,
    server: stellarServer,
    convertXlmToUsdc,
  } = useStellar();
  const stellarPubKey = stellarPublicKey;

  // TODO: backend should determine whether to show solana payment method
  const paymentOptions = pay.order?.metadata.payer?.paymentOptions;
  // Include by default if paymentOptions not provided. Solana bridging is only
  // supported on CCTP v1 chains.
  const showSolanaPaymentMethod = useMemo(() => {
    return (
      (paymentOptions == null ||
        paymentOptions.includes(ExternalPaymentOptions.Solana)) &&
      pay.order != null &&
      isCCTPV1Chain(getOrderDestChainId(pay.order))
    );
  }, [paymentOptions, pay.order]);

  // From RozoPayButton props
  const [buttonProps, setButtonProps] = useState<PayButtonPaymentProps>();
  const [currPayParams, setCurrPayParams] = useState<PayParams>();

  const [paymentWaitingMessage, setPaymentWaitingMessage] = useState<string>();
  const [isDepositFlow, setIsDepositFlow] = useState<boolean>(false);

  // Use our custom hook to determine if this is a Stellar payment and its direction
  const { isStellarPayment } = useStellarDestination(currPayParams);

  const showStellarPaymentMethod = useMemo(() => {
    return (
      (paymentOptions == null ||
        paymentOptions.includes(ExternalPaymentOptions.Stellar)) &&
      pay.order != null &&
      isStellarPayment
    );
  }, [paymentOptions, pay.order, isStellarPayment]);

  // UI state. Selection for external payment (Binance, etc) vs wallet payment.
  const externalPaymentOptions = useExternalPaymentOptions({
    trpc,
    // allow <RozoPayButton payId={...} paymentOptions={override} />
    filterIds:
      buttonProps?.paymentOptions ?? pay.order?.metadata.payer?.paymentOptions,
    platform,
    usdRequired: pay.order?.destFinalCallTokenAmount.usd,
    mode: pay.order?.mode,
  });
  const walletPaymentOptions = useWalletPaymentOptions({
    trpc,
    address: ethWalletAddress,
    usdRequired: pay.order?.destFinalCallTokenAmount.usd,
    destChainId: pay.order?.destFinalCallTokenAmount.token.chainId,
    preferredChains: pay.order?.metadata.payer?.preferredChains,
    preferredTokens: pay.order?.metadata.payer?.preferredTokens,
    evmChains: pay.order?.metadata.payer?.evmChains,
    isDepositFlow,
    log,
  });
  const solanaPaymentOptions = useSolanaPaymentOptions({
    trpc,
    address: solanaPubKey,
    usdRequired: pay.order?.destFinalCallTokenAmount.usd,
    isDepositFlow,
  });
  const stellarPaymentOptions = useStellarPaymentOptions({
    address: stellarPubKey,
    usdRequired: pay.order?.destFinalCallTokenAmount.usd,
    isDepositFlow,
  });
  const depositAddressOptions = useDepositAddressOptions({
    trpc,
    usdRequired: pay.order?.destFinalCallTokenAmount.usd,
    mode: pay.order?.mode,
  });

  const chainOrderUsdLimits = useOrderUsdLimits({ trpc });

  const [selectedExternalOption, setSelectedExternalOption] =
    useState<ExternalPaymentOptionMetadata>();

  const [selectedTokenOption, setSelectedTokenOption] =
    useState<WalletPaymentOption>();

  const [selectedSolanaTokenOption, setSelectedSolanaTokenOption] =
    useState<WalletPaymentOption>();

  const [selectedStellarTokenOption, setSelectedStellarTokenOption] =
    useState<WalletPaymentOption>();

  const [selectedDepositAddressOption, setSelectedDepositAddressOption] =
    useState<DepositAddressPaymentOptionMetadata>();

  const [selectedWallet, setSelectedWallet] = useState<WalletConfigProps>();
  const [selectedWalletDeepLink, setSelectedWalletDeepLink] =
    useState<string>();

  const getOrderUsdLimit = () => {
    const DEFAULT_USD_LIMIT = 20000;
    if (pay.order == null || chainOrderUsdLimits.loading) {
      return DEFAULT_USD_LIMIT;
    }
    const destChainId = pay.order.destFinalCallTokenAmount.token.chainId;
    return destChainId in chainOrderUsdLimits.limits
      ? chainOrderUsdLimits.limits[destChainId]
      : DEFAULT_USD_LIMIT;
  };

  /** Commit to a token + amount = initiate payment. */
  const payWithToken = async (
    walletOption: WalletPaymentOption
  ): Promise<{ txHash: Hex; success: boolean }> => {
    assert(
      ethWalletAddress != null,
      `[PAY TOKEN] null ethWalletAddress when paying on ethereum`
    );
    assert(
      pay.paymentState === "preview" ||
        pay.paymentState === "unhydrated" ||
        pay.paymentState === "payment_unpaid",
      `[PAY TOKEN] paymentState is ${pay.paymentState}, must be preview or unhydrated or payment_unpaid`
    );

    let hydratedOrder: RozoPayHydratedOrderWithOrg;
    const { required, fees } = walletOption;
    const paymentAmount = BigInt(required.amount) + BigInt(fees.amount);
    if (pay.paymentState !== "payment_unpaid") {
      assert(
        required.token.token === fees.token.token,
        `[PAY TOKEN] required token ${debugJson(
          required
        )} does not match fees token ${debugJson(fees)}`
      );

      // Will refund to ethWalletAddress if refundAddress was not set in payParams
      // and provide walletOption to hydrateOrder
      const res = await pay.hydrateOrder(ethWalletAddress, walletOption);
      hydratedOrder = res.order;

      log(
        `[PAY TOKEN] hydrated order: ${debugJson(
          hydratedOrder
        )}, paying ${paymentAmount} of token ${required.token.token}`
      );
    } else {
      hydratedOrder = pay.order;
    }

    const paymentTxHash = await (async () => {
      try {
        console.log("[PAY TOKEN] sending token", {
          required,
          hydratedOrder,
          paymentAmount,
        });

        if (required.token.token === zeroAddress) {
          return await sendTransactionAsync({
            to: hydratedOrder.destFinalCall.to,
            value: paymentAmount,
          });
        } else {
          return await writeContractAsync({
            abi: erc20Abi,
            address: getAddress(required.token.token),
            functionName: "transfer",
            args: [hydratedOrder.destFinalCall.to, paymentAmount],
          });
        }
      } catch (e) {
        console.error(`[PAY TOKEN] error sending token: ${e}`);
        throw e;
      }
    })();

    try {
      //   await pay.payEthSource({
      //     paymentTxHash,
      //     sourceChainId: required.token.chainId,
      //     payerAddress: ethWalletAddress as `0x${string}`,
      //     sourceToken: getAddress(required.token.token),
      //     sourceAmount: paymentAmount,
      //   });
      setTxHash(paymentTxHash);
      return { txHash: paymentTxHash, success: true };
    } catch {
      console.error(
        `[PAY TOKEN] could not verify payment tx on chain: ${paymentTxHash}`
      );
      return { txHash: paymentTxHash, success: false };
    }
  };

  // @NOTE: This is Pay In Solana by Daimo (default)
  const payWithSolanaToken = async (
    walletPaymentOption: WalletPaymentOption
  ): Promise<{ txHash: string; success: boolean }> => {
    const inputToken = walletPaymentOption.required.token.token;
    const payerPublicKey = solanaWallet.publicKey;
    assert(
      payerPublicKey != null,
      "[PAY SOLANA] null payerPublicKey when paying on solana"
    );
    assert(
      pay.order?.id != null,
      "[PAY SOLANA] null orderId when paying on solana"
    );
    assert(
      pay.paymentState === "preview" ||
        pay.paymentState === "unhydrated" ||
        pay.paymentState === "payment_unpaid",
      `[PAY SOLANA] paymentState is ${pay.paymentState}, must be preview or unhydrated or payment_unpaid`
    );

    let hydratedOrder: RozoPayHydratedOrderWithOrg;
    if (pay.paymentState !== "payment_unpaid") {
      const res = await pay.hydrateOrder(
        // @TODO: Revalidate this
        undefined, // refundAddress
        walletPaymentOption
      );
      hydratedOrder = res.order;

      log(
        `[PAY SOLANA] Hydrated order: ${JSON.stringify(
          hydratedOrder
        )}, checking out with Solana ${inputToken}`
      );
    } else {
      hydratedOrder = pay.order;
    }

    const paymentTxHash = await (async () => {
      try {
        const serializedTx = await trpc.getSolanaSwapAndBurnTx.query({
          orderId: pay.order.id.toString(),
          userPublicKey: assertNotNull(
            payerPublicKey,
            "[PAY SOLANA] wallet.publicKey cannot be null"
          ).toString(),
          inputTokenMint: inputToken,
        });
        const tx = VersionedTransaction.deserialize(hexToBytes(serializedTx));
        const txHash = await solanaWallet.sendTransaction(tx, connection);
        return txHash;
      } catch (e) {
        throw e;
      }
    })();

    try {
      await pay.paySolanaSource({
        paymentTxHash: paymentTxHash,
        sourceToken: inputToken,
      });
      return { txHash: paymentTxHash, success: true };
    } catch {
      console.error(
        `[PAY SOLANA] could not verify payment tx on chain: ${paymentTxHash}`
      );
      return { txHash: paymentTxHash, success: false };
    }
  };

  // @NOTE: This is Pay In Solana by Rozo
  const payWithSolanaTokenRozo = async (
    walletPaymentOption: WalletPaymentOption,
    rozoPayment: {
      tokenAddress: string;
      destAddress: string;
      usdcAmount: string;
      solanaAmount: string;
      memo?: string;
    }
  ): Promise<{ txHash: string; success: boolean }> => {
    try {
      const payerPublicKey = solanaWallet.publicKey;

      // Initial validation
      if (!payerPublicKey) {
        throw new Error("Solana Public key is null");
      }

      if (!pay.order?.id) {
        throw new Error("Order ID is null");
      }

      if (!connection || !solanaWallet) {
        throw new Error("Solana services not initialized");
      }

      console.log("[PAY SOLANA] Starting Solana payment transaction", {
        pay,
        rozoPayment,
      });

      console.log("[PAY SOLANA] Setting up transaction...");

      const newConnection = new Connection(
        "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      console.log("[PAY SOLANA] Connected to Solana mainnet");

      const instructions: TransactionInstruction[] = [];

      // Set up token addresses
      const mintAddress = new PublicKey(rozoPayment.tokenAddress ?? "");
      const fromKey = new PublicKey(payerPublicKey);
      const toKey = new PublicKey(rozoPayment.destAddress);

      console.log("[PAY SOLANA] Transaction details:", {
        tokenMint: mintAddress.toString(),
        fromKey: fromKey.toString(),
        toKey: toKey.toString(),
        amount: rozoPayment.solanaAmount,
        memo: rozoPayment.memo,
      });

      // Get token accounts for sender and recipient
      console.log("[PAY SOLANA] Deriving associated token accounts...");
      const senderTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        fromKey
      );
      const recipientTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        toKey
      );
      console.log(
        "[PAY SOLANA] Sender token account:",
        senderTokenAccount.toString()
      );
      console.log(
        "[PAY SOLANA] Recipient token account:",
        recipientTokenAccount.toString()
      );

      // Check if recipient token account exists
      console.log("[PAY SOLANA] Checking if recipient token account exists...");
      const recipientTokenInfo = await connection.getAccountInfo(
        recipientTokenAccount
      );

      // Create recipient token account if it doesn't exist
      if (!recipientTokenInfo) {
        console.log("[PAY SOLANA] Creating recipient token account...");
        instructions.push(
          createAssociatedTokenAccountInstruction(
            payerPublicKey,
            recipientTokenAccount,
            toKey,
            mintAddress,
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Add transfer instruction
      console.log("[PAY SOLANA] Adding transfer instruction...");
      const transferAmount = parseFloat(rozoPayment.solanaAmount) * 1_000_000;
      console.log(
        "[PAY SOLANA] Transfer amount (with decimals):",
        transferAmount
      );

      instructions.push(
        createTransferCheckedInstruction(
          senderTokenAccount,
          mintAddress,
          recipientTokenAccount,
          fromKey,
          transferAmount,
          6
        )
      );

      // Add memo if provided
      if (rozoPayment.memo) {
        console.log("[PAY SOLANA] Adding memo instruction:", rozoPayment.memo);
        instructions.push(
          new TransactionInstruction({
            keys: [
              { pubkey: payerPublicKey, isSigner: true, isWritable: true },
            ],
            programId: new PublicKey(
              "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
            ),
            data: Buffer.from(rozoPayment.memo, "utf-8"),
          })
        );
      }

      // Create and partially sign transaction
      console.log("[PAY SOLANA] Building transaction...");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      console.log("[PAY SOLANA] Got blockhash:", blockhash);

      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = payerPublicKey;
      instructions.forEach((instruction) => transaction.add(instruction));

      // Serialize the transaction
      console.log("[PAY SOLANA] Serializing transaction...");
      const serializedTransaction = bs58.encode(
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
      );

      console.log("[PAY SOLANA] Sending transaction to wallet for signing...");
      const tx = Transaction.from(bs58.decode(serializedTransaction));
      const txHash = await solanaWallet.sendTransaction(tx, connection);
      console.log("[PAY SOLANA] Transaction sent! Hash:", txHash);
      return { txHash: txHash, success: true };
    } catch (error) {
      console.error(error);
      return { txHash: "", success: false };
    }
  };

  // Stellar payment
  /**
   * Execute a payment using Stellar token
   * @param payToken - The token amount to pay
   * @returns Transaction hash and success status
   */
  const payWithStellarToken = async (
    walletPaymentOption: WalletPaymentOption,
    rozoPayment: {
      destAddress: string;
      usdcAmount: string;
      stellarAmount: string;
      memo?: string;
    }
  ): Promise<{ signedTx: string; success: boolean }> => {
    try {
      // Initial validation
      if (!stellarPublicKey) {
        throw new Error("Stellar Public key is null");
      }

      if (!stellarAccount) {
        throw new Error("Stellar Account is null");
      }

      if (!stellarServer || !stellarKit) {
        throw new Error("Stellar services not initialized");
      }

      const token = walletPaymentOption.required.token;

      const destinationAddress = rozoPayment.destAddress;
      // const amount = rozoPayment.amount;

      // Setup Stellar payment
      await stellarKit.setWallet(String(stellarConnector?.id ?? ALBEDO_ID));
      const sourceAccount = await stellarServer.loadAccount(stellarPublicKey);
      const destAsset = new Asset(
        STELLAR_USDC_ASSET_CODE,
        STELLAR_USDC_ISSUER_PK
      );
      const fee = String(await stellarServer.fetchBaseFee());

      // Build transaction based on token type
      let transaction: TransactionBuilder;
      const isXlmToken = token.symbol === "XLM";

      if (isXlmToken) {
        // const estimatedDestMinAmount = await convertXlmToUsdc(amount);
        transaction = new TransactionBuilder(sourceAccount, {
          fee,
          networkPassphrase: Networks.PUBLIC,
        })
          .addOperation(
            Operation.pathPaymentStrictSend({
              sendAsset: Asset.native(),
              sendAmount: String(rozoPayment.stellarAmount),
              destination: destinationAddress,
              destAsset,
              destMin: rozoPayment.usdcAmount,
              path: [],
            })
          )
          .setTimeout(180);
      } else {
        // For other tokens, use direct payment
        transaction = new TransactionBuilder(sourceAccount, {
          fee,
          networkPassphrase: Networks.PUBLIC,
        })
          .addOperation(
            Operation.payment({
              destination: destinationAddress,
              asset: destAsset,
              amount: String(rozoPayment.usdcAmount),
            })
          )
          .setTimeout(180);
      }

      if (rozoPayment.memo) {
        transaction.addMemo(Memo.text(String(rozoPayment.memo)));
      }

      const transactionBuilder = transaction.build();

      console.log(
        "[PAY STELLAR] Transaction built",
        transactionBuilder.toXDR()
      );
      return { signedTx: transactionBuilder.toXDR(), success: true };

      // const submittedTx = await stellarServer.submitTransaction(tx);

      // if (!submittedTx?.successful) {
      //   throw new Error(
      //     `Transaction failed: ${submittedTx?.result_xdr ?? "Unknown error"}`
      //   );
      // }

      // return { txHash: submittedTx?.hash ?? "", success: true };
    } catch (error: any) {
      console.log("[PAY STELLAR] Error", error);
      throw new Error(error.message);
    }
  };

  const payWithExternal = async (option: ExternalPaymentOptions) => {
    assert(pay.order != null, "[PAY EXTERNAL] order cannot be null");
    assert(platform != null, "[PAY EXTERNAL] platform cannot be null");

    const { order } = await pay.hydrateOrder();
    const externalPaymentOptionData =
      await trpc.getExternalPaymentOptionData.query({
        id: order.id.toString(),
        externalPaymentOption: option,
        platform,
        redirectReturnUrl,
      });
    assert(
      externalPaymentOptionData != null,
      "[PAY EXTERNAL] missing externalPaymentOptionData"
    );

    log(
      `[PAY EXTERNAL] hydrated order: ${debugJson(
        order
      )}, checking out with external payment: ${option}`
    );

    setPaymentWaitingMessage(externalPaymentOptionData.waitingMessage);

    return externalPaymentOptionData.url;
  };

  const payWithDepositAddress = async (
    option: DepositAddressPaymentOptions
  ) => {
    const { order } = await pay.hydrateOrder();

    log(
      `[PAY DEPOSIT ADDRESS] hydrated order ${order.id} for ${order.usdValue} USD, checking out with deposit address: ${option}`
    );

    const result = await trpc.getDepositAddressForOrder.query({
      orderId: order.id.toString(),
      option,
    });

    return "error" in result ? null : result;
  };

  const { isIOS } = useIsMobile();

  const openInWalletBrowser = (
    wallet: WalletConfigProps,
    amountUsd?: number
  ) => {
    const paymentState = pay.paymentState;
    assert(
      paymentState === "payment_unpaid",
      `[OPEN IN WALLET BROWSER] paymentState is ${paymentState}, must be payment_unpaid`
    );
    assert(
      wallet.getRozoPayDeeplink != null,
      `openInWalletBrowser: missing deeplink for ${wallet.name}`
    );

    const payId = writeRozoPayOrderID(pay.order.id);

    let ref: string | undefined = undefined;

    // Refer to: https://stackoverflow.com/a/78637988/13172178
    if (wallet.name === "Phantom") {
      ref = isIOS ? "1598432977" : "app.phantom";
    }

    const deeplink = wallet.getRozoPayDeeplink(payId, ref);
    // If we are in IOS, we don't open the deeplink in a new window, because it
    // will not work, the link will be opened in the page WAITING_WALLET
    if (!isIOS) {
      window.open(deeplink, "_blank");
    }
    setSelectedWallet(wallet);
    setSelectedWalletDeepLink(deeplink);
    setRoute(ROUTES.WAITING_WALLET, {
      amountUsd,
      payId,
      wallet_name: wallet.name,
    });
  };

  /** User picked a different deposit amount. */
  const setChosenUsd = (usd: number) => {
    assert(
      pay.paymentState === "preview",
      "[SET CHOSEN USD] paymentState is not preview"
    );

    // Too expensive to make an API call to regenerate preview order each time
    // the user changes the amount. Instead, we modify the order in memory.
    pay.setChosenUsd(usd);
  };

  const setPayId = useCallback(
    async (payId: string | undefined) => {
      if (lockPayParams || payId == null) return;
      const id = readRozoPayOrderID(payId).toString();

      if (pay.order?.id && BigInt(id) == pay.order.id) {
        // Already loaded, ignore.
        return;
      }

      pay.reset();
      pay.setPayId(payId);
    },
    [lockPayParams, pay]
  );

  /** Called whenever params change. */
  const setPayParams = async (payParams: PayParams | undefined) => {
    if (lockPayParams) return;
    assert(payParams != null, "[SET PAY PARAMS] payParams cannot be null");

    log("[SET PAY PARAMS] setting payParams", payParams);
    pay.reset();
    await pay.createPreviewOrder(payParams);
    setCurrPayParams(payParams);
    setIsDepositFlow(payParams.toUnits == null);
  };

  const generatePreviewOrder = async () => {
    pay.reset();
    if (currPayParams == null) return;
    await pay.createPreviewOrder(currPayParams);
  };

  const resetOrder = useCallback(
    async (payParams?: Partial<PayParams>) => {
      const mergedPayParams: PayParams | undefined =
        payParams != null && currPayParams != null
          ? { ...currPayParams, ...payParams }
          : currPayParams;

      // Clear the old order & state
      pay.reset();
      setSelectedExternalOption(undefined);
      setSelectedTokenOption(undefined);
      setSelectedSolanaTokenOption(undefined);
      setSelectedStellarTokenOption(undefined);
      setSelectedDepositAddressOption(undefined);
      setSelectedWallet(undefined);
      setSelectedWalletDeepLink(undefined);
      setPaymentWaitingMessage(undefined);

      // Set the new payParams
      if (mergedPayParams) {
        await pay.createPreviewOrder(mergedPayParams);
        setCurrPayParams(mergedPayParams);
        setIsDepositFlow(mergedPayParams.toUnits == null);
      }

      setRoute(ROUTES.SELECT_METHOD);
    },
    [setRoute, pay, currPayParams]
  );

  const [tokenMode, setTokenMode] = useState<
    "evm" | "solana" | "stellar" | "all"
  >("evm");

  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [rozoPaymentId, setRozoPaymentId] = useState<string | undefined>(
    undefined
  );

  return {
    buttonProps,
    setButtonProps,
    setPayId,
    setPayParams,
    payParams: currPayParams,
    tokenMode,
    setTokenMode,
    generatePreviewOrder,
    isDepositFlow,
    paymentWaitingMessage,
    selectedExternalOption,
    selectedTokenOption,
    selectedSolanaTokenOption,
    selectedStellarTokenOption,
    externalPaymentOptions,
    showSolanaPaymentMethod,
    showStellarPaymentMethod,
    selectedWallet,
    selectedWalletDeepLink,
    walletPaymentOptions,
    solanaPaymentOptions,
    stellarPaymentOptions,
    depositAddressOptions,
    selectedDepositAddressOption,
    getOrderUsdLimit,
    resetOrder,
    setSelectedWallet,
    setSelectedWalletDeepLink,
    setPaymentWaitingMessage,
    setSelectedExternalOption,
    setSelectedTokenOption,
    setSelectedSolanaTokenOption,
    setSelectedStellarTokenOption,
    setSelectedDepositAddressOption,
    setChosenUsd,
    payWithToken,
    payWithExternal,
    payWithDepositAddress,
    payWithSolanaToken,
    payWithSolanaTokenRozo,
    payWithStellarToken,
    openInWalletBrowser,
    senderEnsName: senderEnsName ?? undefined,
    txHash,
    setTxHash,
    setRozoPaymentId,
    rozoPaymentId,
  };
}
