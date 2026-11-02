import { parsePost, request } from "~/lib/posts";

export type ProfileData = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  createdAt: string;
};
export async function loadProfile(handle: string, signal: AbortSignal) {
  const body = await request(`/api/profiles/${encodeURIComponent(handle)}`, {
    signal,
  });
  if (
    typeof body !== "object" ||
    body === null ||
    !("profile" in body) ||
    typeof body.profile !== "object" ||
    body.profile === null ||
    !("posts" in body) ||
    !Array.isArray(body.posts) ||
    !("serverNow" in body) ||
    typeof body.serverNow !== "string" ||
    !Number.isFinite(Date.parse(body.serverNow))
  )
    throw new Error("Invalid profile response.");
  const profile = body.profile;
  if (
    !("id" in profile) ||
    typeof profile.id !== "string" ||
    !("handle" in profile) ||
    typeof profile.handle !== "string" ||
    !("displayName" in profile) ||
    typeof profile.displayName !== "string" ||
    !("bio" in profile) ||
    typeof profile.bio !== "string" ||
    !("createdAt" in profile) ||
    typeof profile.createdAt !== "string" ||
    !Number.isFinite(Date.parse(profile.createdAt))
  )
    throw new Error("Invalid profile response.");
  return {
    profile: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      createdAt: profile.createdAt,
    },
    posts: body.posts.map(parsePost),
    serverNow: body.serverNow,
  };
}
