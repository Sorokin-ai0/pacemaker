import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_DISPLAY_SETTINGS,
  SettingsContext,
  type DisplaySettings,
  type SettingsContextValue,
} from "@/context/settings";
import { storage, storageKeys } from "@/local/storageAdapter";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(() => ({
    ...DEFAULT_DISPLAY_SETTINGS,
    ...(storage.getJSON<Partial<DisplaySettings>>(storageKeys.displaySettings) ?? {}),
  }));

  const update = useCallback((patch: Partial<DisplaySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      storage.setJSON(storageKeys.displaySettings, next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setShowSpeed: (showSpeed) => update({ showSpeed }),
      setShowHeartRate: (showHeartRate) => update({ showHeartRate }),
    }),
    [settings, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
