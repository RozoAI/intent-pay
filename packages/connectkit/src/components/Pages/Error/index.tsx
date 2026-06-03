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

    // Map error types to UI configuration
    const errorConfig = {
      [ErrorType.TRUSTLINE]: {
        title: "Trustline Not Set Up",
        canRetry: false,
      },
      [ErrorType.LIQUIDITY]: {
        title: "Insufficient Liquidity",
        canRetry: false,
      },
      [ErrorType.PAYMENT_FAILED]: {
        title: "Payment Failed",
        canRetry: true,
      },
      [ErrorType.NETWORK]: {
        title: "Network Error",
        canRetry: true,
      },
      [ErrorType.INSUFFICIENT_FUNDS]: {
        title: "Insufficient Funds",
        canRetry: false,
      },
      [ErrorType.REJECTED]: {
        title: "Transaction Rejected",
        canRetry: true,
      },
      [ErrorType.NOT_UNPAID]: {
        title: "Payment Invalid",
        canRetry: false,
      },
    } satisfies Partial<
      Record<
        ErrorType,
        {
          title: string;
          canRetry: boolean;
        }
      >
    >;

    return {
      ...(errorConfig[errorType] ?? {
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
  ]);

  const handleRetry = () => {
    capture(ROZO_EVENTS.PAYMENT_CANCELLED, {
      last_state: pay.paymentState,
      reason: "retry",
    });
    context.setRoute(ROUTES.SELECT_METHOD);
    pay.reset();
    if (context.paymentState.payParams) {
      pay.createPreviewOrder(context.paymentState.payParams);
    }
  };

  const handleCancel = () => {
    capture(ROZO_EVENTS.PAYMENT_CANCELLED, {
      last_state: pay.paymentState,
      reason: "user",
    });
    context.setOpen(false);
    pay.reset();
    if (context.paymentState.payParams) {
      pay.createPreviewOrder(context.paymentState.payParams);
    }
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
