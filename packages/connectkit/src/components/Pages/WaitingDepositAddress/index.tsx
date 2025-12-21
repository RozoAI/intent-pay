import {
  DepositAddressPaymentOptions,
  FeeType,
  generateEVMDeepLink,
  getAddressContraction,
  getChainName,
  getFee,
  getKnownToken,
  isHydrated,
  type FeeErrorData,
  type FeeResponseData,
  type Token,
} from "@rozoai/intent-common";
import { useEffect, useMemo, useRef, useState } from "react";
import { keyframes } from "styled-components";
import { parseUnits } from "viem";
import { AlertIcon, WarningIcon } from "../../../assets/icons";
import { ROUTES } from "../../../constants/routes";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import useIsMobile from "../../../hooks/useIsMobile";
import { usePayContext } from "../../../hooks/usePayContext";
import { usePusherPayout } from "../../../hooks/usePusherPayout";
import styled from "../../../styles/styled";
import { formatUsd } from "../../../utils/format";
import Button from "../../Common/Button";
import CircleTimer from "../../Common/CircleTimer";
import CopyToClipboardIcon from "../../Common/CopyToClipboard/CopyToClipboardIcon";
import CustomQRCode from "../../Common/CustomQRCode";
import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";
import SelectAnotherMethodButton from "../../Common/SelectAnotherMethodButton";
import TokenChainLogo from "../../Common/TokenChainLogo";

// Centered container for icon + text in Tron underpay screen
const CenterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  max-width: 100%;
`;

type DepositAddr = {
  displayToken: Token | null;
  logoURI: string;
  expirationS?: number;
  uri?: string;
  coins?: string;
  amount?: string;
  address?: string;
  underpayment?: Underpayment;
  externalId?: string;
  memo?: string;
};

type Underpayment = {
  unitsPaid: string;
  coin: string;
};

export default function WaitingDepositAddress() {
  const context = usePayContext();
  const { triggerResize, paymentState } = context;
  const {
    payWithDepositAddress,
    selectedDepositAddressOption,
    payParams,
    rozoPaymentId,
    setTxHash,
    setTokenMode,
    setRozoPaymentId,
  } = paymentState;
  const {
    store,
    order,
    paymentState: rozoPaymentState,
    reset,
    createPreviewOrder,
    setPaymentCompleted,
    setPaymentPayoutCompleted,
  } = useRozoPay();

  // Detect Optimism USDT0 under-payment: the order has received some funds
  // but less than required.
  const tronUnderpay =
    order != null &&
    isHydrated(order) &&
    order.sourceTokenAmount != null &&
    order.sourceTokenAmount.token.chainId === 10 &&
    order.sourceTokenAmount.token.symbol.toUpperCase() === "USDT0" &&
    Number(order.sourceTokenAmount.usd) < order.usdValue;

  const [depAddr, setDepAddr] = useState<DepositAddr>();
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [depoChain, setDepoChain] = useState<string>();
  const [hasExecutedDepositCall, setHasExecutedDepositCall] = useState(false);
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeError, setFeeError] = useState<FeeErrorData | null>(null);

  // Use Pusher to detect payin in real-time
  const pusherEnabled = !!(
    depAddr?.externalId &&
    (rozoPaymentId || depAddr?.externalId) &&
    rozoPaymentState !== "payment_started" &&
    rozoPaymentState !== "payment_completed"
  );

  usePusherPayout({
    enabled: pusherEnabled,
    rozoPaymentId: rozoPaymentId || depAddr?.externalId,
    onPayinDetected: (payload) => {
      if (payload.source_txhash && selectedDepositAddressOption) {
        context.log(
          "[PAYIN DETECTED] Payment received via Pusher:",
          payload.source_txhash
        );
        setPaymentCompleted(
          payload.source_txhash,
          rozoPaymentId || payload.payment_id
        );
        setPaymentPayoutCompleted(
          payload.source_txhash,
          rozoPaymentId || payload.payment_id
        );
        const tokenMode =
          selectedDepositAddressOption?.id ===
          DepositAddressPaymentOptions.SOLANA
            ? "solana"
            : selectedDepositAddressOption?.id ===
              DepositAddressPaymentOptions.STELLAR
            ? "stellar"
            : "evm";
        setTokenMode(tokenMode);
        setTxHash(payload.source_txhash);
        context.setRoute(ROUTES.CONFIRMATION);
      }
    },
    onDataReceived: () => {
      context.log("[PUSHER] Data received for deposit address payment");
    },
    log: context.log,
  });

  useEffect(() => {
    if (rozoPaymentState === "error") {
      context.setRoute(ROUTES.ERROR);
    }
  }, [rozoPaymentState]);

  // If we selected a deposit address option, generate the address...
  const generateDepositAddress = async () => {
    if (selectedDepositAddressOption == null) {
      if (order == null || !isHydrated(order)) return;
      if (order.sourceTokenAmount == null) return;

      // Pay underpaid order
      const taPaid = order.sourceTokenAmount;
      const usdPaid = taPaid.usd; // TODO: get usdPaid directly from the order
      const usdToPay = Math.max(order.usdValue - usdPaid, 0.01);
      const dispDecimals = taPaid.token.displayDecimals;
      const unitsToPay = (usdToPay / taPaid.token.usd).toFixed(dispDecimals);
      const unitsPaid = (
        Number(taPaid.amount) /
        10 ** taPaid.token.decimals
      ).toFixed(dispDecimals);

      // (Removed duplicate tronUnderpay calculation now handled at top-level)
      // Hack to always show a <= 60 minute countdown
      let expirationS = (order.createdAt ?? 0) + 59.5 * 60;
      if (
        order.expirationTs != null &&
        Number(order.expirationTs) < expirationS
      ) {
        expirationS = Number(order.expirationTs);
      }

      if (!order.preferredChainId || !order.preferredTokenAddress) {
        throw new Error("Preferred chain or token address not found");
      }

      const preferredToken = getKnownToken(
        Number(order.preferredChainId),
        order.preferredTokenAddress
      );

      if (!preferredToken) {
        throw new Error("Preferred token not found");
      }

      const evmDeeplink = generateEVMDeepLink({
        amountUnits: parseUnits(
          order.destFinalCallTokenAmount.usd.toString(),
          preferredToken.decimals
        ).toString(),
        chainId: preferredToken.chainId,
        recipientAddress: order.intentAddr,
        tokenAddress: preferredToken.token,
      });

      setDepAddr({
        address: order.intentAddr,
        amount: String(order.usdValue),
        underpayment: {
          unitsPaid: order.destFinalCallTokenAmount.amount,
          coin: order.destFinalCallTokenAmount.token.symbol,
        },
        coins: `${preferredToken.symbol} on ${getChainName(
          preferredToken.chainId
        )}`,
        expirationS: expirationS,
        uri: evmDeeplink,
        displayToken: order.destFinalCallTokenAmount.token,
        logoURI: "", // Not needed for underpaid orders
        memo: order.memo || order.metadata?.memo || undefined,
      });
    } else {
      // Prevent multiple executions for the same deposit option
      if (isLoading || hasExecutedDepositCall) return;

      const displayToken = getKnownToken(
        selectedDepositAddressOption.token.chainId,
        selectedDepositAddressOption.token.token
      );
      const logoURI = selectedDepositAddressOption.logoURI;

      // Set loading state immediately to prevent race conditions
      setIsLoading(true);
      setHasExecutedDepositCall(true);
      context.log(
        "Starting payWithDepositAddress for:",
        selectedDepositAddressOption.id
      );

      let amount: number | null = null;
      if (order && isHydrated(order)) {
        amount = order.usdValue;
      } else {
        amount = order?.destFinalCallTokenAmount.usd ?? null;
      }

      setDepAddr({
        displayToken: displayToken ?? null,
        logoURI,
        amount: amount?.toString() ?? undefined,
      });

      try {
        let feeData: FeeResponseData | null = null;
        // Fetch fee using amount and appId before generating deposit address
        if (amount && payParams?.appId) {
          try {
            // @TODO: Handle fee calculation for other currencies
            const feeResponse = await getFee({
              currency: "USD",
              type: payParams?.feeType ?? FeeType.ExactIn,
              toUnits: amount.toString(),
              appId: payParams.appId,
              toChain: selectedDepositAddressOption.token.chainId,
            });

            if (feeResponse.data) {
              feeData = feeResponse.data;
              setFeeData(feeResponse.data);
              setFeeError(null);
            } else if (feeResponse.error) {
              const errorMessage = feeResponse.error.message;
              // Check if it's an "Amount too high" error
              if (errorMessage) {
                // Create error data from message and stop execution
                setFeeError({
                  error: "Can't process payment",
                  message: errorMessage,
                  received: amount,
                  maxAllowed: 0,
                });
                setFeeData(null);
                setIsLoading(false);
                setHasExecutedDepositCall(false);
              } else {
                setFeeError(null);
                setFeeData(null);
              }
              return; // Stop here, don't generate deposit address
            } else {
              setFeeData(null);
              setFeeError(null);
            }
          } catch (feeError) {
            console.error("Error fetching fee:", feeError);
            setFeeData(null);
            setFeeError(null);
            // Continue with deposit address generation even if fee fetch fails
          }
        }

        const details = await payWithDepositAddress(
          selectedDepositAddressOption,
          store as any,
          feeData,
          context.log
        );
        if (details) {
          const shouldShowMemo = ![DepositAddressPaymentOptions.BSC].includes(
            selectedDepositAddressOption.id
          );

          setDepAddr({
            address: details.address,
            amount: details.amount,
            coins: details.suffix,
            expirationS: details.expirationS,
            uri: details.uri,
            displayToken: displayToken ?? null,
            logoURI,
            externalId: details.externalId,
            memo: shouldShowMemo ? details.memo || "" : undefined,
          });
          setRozoPaymentId(details.externalId);
          setDepoChain(selectedDepositAddressOption.id);
        } else if (details === null) {
          // Duplicate call was prevented - reset loading states
          setIsLoading(false);
          setHasExecutedDepositCall(false);
          return;
        } else {
          setFailed(true);
        }
      } catch (error) {
        console.error("Error getting deposit address:", error);
        setFailed(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Track which deposit option we're currently processing to prevent double execution
  const processingOptionRef = useRef<string | null>(null);

  // Reset execution flag when deposit option changes
  useEffect(() => {
    // Reset execution flag when selectedDepositAddressOption changes
    if (selectedDepositAddressOption) {
      setHasExecutedDepositCall(false);
      setFailed(false);
      setFeeData(null); // Reset fee when deposit option changes
      setFeeError(null); // Reset fee error when deposit option changes
      processingOptionRef.current = null; // Reset processing flag
    }
  }, [selectedDepositAddressOption]);

  // Reset payment state when selectedDepositAddressOption changes and we're not in preview
  useEffect(() => {
    if (
      selectedDepositAddressOption &&
      rozoPaymentState !== "preview" &&
      rozoPaymentState !== "idle" &&
      payParams
    ) {
      if (rozoPaymentState === "error") {
        context.setRoute(ROUTES.ERROR);
        return;
      }

      context.log(
        `Resetting payment state from ${rozoPaymentState} to preview for new deposit option`
      );
      reset();
      createPreviewOrder(payParams);
    }
  }, [selectedDepositAddressOption, rozoPaymentState, payParams]);

  // Generate deposit address when conditions are met
  useEffect(() => {
    if (
      selectedDepositAddressOption &&
      !hasExecutedDepositCall &&
      !isLoading &&
      processingOptionRef.current !== selectedDepositAddressOption.id
    ) {
      context.log(
        "About to generate deposit address for:",
        selectedDepositAddressOption.id
      );
      processingOptionRef.current = selectedDepositAddressOption.id; // Mark as processing
      generateDepositAddress();
    }
  }, [
    selectedDepositAddressOption,
    rozoPaymentState,
    hasExecutedDepositCall,
    isLoading,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(triggerResize, [depAddr, failed, feeData, feeError]);

  // Navigate to confirmation when payment state changes to started or completed
  useEffect(() => {
    if (
      (rozoPaymentState === "payment_started" ||
        rozoPaymentState === "payment_completed") &&
      selectedDepositAddressOption &&
      order &&
      isHydrated(order)
    ) {
      context.log(
        "[PAYMENT] Payment state changed, navigating to confirmation"
      );
      const tokenMode =
        selectedDepositAddressOption?.id === DepositAddressPaymentOptions.SOLANA
          ? "solana"
          : selectedDepositAddressOption?.id ===
            DepositAddressPaymentOptions.STELLAR
          ? "stellar"
          : "evm";
      setTokenMode(tokenMode);

      // Extract transaction hash from order if available
      const txHash = order.sourceStartTxHash || order.sourceInitiateTxHash;

      if (txHash) {
        setTxHash(txHash);
      }

      context.setRoute(ROUTES.CONFIRMATION);
    }
  }, [
    rozoPaymentState,
    selectedDepositAddressOption,
    order,
    context,
    setTokenMode,
    setTxHash,
  ]);

  return (
    <PageContent>
      {tronUnderpay ? (
        <TronUnderpayContent orderId={order?.id?.toString()} />
      ) : feeError ? (
        <FeeErrorContent feeError={feeError} />
      ) : failed ? (
        selectedDepositAddressOption && (
          <DepositFailed name={selectedDepositAddressOption.id} />
        )
      ) : (
        depAddr && (
          <DepositAddressInfo
            depAddr={depAddr}
            feeData={feeData}
            refresh={generateDepositAddress}
            triggerResize={triggerResize}
          />
        )
      )}
    </PageContent>
  );
}

function TronUnderpayContent({ orderId }: { orderId?: string }) {
  return (
    <ModalContent
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 0,
        position: "relative",
      }}
    >
      <CenterContainer>
        <FailIcon />
        <ModalH1 style={{ textAlign: "center", marginTop: 16 }}>
          USDT Tron Payment Was Too Low
        </ModalH1>
        <div style={{ height: 16 }} />
        <ModalBody style={{ textAlign: "center" }}>
          Your funds are safe.
          <br />
          Email hi@rozo.ai for a refund.
        </ModalBody>
        <Button
          onClick={() =>
            window.open(
              `mailto:hi@rozo.ai?subject=Underpaid%20USDT%20Tron%20payment%20for%20order%20${orderId}`,
              "_blank"
            )
          }
          style={{ marginTop: 16, width: 200 }}
        >
          Contact Support
        </Button>
      </CenterContainer>
    </ModalContent>
  );
}

function FeeErrorContent({ feeError }: { feeError: FeeErrorData }) {
  return (
    <ModalContent
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 0,
        position: "relative",
      }}
    >
      <CenterContainer style={{ width: "100%" }}>
        <FailIcon />
        <ModalH1 style={{ textAlign: "center", marginTop: 16 }}>
          Amount Too High
        </ModalH1>
        <div style={{ height: 16 }} />
        <ModalBody style={{ textAlign: "center" }}>
          {feeError.message || feeError.error}
          {feeError.maxAllowed > 0 && (
            <>
              <br />
              <br />
              Maximum allowed amount:{" "}
              {formatUsd(feeError.maxAllowed, "nearest")}
            </>
          )}
        </ModalBody>
        <SelectAnotherMethodButton />
      </CenterContainer>
    </ModalContent>
  );
}

function DepositAddressInfo({
  depAddr,
  feeData,
  refresh,
  triggerResize,
}: {
  depAddr: DepositAddr;
  feeData: FeeResponseData | null;
  refresh: () => void;
  triggerResize: () => void;
}) {
  const { isMobile } = useIsMobile();

  const [remainingS, totalS] = useCountdown(depAddr?.expirationS);
  const isExpired = depAddr?.expirationS != null && remainingS === 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(triggerResize, [isExpired]);

  const logoOffset = isMobile ? 4 : 0;
  const logoElement = depAddr.displayToken ? (
    <TokenChainLogo
      token={depAddr.displayToken}
      size={64}
      offset={logoOffset}
    />
  ) : (
    <img src={depAddr.logoURI} width="64px" height="64px" />
  );

  return (
    <ModalContent>
      {isExpired ? (
        <LogoRow>
          <Button onClick={refresh} style={{ width: 128 }}>
            Refresh
          </Button>
        </LogoRow>
      ) : isMobile ? (
        <LogoRow>
          <LogoWrap>{logoElement}</LogoWrap>
        </LogoRow>
      ) : (
        <QRWrap>
          <CustomQRCode
            value={depAddr?.uri}
            contentPadding={24}
            size={200}
            image={logoElement}
          />
        </QRWrap>
      )}
      <CopyableInfo
        depAddr={depAddr}
        feeData={feeData}
        remainingS={remainingS}
        totalS={totalS}
      />
    </ModalContent>
  );
}

const LogoWrap = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
`;

const LogoRow = styled.div`
  padding: 32px 0;
  height: 128px;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
`;

const QRWrap = styled.div`
  margin: 0 auto;
  width: 280px;
`;

function CopyableInfo({
  depAddr,
  feeData,
  remainingS,
  totalS,
}: {
  depAddr?: DepositAddr;
  feeData: FeeResponseData | null;
  remainingS: number;
  totalS: number;
}) {
  const underpayment = depAddr?.underpayment;
  const isExpired = depAddr?.expirationS != null && remainingS === 0;

  return (
    <CopyableInfoWrapper>
      {underpayment && <UnderpaymentInfo underpayment={underpayment} />}
      {feeData !== null && (
        <FeeDisplayRow
          title="Fee"
          value={feeData.fee === 0 ? "Free" : formatUsd(feeData.fee, "nearest")}
        />
      )}
      <CopyRowOrThrobber
        title="Send Exactly"
        value={depAddr?.amount}
        valueText={formatUsd(Number(depAddr?.amount) || 0, "nearest")}
        smallText={depAddr?.coins}
        disabled={isExpired}
      />
      <CopyRowOrThrobber
        title="Receiving Address"
        value={depAddr?.address}
        valueText={depAddr?.address && getAddressContraction(depAddr.address)}
        disabled={isExpired}
      />
      {depAddr?.memo && (
        <CopyRowOrThrobber
          title="Memo"
          value={depAddr.memo}
          valueText={depAddr.memo}
          disabled={isExpired}
        />
      )}
      <CountdownWrap>
        <CountdownTimer remainingS={remainingS} totalS={totalS} />
      </CountdownWrap>
    </CopyableInfoWrapper>
  );
}

function UnderpaymentInfo({ underpayment }: { underpayment: Underpayment }) {
  // Default message
  return (
    <UnderpaymentWrapper>
      <UnderpaymentHeader>
        <WarningIcon />
        <span>
          Received {underpayment.unitsPaid} {underpayment.coin}
        </span>
      </UnderpaymentHeader>
      <SmallText>Finish by sending the extra amount below.</SmallText>
    </UnderpaymentWrapper>
  );
}

const UnderpaymentWrapper = styled.div`
  background: var(--ck-body-background-tertiary);
  border-radius: 8px;
  padding: 16px;
  margin: 0 4px 16px 4px;
  margin-bottom: 16px;
`;

const UnderpaymentHeader = styled.div`
  font-weight: 500;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 8px;
`;

const CopyableInfoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  gap: 0;
  margin-top: 8px;
`;

const CountdownWrap = styled.div`
  margin-top: 24px;
  height: 16px;
`;

const FailIcon = styled(AlertIcon)`
  color: var(--ck-body-color-alert);
  width: 32px;
  height: 32px;
  margin-top: auto;
  margin-bottom: 16px;
`;

function useCountdown(expirationS?: number) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initMs = useMemo(() => Date.now(), [expirationS]);
  const [ms, setMs] = useState(initMs);

  useEffect(() => {
    const interval = setInterval(() => setMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (expirationS == null) return [0, 0];

  const remainingS = Math.max(0, (expirationS - ms / 1000) | 0);
  const totalS = Math.max(0, (expirationS - initMs / 1000) | 0);
  return [remainingS, totalS];
}

function CountdownTimer({
  remainingS,
  totalS,
}: {
  remainingS: number;
  totalS: number;
}) {
  if (totalS == 0 || remainingS > 3600) {
    return <SmallText>Send only once</SmallText>;
  }
  const isExpired = remainingS === 0;

  return (
    <ModalBody>
      <CountdownRow>
        <CircleTimer
          total={totalS}
          currentTime={remainingS}
          size={18}
          stroke={3}
        />
        <strong>{isExpired ? "Expired" : formatTime(remainingS)}</strong>
      </CountdownRow>
    </ModalBody>
  );
}

const CountdownRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-variant-numeric: tabular-nums;
`;

const formatTime = (sec: number) => {
  const m = `${Math.floor(sec / 60)}`.padStart(2, "0");
  const s = `${sec % 60}`.padStart(2, "0");
  return `${m}:${s}`;
};

function DepositFailed({ name }: { name: string }) {
  return (
    <ModalContent style={{ marginLeft: 24, marginRight: 24 }}>
      <ModalH1>{name} unavailable</ModalH1>
      <ModalBody>
        We&apos;re unable to process {name} payments at this time. Please select
        another payment method.
      </ModalBody>
      <SelectAnotherMethodButton />
    </ModalContent>
  );
}

const CopyRow = styled.button`
  display: block;
  height: 64px;
  border-radius: 8px;
  padding: 8px 16px;

  cursor: pointer;
  background-color: var(--ck-body-background);
  background-color: var(--ck-body-background);

  display: flex;
  align-items: center;
  justify-content: space-between;

  transition: all 100ms ease;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    transform: scale(0.98);
    background-color: var(--ck-body-background-secondary);
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
    transform: scale(0.98);
    background-color: var(--ck-body-background-secondary);
  }
`;

const LabelRow = styled.div`
  margin-bottom: 4px;
`;

const MainRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ValueContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SmallText = styled.span`
  font-size: 14px;
  color: var(--ck-primary-button-color);
`;

const ValueText = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--ck-primary-button-color);
`;

const LabelText = styled(ModalBody)`
  margin: 0;
  text-align: left;
`;

const pulse = keyframes`
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
`;

const Skeleton = styled.div`
  width: 80px;
  height: 16px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

function CopyRowOrThrobber({
  title,
  value,
  valueText,
  smallText,
  disabled,
}: {
  title: string;
  value?: string;
  valueText?: string;
  smallText?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (disabled) return;
    if (!value) return;
    const str = value.trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(str);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  if (!value) {
    return (
      <CopyRow>
        <LabelRow>
          <LabelText>{title}</LabelText>
        </LabelRow>
        <MainRow>
          <Skeleton />
        </MainRow>
      </CopyRow>
    );
  }

  const displayValue = valueText || value;

  return (
    <CopyRow as="button" onClick={handleCopy} disabled={disabled}>
      <div>
        <LabelRow>
          <LabelText>{title}</LabelText>
        </LabelRow>
        <MainRow>
          <ValueContainer>
            <ValueText>{displayValue}</ValueText>
            {smallText && <SmallText>{smallText}</SmallText>}
          </ValueContainer>
        </MainRow>
      </div>
      <CopyIconWrap>
        <CopyToClipboardIcon copied={copied} dark />
      </CopyIconWrap>
    </CopyRow>
  );
}

const CopyIconWrap = styled.div`
  --color: var(--ck-copytoclipboard-stroke);
  --bg: var(--ck-body-background);
`;

const DisplayRow = styled.div`
  height: 64px;
  border-radius: 8px;
  padding: 8px 16px;
  background-color: var(--ck-body-background);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

function FeeDisplayRow({ title, value }: { title: string; value: string }) {
  return (
    <DisplayRow>
      <div>
        <LabelRow>
          <LabelText>{title}</LabelText>
        </LabelRow>
        <MainRow>
          <ValueContainer>
            <ValueText>{value}</ValueText>
          </ValueContainer>
        </MainRow>
      </div>
    </DisplayRow>
  );
}
