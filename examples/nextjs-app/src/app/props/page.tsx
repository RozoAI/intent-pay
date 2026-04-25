type PropRow = {
  prop: string;
  type: string;
  required: string;
  description: string;
};

const requiredProps: PropRow[] = [
  {
    prop: "appId",
    type: "string",
    required: "Yes",
    description: "Public app ID from Rozo.",
  },
  {
    prop: "toChain",
    type: "number",
    required: "Yes",
    description: "Destination chain ID.",
  },
  {
    prop: "toAddress",
    type: "string",
    required: "Yes",
    description: "Recipient address (EVM/Solana/Stellar format).",
  },
  {
    prop: "toToken",
    type: "string",
    required: "Yes",
    description: "Destination token identifier for target chain.",
  },
  {
    prop: "children",
    type: "({ show, hide }) => ReactElement",
    required: "Custom only",
    description: "Required for RozoPayButton.Custom trigger rendering.",
  },
];

const paymentProps: PropRow[] = [
  {
    prop: "toUnits",
    type: "string",
    required: "No",
    description:
      'Exact destination amount (USD/EUR style amount), e.g. "10" or "10.50".',
  },
  {
    prop: "intent",
    type: "string",
    required: "No",
    description: 'Intent verb label such as "Pay", "Deposit", or "Purchase".',
  },
  {
    prop: "feeType",
    type: "FeeType",
    required: "No",
    description: "Fee mode: exactIn (default) or exactOut.",
  },
  {
    prop: "paymentOptions",
    type: "ExternalPaymentOptionsString[]",
    required: "No",
    description: "Limit/enable external payment methods.",
  },
  {
    prop: "preferredChains",
    type: "number[]",
    required: "No",
    description: "Prioritize source assets from these chains.",
  },
  {
    prop: "preferredTokens",
    type: "Token[]",
    required: "No",
    description: "Prioritize specific source tokens.",
  },
  {
    prop: "preferredSymbol",
    type: "TokenSymbol[]",
    required: "No",
    description: "Prioritize token symbols (USDC, USDT, EURC).",
  },
  {
    prop: "metadata",
    type: "Record<string, any>",
    required: "No",
    description: "Arbitrary metadata for tracking/correlation.",
  },
];

const eventProps: PropRow[] = [
  {
    prop: "onPaymentStarted",
    type: "(event) => void",
    required: "No",
    description: "Called when payment tx is seen on chain.",
  },
  {
    prop: "onPaymentCompleted",
    type: "(event) => void",
    required: "No",
    description: "Called when destination transfer/call succeeds.",
  },
  {
    prop: "onPaymentBounced",
    type: "(event) => void",
    required: "No",
    description: "Called when destination call reverts and refunds.",
  },
  {
    prop: "onPayoutCompleted",
    type: "(event) => void",
    required: "No",
    description: "Called when payout completes.",
  },
  {
    prop: "onOpen",
    type: "() => void",
    required: "No",
    description: "Called when modal opens.",
  },
  {
    prop: "onClose",
    type: "() => void",
    required: "No",
    description: "Called when modal closes.",
  },
  {
    prop: "defaultOpen",
    type: "boolean",
    required: "No",
    description: "Open modal by default.",
  },
  {
    prop: "closeOnSuccess",
    type: "boolean",
    required: "No",
    description: "Automatically close modal after success.",
  },
  {
    prop: "resetOnSuccess",
    type: "boolean",
    required: "No",
    description: "Reset payment state after success.",
  },
  {
    prop: "connectedWalletOnly",
    type: "boolean",
    required: "No",
    description: "Restrict flow to already-connected wallets only.",
  },
  {
    prop: "confirmationMessage",
    type: "string",
    required: "No",
    description: "Custom message on confirmation page.",
  },
  {
    prop: "showProcessingPayout",
    type: "boolean",
    required: "No",
    description: "Show payout-processing state after payment completion.",
  },
];

const visualProps: PropRow[] = [
  {
    prop: "mode",
    type: '"light" | "dark" | "auto"',
    required: "No",
    description: "Visual mode.",
  },
  {
    prop: "theme",
    type: "Theme",
    required: "No",
    description: "Built-in named theme.",
  },
  {
    prop: "customTheme",
    type: "CustomTheme",
    required: "No",
    description: "Custom theme object.",
  },
  {
    prop: "disabled",
    type: "boolean",
    required: "No",
    description: "Disable interaction.",
  },
];

function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Prop</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Required</th>
            <th className="px-4 py-3">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prop} className="border-t border-gray-100 align-top">
              <td className="px-4 py-3 font-mono text-xs text-gray-900">
                {row.prop}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-700">
                {row.type}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.required}</td>
              <td className="px-4 py-3 text-gray-700">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PropsReferencePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-medium">
          RozoPayButton Reference
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
          Available Props
        </h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Inline-params reference page for RozoPayButton and
          RozoPayButton.Custom.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Required Props
        </h2>
        <PropsTable rows={requiredProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Payment Props</h2>
        <PropsTable rows={paymentProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Event + Behavior Props
        </h2>
        <PropsTable rows={eventProps} />
      </section>

      <section className="space-y-3 pb-8">
        <h2 className="text-base font-semibold text-gray-900">Visual Props</h2>
        <PropsTable rows={visualProps} />
      </section>
    </div>
  );
}
