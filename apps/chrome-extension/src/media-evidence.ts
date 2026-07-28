export type MediaType = "image" | "video" | "audio" | "document" | "sticker";

export function classifyMediaEvidence(evidence: {
  video: boolean;
  audio: boolean;
  document: boolean;
  sticker: boolean;
  image: boolean;
}): MediaType | undefined {
  if (evidence.video) return "video";
  if (evidence.audio) return "audio";
  if (evidence.document) return "document";
  if (evidence.sticker) return "sticker";
  if (evidence.image) return "image";
  return undefined;
}
