"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Landing point after Stripe Checkout (success_url). Confirms the session
 * with our API, then clears the query string.
 */
export function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const res = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "stripe", sessionId }),
      });
      if (res.ok) {
        toast.success("You are on Pro. Everything is unlocked.");
      } else {
        toast.error("Payment could not be verified. Contact support if you were charged.");
      }
      router.replace("/pricing");
      router.refresh();
    })();
  }, [router, sessionId]);

  return null;
}
