export type Languages =
  | "ar-AE"
  | "en-US"
  | "ee-EE"
  | "es-ES"
  | "fa-IR"
  | "fr-FR"
  | "ja-JP"
  | "pt-BR"
  | "zh-CN"
  | "ca-AD"
  | "ru-RU"
  | "zh-CN"
  | "tr-TR"
  | "vi-VN";

import { default as arAE } from "./locales/ar-AE";
import { default as caAD } from "./locales/ca-AD";
import { default as eeEE } from "./locales/ee-EE";
import { default as enUS } from "./locales/en-US";
import { default as esES } from "./locales/es-ES";
import { default as faIR } from "./locales/fa-IR";
import { default as frFR } from "./locales/fr-FR";
import { default as jaJP } from "./locales/ja-JP";
import { default as ptBR } from "./locales/pt-BR";
import { default as ruRU } from "./locales/ru-RU";
import { default as trTR } from "./locales/tr-TR";
import { default as viVN } from "./locales/vi-VN";
import { default as zhCN } from "./locales/zh-CN";

// TODO: tree-shaking
export const getLocale = (lang: Languages) => {
  switch (lang) {
    case "ee-EE":
      return eeEE;
    case "ar-AE":
      return arAE;
    case "es-ES":
      return esES;
    case "fa-IR":
      return faIR;
    case "fr-FR":
      return frFR;
    case "ja-JP":
      return jaJP;
    case "pt-BR":
      return ptBR;
    case "ru-RU":
      return ruRU;
    case "zh-CN":
      return zhCN;
    case "ca-AD":
      return caAD;
    case "tr-TR":
      return trTR;
    case "vi-VN":
      return viVN;
    default:
      return enUS;
  }
};
