import { createContext, useContext } from "react";
import type { TrackingContext } from "./tracker";

export type PostTracking = (Partial<TrackingContext> & { track?: boolean }) | null;

export const FeedTrackingContext = createContext<PostTracking>(null);

export function usePostTracking() {
  return useContext(FeedTrackingContext);
}
