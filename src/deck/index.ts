// @internal/reference-window/deck：牌组模型 + 清单编解码。零 DOM。
// created 2026-09-29 by Claude Fable 5.1

export { createDeck } from "./deck.ts";
export type {
  Card, CardKind, CardPlay, CardView, CarriedItem, Deck, DeckChange, DeckRestore, DeckSnapshot, NewCard,
} from "./deck.ts";
export {
  decodeDeck, decodeDeckFromJson, encodeDeck, migrateDeckManifest, deckDir, extForMime, mimeForName,
  DeckManifestTooNewError, DECK_MANIFEST_VERSION, DECK_MANIFEST_NAME,
  // 0.5.0 清单拍子（major.minor.patch；家族格式版本纪律）
  DECK_MANIFEST_STAMP, readDeckStamp, compareDeckStamp,
} from "./manifest.ts";
export type { DecodedDeck, DecodeOptions, DeckManifest, EncodeOptions, ManifestItem, DeckStamp, DeckManifestVerdict } from "./manifest.ts";
export { importIntoDeck, sniffKind, DEFAULT_RAM } from "./import.ts";
export type { RefImportKind, RefTranscoder, RefImportQuestion, RefImportChoice, RefImportOptions, RefImportSkip, RefImportResult } from "./import.ts";
