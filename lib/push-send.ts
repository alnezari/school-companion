import webpush from "web-push";

export interface PushSubscriptionRow { endpoint: string; p256dh: string; auth: string }
export interface PushPayload { title: string; body: string; url: string; tag: string }

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID keys are not set in Vercel.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:tomorrow-first-app@example.com", pub, priv);
  configured = true;
}

/** Sends to every subscription; returns the endpoints that are dead (unsubscribed/expired) so the caller can drop them. */
export async function sendToAll(subs: PushSubscriptionRow[], payload: PushPayload): Promise<string[]> {
  ensureConfigured();
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    })
  );
  return dead;
}
