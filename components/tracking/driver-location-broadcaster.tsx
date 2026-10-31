"use client";
import { useEffect, useState } from "react";
import { updateMyLocation, clearMyLocation } from "@/app/actions/tracking";
type Props = {
  deliveryId?: string | null;
  disabled?: boolean;
  intervalMs?: number;
  showStatus?: boolean;
  className?: string;
};
type Status =
  | "idle"
  | "requesting"
  | "sharing"
  | "denied"
  | "unsupported"
  | "offline"
  | "error";
/** Foreground GPS with reconnect recovery. Browsers cannot guarantee background tracking. */
export function DriverLocationBroadcaster({
  deliveryId = null,
  disabled = false,
  intervalMs = 3000,
  showStatus = true,
  className,
}: Props) {
  const [status, setStatus] = useState<Status>("idle"),
    [lastPing, setLastPing] = useState<number | null>(null),
    [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true,
      watch: number | null = null,
      inFlight = false,
      lastSent = 0,
      wake: WakeLockSentinel | null = null,
      registration: ServiceWorkerRegistration | null = null;
    const post = (message: object) =>
      registration?.active?.postMessage(message);
    if (disabled || !deliveryId) {
      setStatus("idle");
      if (deliveryId) void clearMyLocation(deliveryId);
      return;
    }
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    setLastPing(null);
    async function keepAwake() {
      if (
        document.visibilityState !== "visible" ||
        !("wakeLock" in navigator) ||
        wake
      )
        return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!alive) {
          await lock.release();
          return;
        }
        wake = lock;
        lock.addEventListener("release", () => {
          if (wake === lock) wake = null;
        });
      } catch {
        /* UI always explains the foreground requirement. */
      }
    }
    function onError(error: GeolocationPositionError) {
      if (!alive) return;
      setStatus(error.code === 1 ? "denied" : "error");
      if (error.code === 1) {
        post({ type: "STOP" });
        if (watch !== null) navigator.geolocation.clearWatch(watch);
        watch = null;
      }
    }
    async function onPosition(position: GeolocationPosition) {
      if (!alive || inFlight || Date.now() - lastSent < intervalMs) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (Date.now() - position.timestamp > 45000) {
        setStatus("error");
        return;
      }
      lastSent = Date.now();
      inFlight = true;
      const payload = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
        delivery_id: deliveryId,
        measured_at: new Date(position.timestamp).toISOString(),
      };
      try {
        const result = await updateMyLocation(payload);
        if (!alive) return;
        if (result.error) {
          setStatus("error");
          return;
        }
        setStatus("sharing");
        setLastPing(position.timestamp);
        post({ type: "LOCATION", payload });
      } catch {
        if (alive) setStatus(navigator.onLine ? "error" : "offline");
      } finally {
        inFlight = false;
      }
    }
    function resume() {
      if (!alive || document.visibilityState !== "visible") return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      void keepAwake();
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      watch = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      });
      navigator.geolocation.getCurrentPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      });
    }
    function offline() {
      setStatus("offline");
      post({ type: "STOP" });
    }
    resume();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw-location.js", { scope: "/sw-location/" })
        .then((reg) => {
          if (!alive) return;
          registration = reg;
          post({ type: "START" });
        })
        .catch(() => {});
    const timer = setInterval(
      () => {
        if (
          alive &&
          navigator.onLine &&
          document.visibilityState === "visible" &&
          watch !== null
        )
          navigator.geolocation.getCurrentPosition(onPosition, onError, {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000,
          });
      },
      Math.max(6000, intervalMs * 2),
    );
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    return () => {
      alive = false;
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
      void wake?.release().catch(() => {});
      post({ type: "STOP" });
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
    };
  }, [deliveryId, disabled, intervalMs, retry]);
  if (!showStatus) return null;
  const fresh =
    status === "sharing" && lastPing !== null && now - lastPing < 45000;
  const labels: Record<Status, string> = {
    idle: "Location off",
    requesting: "Requesting GPS…",
    sharing: fresh ? "Sharing location" : "GPS signal stale — retrying",
    denied: "Allow location in your browser settings, then retry.",
    unsupported: "GPS is unavailable on this device.",
    offline: "Offline — reconnect to share location.",
    error: "Location unavailable — retrying.",
  };
  return (
    <div
      className={`max-w-[min(320px,90vw)] rounded-xl border border-white/15 bg-[var(--brand-panel)] px-3 py-2 text-white ${className ?? ""}`}
      role="status"
    >
      <p className="text-xs">
        <span
          className={`mr-2 inline-block h-2 w-2 rounded-full ${fresh ? "bg-green-400" : "bg-amber-400"}`}
        />
        {labels[status]}
      </p>
      {status !== "idle" && (
        <p className="mt-1 text-[10px]">
          Keep GoDrop open during the job. Background GPS may pause.
        </p>
      )}
      {["denied", "error", "unsupported"].includes(status) && (
        <button
          type="button"
          onClick={() => setRetry((n) => n + 1)}
          className="mt-1 min-h-9 text-xs underline"
        >
          Retry location
        </button>
      )}
    </div>
  );
}
