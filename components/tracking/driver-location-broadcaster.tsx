"use client";
import { canRequestDriverLocation, rememberDriverLocationDenial } from "@/lib/driver-location-permission"
import { driverLocationPayload, rememberSharedDriverLocation, validDriverPosition } from "@/lib/driver-milestone-location"
import { isFreshLocation } from "@/lib/tracking-utils"
import { shortRequest } from "@/lib/short-request"
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
  | "error"
  | "sync-error";
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
      resuming = false,
      lastSent = 0,
      lastPublished = 0,
      requestingFix = false,
      permissionDenied = false,
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
    const jobId = deliveryId
    function preserveFresh(fallback: Status) {
      setStatus(isFreshLocation(lastPublished) ? "sharing" : fallback)
    }
    function onError(error: GeolocationPositionError) {
      if (!alive) return;
      if (error.code === 1) setStatus("denied"); else preserveFresh("error");
      if (error.code === 1) {
        permissionDenied = true;
        rememberDriverLocationDenial()
        post({ type: "STOP" });
        if (watch !== null) navigator.geolocation.clearWatch(watch);
        watch = null;
      }
    }
    async function onPosition(position: GeolocationPosition) {
      if (!alive || permissionDenied || inFlight || position.timestamp <= lastPublished || Date.now() - lastSent < intervalMs) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (!validDriverPosition(position)) {
        preserveFresh("error");
        return;
      }
      lastSent = Date.now();
      inFlight = true;
      const payload = driverLocationPayload(position, jobId);
      try {
        const result = await shortRequest(updateMyLocation(payload),11000);
        if (!alive || permissionDenied) return;
        if (result.error) {
          preserveFresh("sync-error");
          return;
        }
        lastPublished = position.timestamp;
        rememberSharedDriverLocation(jobId, lastPublished);
        setStatus("sharing");
        setLastPing(lastPublished);
        post({ type: "LOCATION", payload });
      } catch {
        if (alive) { if (navigator.onLine) preserveFresh("sync-error"); else setStatus("offline"); }
      } finally {
        inFlight = false;
      }
    }
    async function resume() {
      if (!alive || resuming || document.visibilityState !== "visible") return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (watch !== null) {
        preserveFresh("requesting");
        post({ type: "START" });
        void keepAwake(); return;
      }
      resuming = true
      const allowed = await canRequestDriverLocation(true)
      resuming = false
      if (!alive || document.visibilityState !== "visible") return
      if (!allowed) { setStatus("denied"); return }
      permissionDenied = false;
      void keepAwake();
      watch = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 15000,
      });
    }
    function offline() {
      setStatus("offline");
      post({ type: "STOP" });
    }
    void resume();
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
          watch !== null && !requestingFix
        ) {
          requestingFix = true;
          navigator.geolocation.getCurrentPosition(position => {
            requestingFix = false; void onPosition(position);
          }, error => {
            requestingFix = false; onError(error);
          }, { enableHighAccuracy: false, maximumAge: 10000, timeout: 6000 });
        }
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
    status === "sharing" && isFreshLocation(lastPing, now);
  const labels: Record<Status, string> = {
    idle: "Location off",
    requesting: "Requesting GPS…",
    sharing: fresh ? "Sharing location" : "GPS location out of date — retrying",
    denied: "Allow location in your browser settings, then retry.",
    unsupported: "GPS is unavailable on this device.",
    offline: "Offline — reconnect to share location.",
    "sync-error": "A location was found but could not be shared. Tap Retry location.",
    error: "GPS fix unavailable. Keep this page open, or tap Retry location.",
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
      {(["denied", "error", "unsupported", "sync-error"].includes(status) || (status === "sharing" && !fresh)) && (
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
