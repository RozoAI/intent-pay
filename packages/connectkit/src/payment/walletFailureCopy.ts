/**
 * Localized copy for the PayWithToken failed state: the title, the body and
 * the two buttons ("Retry Payment" and the deposit-address fallback). Nothing
 * else in the modal is translated here.
 *
 * Why this exists: on 2026-11-09 a Russian-speaking payer's MetaMask could not
 * reach its own Polygon RPC (Infura "RPC endpoint not found or unavailable").
 * The modal showed the English "Wallet Could Not Send" + "Pay another way" and
 * he closed it 10 s later. The host app (invoice.rozo.ai) does not pass a
 * language to the SDK, so the copy follows the payer's browser language unless
 * the host explicitly chose one.
 *
 * Design rules:
 * - Pure functions, no React, no `navigator` access: the caller reads the
 *   browser language on the client and passes it in, so SSR output never
 *   depends on it.
 * - A small self-contained dictionary instead of the SDK locale files: the
 *   SDK's global language stays as it is (default en-US), so the rest of the
 *   modal is never left half translated.
 * - Same rule as walletFailure.ts: never promise that nothing was broadcast.
 *   Every body keeps "if your wallet shows it as sent, wait for it to confirm".
 */

import type { WalletFailure } from "./walletFailure";

export type FailureCopyLanguage =
  | "en"
  | "ru"
  | "zh"
  | "zh-TW"
  | "es"
  | "ja"
  | "ko"
  | "id"
  | "pt-BR"
  | "vi"
  | "ms";

interface CopyParams {
  /** Connector name (e.g. "MetaMask"); null when unknown. */
  wallet: string | null;
  /** Human chain name (e.g. "Polygon"). */
  network: string;
}

interface FailureStrings {
  titleRpcUnavailable: string;
  titleWalletInternal: string;
  titleCancelled: string;
  bodyRpcUnavailable: (p: CopyParams) => string;
  bodyWalletInternal: (p: CopyParams) => string;
  bodyOther: (p: CopyParams) => string;
  payFromAnotherWallet: string;
  retryPayment: string;
}

const STRINGS: Record<FailureCopyLanguage, FailureStrings> = {
  en: {
    titleRpcUnavailable: "Wallet Network Unavailable",
    titleWalletInternal: "Wallet Could Not Send",
    titleCancelled: "Payment Cancelled",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Your wallet"} could not reach the ${network} network, so this page did not receive a transaction. This is a problem with the wallet's network connection, not with your funds. If your wallet shows a transaction as sent, wait for it to confirm before paying again. Otherwise, pay from another wallet or an exchange, or choose a different network.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Your wallet"} returned an internal error and this page did not receive a transaction. If your wallet shows one as sent, wait for it to confirm before paying again. Otherwise, you can pay from another wallet or an exchange below.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Your wallet"} did not complete this transaction. If your wallet shows one as sent, wait for it to confirm before paying again.`,
    payFromAnotherWallet: "Pay from another wallet or exchange",
    retryPayment: "Retry Payment",
  },
  ru: {
    titleRpcUnavailable: "Сеть кошелька недоступна",
    titleWalletInternal: "Кошелёк не смог отправить платёж",
    titleCancelled: "Платёж отменён",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ? `Кошелёк ${wallet}` : "Ваш кошелёк"} не смог подключиться к сети ${network}, поэтому эта страница не получила транзакцию. Проблема в сетевом подключении кошелька, а не в ваших средствах. Если кошелёк показывает транзакцию как отправленную, дождитесь её подтверждения, прежде чем платить снова. Иначе оплатите с другого кошелька или биржи либо выберите другую сеть.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ? `Кошелёк ${wallet}` : "Ваш кошелёк"} вернул внутреннюю ошибку, и эта страница не получила транзакцию. Если кошелёк показывает транзакцию как отправленную, дождитесь её подтверждения, прежде чем платить снова. Иначе можно оплатить с другого кошелька или биржи ниже.`,
    bodyOther: ({ wallet }) =>
      `${wallet ? `Кошелёк ${wallet}` : "Ваш кошелёк"} не завершил эту транзакцию. Если кошелёк показывает транзакцию как отправленную, дождитесь её подтверждения, прежде чем платить снова.`,
    payFromAnotherWallet: "Оплатить с другого кошелька или биржи",
    retryPayment: "Повторить платёж",
  },
  zh: {
    titleRpcUnavailable: "钱包网络不可用",
    titleWalletInternal: "钱包无法发送",
    titleCancelled: "支付已取消",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ? `${wallet} ` : "你的钱包"}无法连接 ${network} 网络，因此本页面没有收到交易。这是钱包的网络连接问题，与你的资金无关。如果钱包显示交易已发送，请等待确认后再重新支付。否则，请改用其他钱包或交易所付款，或选择其他网络。`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ? `${wallet} ` : "你的钱包"}返回了内部错误，本页面没有收到交易。如果钱包显示交易已发送，请等待确认后再重新支付。否则，可以在下方改用其他钱包或交易所付款。`,
    bodyOther: ({ wallet }) =>
      `${wallet ? `${wallet} ` : "你的钱包"}没有完成这笔交易。如果钱包显示交易已发送，请等待确认后再重新支付。`,
    payFromAnotherWallet: "用其他钱包或交易所付款",
    retryPayment: "重新支付",
  },
  "zh-TW": {
    titleRpcUnavailable: "錢包網路無法使用",
    titleWalletInternal: "錢包無法送出",
    titleCancelled: "付款已取消",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ? `${wallet} ` : "你的錢包"}無法連線到 ${network} 網路，因此本頁面沒有收到交易。這是錢包的網路連線問題，與你的資金無關。如果錢包顯示交易已送出，請等待確認後再重新付款。否則，請改用其他錢包或交易所付款，或選擇其他網路。`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ? `${wallet} ` : "你的錢包"}回傳了內部錯誤，本頁面沒有收到交易。如果錢包顯示交易已送出，請等待確認後再重新付款。否則，可以在下方改用其他錢包或交易所付款。`,
    bodyOther: ({ wallet }) =>
      `${wallet ? `${wallet} ` : "你的錢包"}沒有完成這筆交易。如果錢包顯示交易已送出，請等待確認後再重新付款。`,
    payFromAnotherWallet: "用其他錢包或交易所付款",
    retryPayment: "重新付款",
  },
  es: {
    titleRpcUnavailable: "Red de la billetera no disponible",
    titleWalletInternal: "La billetera no pudo enviar",
    titleCancelled: "Pago cancelado",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Tu billetera"} no pudo conectarse a la red ${network}, así que esta página no recibió ninguna transacción. Es un problema de la conexión de red de la billetera, no de tus fondos. Si tu billetera muestra una transacción como enviada, espera a que se confirme antes de volver a pagar. Si no, paga desde otra billetera o un exchange, o elige otra red.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Tu billetera"} devolvió un error interno y esta página no recibió ninguna transacción. Si tu billetera muestra una como enviada, espera a que se confirme antes de volver a pagar. Si no, puedes pagar desde otra billetera o un exchange abajo.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Tu billetera"} no completó esta transacción. Si tu billetera muestra una como enviada, espera a que se confirme antes de volver a pagar.`,
    payFromAnotherWallet: "Pagar desde otra billetera o exchange",
    retryPayment: "Reintentar pago",
  },
  ja: {
    titleRpcUnavailable: "ウォレットのネットワークに接続できません",
    titleWalletInternal: "ウォレットから送信できませんでした",
    titleCancelled: "支払いがキャンセルされました",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "お使いのウォレット"}が ${network} ネットワークに接続できなかったため、このページは取引を受け取っていません。これはウォレットのネットワーク接続の問題で、お客様の資金の問題ではありません。ウォレットで取引が送信済みと表示されている場合は、確認されるまで待ってから再度お支払いください。そうでない場合は、別のウォレットまたは取引所からお支払いいただくか、別のネットワークを選択してください。`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "お使いのウォレット"}で内部エラーが発生し、このページは取引を受け取っていません。ウォレットで取引が送信済みと表示されている場合は、確認されるまで待ってから再度お支払いください。そうでない場合は、下のボタンから別のウォレットまたは取引所でお支払いいただけます。`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "お使いのウォレット"}でこの取引が完了しませんでした。ウォレットで取引が送信済みと表示されている場合は、確認されるまで待ってから再度お支払いください。`,
    payFromAnotherWallet: "別のウォレットまたは取引所で支払う",
    retryPayment: "もう一度支払う",
  },
  ko: {
    titleRpcUnavailable: "지갑 네트워크를 사용할 수 없음",
    titleWalletInternal: "지갑에서 전송하지 못함",
    titleCancelled: "결제가 취소됨",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "지갑"}에서 ${network} 네트워크에 연결하지 못해 이 페이지에서 거래를 받지 못했습니다. 이는 지갑의 네트워크 연결 문제이며 자금의 문제가 아닙니다. 지갑에 거래가 전송됨으로 표시되면 확인될 때까지 기다린 뒤 다시 결제하세요. 그렇지 않다면 다른 지갑이나 거래소에서 결제하거나 다른 네트워크를 선택하세요.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "지갑"}에서 내부 오류가 발생해 이 페이지에서 거래를 받지 못했습니다. 지갑에 거래가 전송됨으로 표시되면 확인될 때까지 기다린 뒤 다시 결제하세요. 그렇지 않다면 아래에서 다른 지갑이나 거래소로 결제할 수 있습니다.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "지갑"}에서 이 거래를 완료하지 못했습니다. 지갑에 거래가 전송됨으로 표시되면 확인될 때까지 기다린 뒤 다시 결제하세요.`,
    payFromAnotherWallet: "다른 지갑이나 거래소에서 결제",
    retryPayment: "다시 결제",
  },
  id: {
    titleRpcUnavailable: "Jaringan Dompet Tidak Tersedia",
    titleWalletInternal: "Dompet Tidak Dapat Mengirim",
    titleCancelled: "Pembayaran Dibatalkan",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Dompet Anda"} tidak dapat terhubung ke jaringan ${network}, jadi halaman ini tidak menerima transaksi. Ini masalah koneksi jaringan dompet, bukan masalah dana Anda. Jika dompet Anda menampilkan transaksi sebagai terkirim, tunggu hingga dikonfirmasi sebelum membayar lagi. Jika tidak, bayar dari dompet lain atau exchange, atau pilih jaringan lain.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Dompet Anda"} mengembalikan kesalahan internal dan halaman ini tidak menerima transaksi. Jika dompet Anda menampilkan transaksi sebagai terkirim, tunggu hingga dikonfirmasi sebelum membayar lagi. Jika tidak, Anda dapat membayar dari dompet lain atau exchange di bawah.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Dompet Anda"} tidak menyelesaikan transaksi ini. Jika dompet Anda menampilkan transaksi sebagai terkirim, tunggu hingga dikonfirmasi sebelum membayar lagi.`,
    payFromAnotherWallet: "Bayar dari dompet lain atau exchange",
    retryPayment: "Coba Bayar Lagi",
  },
  "pt-BR": {
    titleRpcUnavailable: "Rede da carteira indisponível",
    titleWalletInternal: "A carteira não conseguiu enviar",
    titleCancelled: "Pagamento cancelado",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Sua carteira"} não conseguiu se conectar à rede ${network}, então esta página não recebeu nenhuma transação. É um problema na conexão de rede da carteira, não nos seus fundos. Se a sua carteira mostrar uma transação como enviada, aguarde a confirmação antes de pagar novamente. Caso contrário, pague com outra carteira ou uma corretora, ou escolha outra rede.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Sua carteira"} retornou um erro interno e esta página não recebeu nenhuma transação. Se a sua carteira mostrar uma como enviada, aguarde a confirmação antes de pagar novamente. Caso contrário, você pode pagar com outra carteira ou uma corretora abaixo.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Sua carteira"} não concluiu esta transação. Se a sua carteira mostrar uma como enviada, aguarde a confirmação antes de pagar novamente.`,
    payFromAnotherWallet: "Pagar com outra carteira ou corretora",
    retryPayment: "Tentar pagar novamente",
  },
  vi: {
    titleRpcUnavailable: "Mạng của ví không khả dụng",
    titleWalletInternal: "Ví không gửi được",
    titleCancelled: "Đã hủy thanh toán",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Ví của bạn"} không kết nối được với mạng ${network}, nên trang này chưa nhận được giao dịch nào. Đây là sự cố kết nối mạng của ví, không phải vấn đề với tiền của bạn. Nếu ví hiển thị giao dịch đã gửi, hãy chờ giao dịch được xác nhận trước khi thanh toán lại. Nếu không, hãy thanh toán từ ví khác hoặc sàn giao dịch, hoặc chọn mạng khác.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Ví của bạn"} trả về lỗi nội bộ và trang này chưa nhận được giao dịch nào. Nếu ví hiển thị giao dịch đã gửi, hãy chờ giao dịch được xác nhận trước khi thanh toán lại. Nếu không, bạn có thể thanh toán từ ví khác hoặc sàn giao dịch ở bên dưới.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Ví của bạn"} chưa hoàn tất giao dịch này. Nếu ví hiển thị giao dịch đã gửi, hãy chờ giao dịch được xác nhận trước khi thanh toán lại.`,
    payFromAnotherWallet: "Thanh toán từ ví khác hoặc sàn giao dịch",
    retryPayment: "Thử thanh toán lại",
  },
  ms: {
    titleRpcUnavailable: "Rangkaian Dompet Tidak Tersedia",
    titleWalletInternal: "Dompet Tidak Dapat Menghantar",
    titleCancelled: "Pembayaran Dibatalkan",
    bodyRpcUnavailable: ({ wallet, network }) =>
      `${wallet ?? "Dompet anda"} tidak dapat menyambung ke rangkaian ${network}, jadi halaman ini tidak menerima sebarang transaksi. Ini masalah sambungan rangkaian dompet, bukan masalah dana anda. Jika dompet anda menunjukkan transaksi telah dihantar, tunggu sehingga ia disahkan sebelum membayar semula. Jika tidak, bayar dari dompet lain atau bursa, atau pilih rangkaian lain.`,
    bodyWalletInternal: ({ wallet }) =>
      `${wallet ?? "Dompet anda"} memulangkan ralat dalaman dan halaman ini tidak menerima sebarang transaksi. Jika dompet anda menunjukkan transaksi telah dihantar, tunggu sehingga ia disahkan sebelum membayar semula. Jika tidak, anda boleh membayar dari dompet lain atau bursa di bawah.`,
    bodyOther: ({ wallet }) =>
      `${wallet ?? "Dompet anda"} tidak melengkapkan transaksi ini. Jika dompet anda menunjukkan transaksi telah dihantar, tunggu sehingga ia disahkan sebelum membayar semula.`,
    payFromAnotherWallet: "Bayar dari dompet lain atau bursa",
    retryPayment: "Cuba Bayar Semula",
  },
};

/** Maps a BCP 47 tag (e.g. "ru-RU", "zh-Hant-TW", "pt") to a covered language, or null. */
export function matchFailureCopyLanguage(
  tag: string | null | undefined,
): FailureCopyLanguage | null {
  if (typeof tag !== "string") return null;
  const t = tag.trim().toLowerCase().replace(/_/g, "-");
  if (!t) return null;
  const [primary, ...rest] = t.split("-");
  switch (primary) {
    case "zh":
      // Traditional script, or a region that uses it, gets zh-TW.
      return rest.some((p) => p === "hant" || p === "tw" || p === "hk" || p === "mo")
        ? "zh-TW"
        : "zh";
    case "pt":
      return "pt-BR";
    case "en":
    case "ru":
    case "es":
    case "ja":
    case "ko":
    case "id":
    case "vi":
    case "ms":
      return primary;
    case "in":
      // Legacy ISO 639 code for Indonesian, still reported by some Android WebViews.
      return "id";
    default:
      return null;
  }
}

/**
 * Picks the failed-state copy language.
 *
 * Order: the language the host explicitly passed → the browser's preferred
 * languages → English. A host language we do not cover yields English rather
 * than the browser language: the host chose the modal's language on purpose.
 *
 * `hostLanguage` must be the host's raw option, not the provider's merged
 * options (those always carry the "en-US" default).
 */
export function resolveFailureCopyLanguage(
  hostLanguage: string | null | undefined,
  browserLanguages: readonly (string | null | undefined)[] | null | undefined,
): FailureCopyLanguage {
  if (typeof hostLanguage === "string" && hostLanguage.trim()) {
    return matchFailureCopyLanguage(hostLanguage) ?? "en";
  }
  for (const tag of browserLanguages ?? []) {
    const lang = matchFailureCopyLanguage(tag);
    if (lang) return lang;
  }
  return "en";
}

/**
 * Reads the browser's preferred languages. Call only on the client (inside an
 * effect); returns [] when there is no `navigator`.
 */
export function readBrowserLanguages(): string[] {
  if (typeof navigator === "undefined" || navigator == null) return [];
  const list = Array.isArray(navigator.languages) ? [...navigator.languages] : [];
  if (typeof navigator.language === "string") list.push(navigator.language);
  return list;
}

export interface FailedStateCopy {
  title: string;
  /** null for user rejections: no body, same as before. */
  body: string | null;
  payFromAnotherWallet: string;
  retryPayment: string;
}

/** All payer-facing text of the PayWithToken failed state, in one language. */
export function failedStateCopy(
  failure: WalletFailure | null,
  opts: { language?: FailureCopyLanguage; walletName?: string | null; networkName: string },
): FailedStateCopy {
  const s = STRINGS[opts.language ?? "en"] ?? STRINGS.en;
  const params: CopyParams = {
    wallet: opts.walletName?.trim() || null,
    network: opts.networkName,
  };
  let title = s.titleCancelled;
  let body: string | null = null;
  if (failure?.kind === "wallet_internal") {
    title = failure.rpcUnavailable ? s.titleRpcUnavailable : s.titleWalletInternal;
    body = failure.rpcUnavailable ? s.bodyRpcUnavailable(params) : s.bodyWalletInternal(params);
  } else if (failure && failure.kind !== "user_rejected") {
    body = s.bodyOther(params);
  }
  return {
    title,
    body,
    payFromAnotherWallet: s.payFromAnotherWallet,
    retryPayment: s.retryPayment,
  };
}

/** Exposed for tests: every covered language. */
export const FAILURE_COPY_LANGUAGES = Object.keys(STRINGS) as FailureCopyLanguage[];
