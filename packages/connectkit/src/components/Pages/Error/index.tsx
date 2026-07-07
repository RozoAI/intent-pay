import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";

import { useEffect, useMemo } from "react";
import { AlertIcon } from "../../../assets/icons";
import { ROUTES } from "../../../constants/routes";
import { usePayContext } from "../../../hooks/usePayContext";
import { useRozoPay } from "../../../hooks/useRozoPay";
import { ROZO_EVENTS } from "../../../lib/analytics/events";
import { useAnalytics } from "../../../provider/AnalyticsProvider";
import styled from "../../../styles/styled";
import { categorizeError, ErrorType } from "../../../utils/errorParser";
import {
  getDetailedValidationError,
  ValidationError,
} from "../../../utils/validatePayoutToken";
import Button from "../../Common/Button";
import PoweredByFooter from "../../Common/PoweredByFooter";

type ErrorCategory = {
  title: string;
  message: string;
  canRetry: boolean;
  showSupport: boolean;
};

// Map error types to UI title/retry configuration
const ERROR_CONFIG = {
  [ErrorType.TRUSTLINE]: { title: "Trustline Not Set Up", canRetry: false },
  [ErrorType.LIQUIDITY]: { title: "Insufficient Liquidity", canRetry: false },
  [ErrorType.PAYMENT_FAILED]: { title: "Payment Failed", canRetry: true },
  [ErrorType.NETWORK]: { title: "Network Error", canRetry: true },
  [ErrorType.INSUFFICIENT_FUNDS]: {
    title: "Insufficient Funds",
    canRetry: false,
  },
  [ErrorType.REJECTED]: { title: "Transaction Rejected", canRetry: true },
  [ErrorType.NOT_UNPAID]: { title: "Payment Invalid", canRetry: false },
  [ErrorType.UNSUPPORTED_CHAIN]: {
    title: "Network Not Supported",
    canRetry: true,
  },
} satisfies Partial<Record<ErrorType, { title: string; canRetry: boolean }>>;

export default function ErrorPage() {
  const pay = useRozoPay();
  const context = usePayContext();
  const { capture } = useAnalytics();

  const errorCategory = useMemo((): ErrorCategory => {
    // Check if this is a validation error from route meta
    const validationError = context.routeMeta?.validationError as
      | ValidationError
      | undefined;

    if (validationError) {
      const { title, message } = getDetailedValidationError(validationError);
      return {
        title,
        message,
        canRetry: false,
        showSupport: false,
      };
    }

    // Errors raised outside the FSM (e.g. wallet chain switch failures)
    // are passed via route meta instead of pay.paymentState.
    const routeError = context.routeMeta?.error as string | undefined;
    if (routeError) {
      const errorType = categorizeError(routeError);
      return {
        ...(ERROR_CONFIG[errorType] ?? {
          title: "Payment Unavailable",
          canRetry: true,
        }),
        message:
          errorType === ErrorType.UNKNOWN
            ? routeError
            : "Your wallet couldn't complete this action. Please try a different network or wallet.",
        showSupport: true,
      };
    }

    if (pay.paymentState !== "error") {
      return {
        title: "Unknown Error",
        message: "An unexpected error occurred",
        canRetry: true,
        showSupport: true,
      };
    }

    const errorMsg = pay.paymentErrorMessage || "";
    const errorType = categorizeError(errorMsg);

    return {
      ...(ERROR_CONFIG[errorType] ?? {
        title: "Payment Unavailable",
        canRetry: true,
      }),
      message: errorMsg,
      showSupport: true,
    };
  }, [
    pay.paymentState,
    pay.paymentErrorMessage,
    context.routeMeta?.validationError,
    context.routeMeta?.error,
  ]);

  // Re-initialize a fresh order after reset. In appId mode we re-create the
  // preview from payParams; in payId mode (no payParams) we re-fetch the
  // existing payment by its ID so the user can retry the same payId order
  // instead of landing on an empty SELECT_METHOD.
  const reinitOrder = () => {
    const payId = pay.order?.externalId ?? undefined;
    pay.reset();
    if (context.paymentState.payParams) {
      pay.createPreviewOrder(context.paymentState.payParams);
    } else if (payId) {
      pay.setPayId(payId);
    }
  };

  const handleRetry = () => {
    capture(ROZO_EVENTS.PAYMENT_CANCELLED, {
      last_state: pay.paymentState,
      reason: "retry",
    });
    context.setRoute(ROUTES.SELECT_METHOD);
    reinitOrder();
  };

  const handleCancel = () => {
    capture(ROZO_EVENTS.PAYMENT_CANCELLED, {
      last_state: pay.paymentState,
      reason: "user",
    });
    context.setOpen(false);
    reinitOrder();
  };

  useEffect(() => {
    context.triggerResize();
  }, [errorCategory]);

  useEffect(() => {
    const errorType = categorizeError(errorCategory.message);
    capture(ROZO_EVENTS.ERROR_OCCURRED, {
      context: "payment",
      error_message: errorCategory.message,
      error_title: errorCategory.title,
      error_type: errorType,
      payment_id: pay.order?.id,
      can_retry: errorCategory.canRetry,
    });
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContent>
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
          <ErrorTitle>{errorCategory.title}</ErrorTitle>
          <ErrorBody>{errorCategory.message}</ErrorBody>

          {errorCategory.canRetry && (
            <Button onClick={handleRetry} variant="primary">
              Try Another Method
            </Button>
          )}
          <Button onClick={handleCancel} variant="secondary">
            Cancel
          </Button>
        </CenterContainer>
        <PoweredByFooter
          preFilledMessage={`Error: ${errorCategory.message}`}
          showSupport={errorCategory.showSupport}
        />
      </ModalContent>
    </PageContent>
  );
}

const CenterContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 100%;
  width: 100%;
`;

const ErrorTitle = styled(ModalH1)`
  text-align: center;
  margin-top: 8px;
  margin-bottom: 12px;
`;

const ErrorBody = styled(ModalBody)`
  max-width: 100%;
  text-align: center;
  color: var(--ck-body-color-muted);
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-all;
  overflow-wrap: anywhere;
`;

const FailIcon = styled(AlertIcon)`
  color: var(--ck-body-color-alert);
  width: 48px;
  height: 48px;
  margin-top: auto;
  margin-bottom: 8px;
  margin-inline: auto;
`;
