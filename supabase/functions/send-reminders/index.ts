// Supabase Edge Function: send-reminders
// pg_cron tarafından her dakika çağrılır.
// O anki saate denk gelen habit hatırlatmalarını Web Push ile gönderir.
//
// Gerekli Supabase Secrets (Dashboard → Edge Functions → Manage Secrets):
//   VAPID_PUBLIC_KEY   = BJzqru9UuJbj17cHlLBuUZtBiEEI1tKZXvhz6wgirLk6c2Zz3RNTrNitFveHxpxiHnge2Fn5IqWThW61olCRc9Y
//   VAPID_PRIVATE_KEY  = 7N2zlNMz3D3I1s5-wFfKdvTfn_yIA85UXBcjj5mX3DM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY          = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY         = Deno.env.get("VAPID_PRIVATE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Motive edici mesaj havuzu ────────────────────────────────────────────────

const MOTIVATION = [
  "Bugün küçük bir adım, yarın büyük bir zincir. Hadi başla! 🔥",
  "Zincirini kırma — sadece bir dakikanı ayır. 💪",
  "Küçük ama düzenli. En iyi versiyonuna bir adım daha. ⭐",
  "Sadece başla; gerisi kendiliğinden gelir. 🚀",
  "Bugünün seni yarın gururlandıracak. 🏆",
  "Motivasyon değil, disiplin. Şimdi tam zamanı. ⚡",
  "Kendine verdiğin sözü tut. Zincirin seninle gurur duysun. 🔗",
  "İki dakika. Sadece iki dakika ayır, yeter. ⏱️",
  "Zincirin uzuyor — bugünü de ekle! 🌱",
  "Küçük tutarlılık, büyük dönüşüm. ✨",
];

function pickMessage(habitTitle: string): string {
  const msg = MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
  return `${habitTitle} — ${msg}`;
}

// ─── VAPID JWT imzalama ──────────────────────────────────────────────────────

function base64urlToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeVapidJWT(audience: string): Promise<string> {
  const header  = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:info@aliskanlik101.app",
  };

  const enc = (obj: object) =>
    uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(obj)));

  const signing = `${enc(header)}.${enc(payload)}`;

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    (() => {
      // raw base64url → PKCS8 DER wrapper for P-256
      const raw = base64urlToUint8Array(VAPID_PRIVATE_KEY);
      const prefix = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
        0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
        0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
        0x01, 0x04, 0x20,
      ]);
      const combined = new Uint8Array(prefix.length + raw.length);
      combined.set(prefix); combined.set(raw, prefix.length);
      return combined.buffer;
    })(),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(signing)
  );

  return `${signing}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;
}

// ─── Tek bir cihaza push gönderme ─────────────────────────────────────────────

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ ok: boolean; gone?: boolean }> {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await makeVapidJWT(audience);

  // RFC 8291 — uygulamanın kendi şifrelemesi yerine FCM/vapid şifrelemesini kullanıyoruz
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body: payload,
  });

  if (res.status === 410 || res.status === 404) return { ok: false, gone: true };
  return { ok: res.ok };
}

// ─── Saat dönüştürücü ─────────────────────────────────────────────────────────

function currentHHMM(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// ─── Ana handler ──────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const { data: reminders, error } = await supabase
    .from("habit_reminders")
    .select("device_id, habit_id, habit_title, reminder_time, timezone");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Şu anda zamanı gelen hatırlatmaları filtrele
  const due = (reminders ?? []).filter(
    (r) => r.reminder_time === currentHHMM(r.timezone || "Europe/Istanbul")
  );

  if (due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, checked: reminders?.length ?? 0 }), { status: 200 });
  }

  const deviceIds = [...new Set(due.map((d) => d.device_id))];
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("device_id", deviceIds);

  let sent = 0;
  const gone: string[] = [];

  for (const reminder of due) {
    const sub = subs?.find((s) => s.device_id === reminder.device_id);
    if (!sub) continue;

    const payload = JSON.stringify({
      title:   "Zincir ⏰",
      body:    pickMessage(reminder.habit_title),
      habitId: reminder.habit_id,
    });

    try {
      const result = await sendPush(sub, payload);
      if (result.gone) {
        gone.push(sub.device_id);
      } else if (result.ok) {
        sent++;
      }
    } catch (err) {
      console.error("push error", reminder.device_id, err);
    }
  }

  // Geçersiz subscription'ları temizle
  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("device_id", gone);
  }

  return new Response(JSON.stringify({ sent, gone: gone.length }), { status: 200 });
});
