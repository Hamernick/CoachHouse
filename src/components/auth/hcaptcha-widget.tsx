"use client"

import { useEffect, useState } from "react"
import HCaptcha from "@hcaptcha/react-hcaptcha"
import { useTheme } from "next-themes"

import { clientEnv } from "@/lib/env"

type HCaptchaWidgetProps = {
  captchaRef: React.RefObject<HCaptcha | null>
  onError: (message: string) => void
  onExpire: () => void
  onVerify: (token: string) => void
  size?: "normal" | "compact"
}

export function HCaptchaWidget({
  captchaRef,
  onError,
  onExpire,
  onVerify,
  size = "normal",
}: HCaptchaWidgetProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!clientEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) {
    return null
  }

  return (
    <HCaptcha
      ref={captchaRef}
      sitekey={clientEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
      size={size}
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      onVerify={(token) => onVerify(token)}
      onExpire={onExpire}
      onError={() => onError("We could not load the security check. Refresh and try again.")}
    />
  )
}
