import { smokeRoute } from "./_smoke";

smokeRoute("/checkout", {
  pathname: "/checkout",
  title: /Rozo Pay Playground/,
  h1: /Rozo Intent SDK Playground/,
});
