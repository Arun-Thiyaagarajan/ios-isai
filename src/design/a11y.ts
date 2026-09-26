import { useEffect, useState } from 'react';
import { AccessibilityInfo, type AccessibilityChangeEventName } from 'react-native';

function useAccessibilityFlag(
  read: () => Promise<boolean>,
  event: AccessibilityChangeEventName,
): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    read().then((value) => mounted && setEnabled(value));
    const sub = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [read, event]);

  return enabled;
}

/** True when the user asked the OS to minimize motion. Animations become crossfades or nothing. */
export function useReducedMotion(): boolean {
  return useAccessibilityFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');
}

/** iOS "Reduce Transparency". Glass surfaces render solid when this is on (always false on Android). */
export function useReduceTransparency(): boolean {
  return useAccessibilityFlag(
    AccessibilityInfo.isReduceTransparencyEnabled,
    'reduceTransparencyChanged',
  );
}
