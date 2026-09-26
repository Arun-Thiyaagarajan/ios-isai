import { create } from 'zustand';

export type ScanStatus =
  /** Nothing has run yet this session. */
  | 'idle'
  | 'scanning'
  | 'done'
  /** Android: the user hasn't granted access to audio files. */
  | 'needsPermission'
  | 'error';

type ScanState = {
  status: ScanStatus;
  /** Songs found or updated so far in the current scan. */
  found: number;
  /** Plain-language description of the current step, for the progress UI. */
  step: string | null;
  error: string | null;
  /** Folders that couldn't be opened in the last scan (iOS). */
  unavailableFolders: string[];
  lastScanAt: number | null;
};

export const useScanStore = create<ScanState>()(() => ({
  status: 'idle',
  found: 0,
  step: null,
  error: null,
  unavailableFolders: [],
  lastScanAt: null,
}));
