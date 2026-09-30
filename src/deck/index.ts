// @internal/reference-window/deck：牌组模型 + 清单编解码。零 DOM。
// created 2026-09-29 by Claude Fable 5.1

export { createDeck } from "./deck.ts";
export type {
  Card, CardKind, CardPlay, CardView, CarriedItem, Deck, DeckChange, DeckRestore, DeckSnapshot, NewCard,
} from "./deck.ts";
export { decodeDeck, encodeDeck, extForMime, mimeForName, DECK_MANIFEST_VERSION } from "./manifest.ts";
export type { DecodedDeck, DecodeOptions, DeckManifest, EncodeOptions, ManifestItem } from "./manifest.ts";
