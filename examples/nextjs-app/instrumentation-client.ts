import { APP_NAME } from "@/lib/analytics/events"
import posthog from "posthog-js"

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2026-05-30",
    capture_pageview: false,
  })

  posthog.register({ app_name: APP_NAME })
}
