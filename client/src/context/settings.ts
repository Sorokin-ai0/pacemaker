import { createContext, useContext } from "react";

/** Display-only preferences (persisted locally; see SettingsProvider). */
export interface DisplaySettings {
  /** Show speed (mph / km/h) instead of pace (m:ss per mi/km). */
  showSpeed: boolean;
  /** Show heart-rate fields in run logging and run cards. */
  showHeartRate: boolean;
}

export interface SettingsContextValue extends DisplaySettings {
  setShowSpeed: (value: boolean) => void;
  setShowHeartRate: (value: boolean) => void;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showSpeed: false,
  showHeartRate: true,
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useDisplaySettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useDisplaySettings must be used within SettingsProvider");
  return ctx;
}
