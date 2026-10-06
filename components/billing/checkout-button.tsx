"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PlanKey = "pro_monthly" | "pro_yearly";

type RazorpayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
};

type CheckoutResponse =
  | {
      mode: "razorpay";
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      plan: PlanKey;
    }
  | { mode: "stripe"; url: string; plan: PlanKey }
  | { mode: "waitlist"; plan: PlanKey };

function loadRazorpayScript(): Promise<boolean> {
  const w = window as RazorpayWindow;
  if (w.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function verifyPayment(body: Record<string, string>): Promise<boolean> {
  const res = await fetch("/api/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function CheckoutButton({
  plan,
  children,
  ...buttonProps
}: {
  plan: PlanKey;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children" | "render">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPending, setWaitlistPending] = useState(false);

  async function startCheckout() {
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        router.push(`/signup?next=${encodeURIComponent("/pricing")}`);
        return;
      }
      const data = (await res.json().catch(() => null)) as CheckoutResponse | null;
      if (!res.ok || !data) {
        toast.error("Could not start checkout. Please try again.");
        return;
      }

      if (data.mode === "waitlist") {
        setWaitlistOpen(true);
        return;
      }

      if (data.mode === "stripe") {
        window.location.href = data.url;
        return;
      }

      const loaded = await loadRazorpayScript();
      const Razorpay = (window as RazorpayWindow).Razorpay;
      if (!loaded || !Razorpay) {
        toast.error("Payment window failed to load. Please try again.");
        return;
      }
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "Vovingo",
        description: plan === "pro_monthly" ? "Pro monthly" : "Pro annual",
        theme: { color: "#6d5ef2" },
        handler: async (response: Record<string, string>) => {
          const ok = await verifyPayment({
            provider: "razorpay",
            orderId: response.razorpay_order_id ?? data.orderId,
            paymentId: response.razorpay_payment_id ?? "",
            signature: response.razorpay_signature ?? "",
          });
          if (ok) {
            toast.success("You are on Pro. Everything is unlocked.");
            router.refresh();
          } else {
            toast.error("Payment could not be verified. Contact support if you were charged.");
          }
        },
        modal: {
          ondismiss: () => toast.info("Checkout canceled."),
        },
      });
      checkout.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setWaitlistPending(true);
    try {
      const res = await fetch("/api/billing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail }),
      });
      if (res.ok) {
        setWaitlistOpen(false);
        toast.success("You are on the list. We will email you when Pro opens.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not join the list.");
      }
    } finally {
      setWaitlistPending(false);
    }
  }

  return (
    <>
      <Button
        {...buttonProps}
        disabled={pending || buttonProps.disabled}
        onClick={() => void startCheckout()}
      >
        {pending ? "Please wait…" : children}
      </Button>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pro payments open soon</DialogTitle>
            <DialogDescription>
              Card payments are not live yet on this build. Leave your email and you will be first
              in line when Pro billing switches on.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={joinWaitlist} className="mt-2 space-y-3">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              aria-label="Email"
            />
            <Button type="submit" className="w-full" disabled={waitlistPending}>
              {waitlistPending ? "Joining…" : "Join the waitlist"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
