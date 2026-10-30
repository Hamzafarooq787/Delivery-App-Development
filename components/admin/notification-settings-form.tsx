"use client";
import { useEffect, useState } from "react";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/app/actions/notification-settings";
const keys = [
  "new-delivery",
  "delivery-accepted",
  "delivery-collected",
  "delivery-in-transit",
  "delivery-cancelled",
  "delivered",
  "bfm-stage",
  "bfm-sub",
  "bfm-purchased",
];
export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<Record<
      string,
      { enabled: boolean; title: string }
    > | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    getNotificationSettings().then((r) => {
      if (r.error) setMessage(r.error);
      else
        setSettings(
          Object.fromEntries(
            keys.map((k) => [
              k,
              r.settings?.[k] ?? { enabled: true, title: "" },
            ]),
          ),
        );
    });
  }, []);
  return (
    <div className="rounded-xl bg-[var(--brand-panel)] p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">
        Push notification settings
      </h2>
      <p className="text-sm text-white">
        Email and SMS delivery templates are not enabled. Titles below override
        push titles; leave blank to use the standard title. Customer device
        preferences still apply.
      </p>
      {settings &&
        keys.map((k) => (
          <div key={k} className="flex gap-3 flex-wrap items-center text-white">
            <label>
              <input
                type="checkbox"
                checked={settings[k].enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    [k]: { ...settings[k], enabled: e.target.checked },
                  })
                }
              />{" "}
              {k.replaceAll("-", " ")}
            </label>
            <input
              aria-label={`${k} title`}
              placeholder="Standard title"
              maxLength={100}
              className="bg-[var(--brand-bg)] border border-white/20 rounded p-2"
              value={settings[k].title}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  [k]: { ...settings[k], title: e.target.value },
                })
              }
            />
          </div>
        ))}
      <p role="status" className="text-white">
        {message}
      </p>
      <button
        disabled={!settings || busy}
        className="rounded bg-[var(--brand-strong)] text-black px-4 py-2 disabled:opacity-50"
        onClick={async () => {
          if (!settings) return;
          setBusy(true);
          try {
            const r = await saveNotificationSettings(settings);
            setMessage(r.error ?? "Notification settings saved.");
          } catch {
            setMessage("Unable to save. Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save push settings
      </button>
    </div>
  );
}
