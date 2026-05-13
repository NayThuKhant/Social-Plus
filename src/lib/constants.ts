export const MediaType = {
  IMAGE: "image",
  VIDEO: "video",
  GIF: "gif",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];
