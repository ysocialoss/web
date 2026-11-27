import { z } from "zod/mini";

export const navigationItemSchema = z.enum([
  "feed",
  "following",
  "search",
  "messages",
  "activity",
  "communities",
  "profile",
  "saved",
]);

export type NavigationItem = z.infer<typeof navigationItemSchema>;

export const navigationItemsSchema = z._default(z.nullable(z.pipe(z
  .array(z.string()), z.transform((items) => {
    const known = items.flatMap((item) => {
      const itemId = navigationItemSchema.safeParse(item);
      return itemId.success ? [itemId.data] : [];
    });
    return [...new Set(known)];
  }))), null);
