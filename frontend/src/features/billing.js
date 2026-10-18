import api from "../lib/api";

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    amount: 199,
    credits: 500,
    tagline: "For steady builders",
    perks: [
      "500 credits / month",
      "All six agents",
      "Live code sandbox",
      "PDF, PPTX and image exports",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    amount: 499,
    credits: 1000,
    tagline: "For power users",
    highlighted: true,
    perks: [
      "1,000 credits / month",
      "Priority agent queue",
      "Longer document context",
      "Commercial usage rights",
    ],
  },
];

async function createOrder(plan) {
  const { data } = await api.post("/api/billing/create", { plan });
  return data;
}

async function verifyPayment(payload) {
  const { data } = await api.post("/api/billing/verify", payload);
  return data;
}

function loadRazorpay() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay checkout, then verifies the signature on the server.
 * Resolves with the verified payment result so the caller can refresh credits.
 */
export async function openCheckout({ plan, onSuccess, onFailure }) {
  const loaded = await loadRazorpay();
  if (!loaded) throw new Error("Could not load the payment window. Check your connection.");

  const order = await createOrder(plan);

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.order.amount,
      currency: order.order.currency,
      name: "QuorvexAI",
      description: `${order.plan.name} plan — ${order.plan.credits} credits`,
      order_id: order.order.id,
      theme: { color: "#8B5CF6" },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
      handler: async (response) => {
        try {
          const result = await verifyPayment(response);
          onSuccess?.(result);
          resolve(result);
        } catch (error) {
          onFailure?.(error);
          reject(error);
        }
      },
    });

    checkout.open();
  });
}
