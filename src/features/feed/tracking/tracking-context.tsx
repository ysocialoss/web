import { createContext, useContext } from "react";
import type { FeedReason } from "@/lib/api";
import type { TrackingContext } from "./tracker";

export type PostTracking = (Partial<TrackingContext> & { track?: boolean; reason?: FeedReason }) | null;

export const FeedTrackingContext = createContext<PostTracking>(null);

export function usePostTracking() {
  return useContext(FeedTrackingContext);
}
