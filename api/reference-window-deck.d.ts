export declare interface Card {
    /** 牌组内不透明 id。不持久化：每次 restore / add 重新发。 */
    readonly id: string;
    kind: CardKind;
    /** 文件名或首行。 */
    name: string;
    /** 字节，总是随文档保存。null 只出现在零字节的卡（如 "live"）或文件损坏缺字节时。 */
    bytes: Blob | null;
    mime: string;
    /** 宿主自己解析的不透明引用（"live" 卡：哪块画布 / 哪台相机）。库不解释。 */
    target: string | null;
    vp: CardView | null;
    play: CardPlay | null;
    /** 来历标记，平铺不套层。目前只有 "genai"。 */
    origin: string | null;
}

/** 卡片种类是开放集。库自带的种类名见各 kinds 入口；宿主可以登记自己的。 */
export declare type CardKind = string;

/** 音视频的播放位置。 */
export declare interface CardPlay {
    t: number;
    loop: boolean;
}

/** 每张卡自己的视图状态。图片：平移 / 缩放 / 旋转。文字：scale = 字号倍率，ty = 滚动位置。 */
export declare interface CardView {
    tx: number;
    ty: number;
    scale: number;
    rot: number;
}

/** 这个宿主不认识的卡：清单条目和它引用的字节原样带着。 */
export declare interface CarriedItem {
    /** 它在清单里原来排第几张（写回时尽量放回原位）。 */
    at: number;
    /** 清单条目原文（JSON）。 */
    item: Record<string, unknown>;
    /** 条目引用的字节（按清单里的 src）。 */
    files: {
        src?: Blob;
    };
}

export declare function createDeck(): Deck;

export declare interface Deck {
    readonly size: number;
    readonly index: number;
    readonly current: Card | null;
    cards(): readonly Card[];
    get(id: string): Card | null;
    indexOf(id: string): number;
    snapshot(): DeckSnapshot;
    /** 载入恢复专用：整副换掉。返回新发的 id（顺序 = cards 顺序）。只发 "reset"。 */
    restore(s: DeckRestore): string[];
    /** 清空（换文档 / 重置）。只发 "reset"。 */
    clear(): void;
    /** 加一张卡。select 缺省 true = 加完翻到它。 */
    add(card: NewCard, opts?: {
        select?: boolean;
    }): string;
    remove(id: string): void;
    /** 挪到第 toIndex 张（越界自动钳）。当前看的那张卡跟着走，不会因为挪动而换成别的卡。 */
    move(id: string, toIndex: number): void;
    select(index: number): void;
    setView(id: string, vp: CardView): void;
    setPlay(id: string, play: CardPlay): void;
    /** 改链接卡指向谁（宿主的页改了名）。内容变了 → 通知 "cards"；视图该重取内容。 */
    setTarget(id: string, target: string | null): void;
    invalidate(id: string): void;
    onChange(fn: (what: DeckChange) => void): () => void;
}

export declare const DECK_MANIFEST_NAME = "manifest.json";

export declare const DECK_MANIFEST_VERSION = 1;

export declare type DeckChange = 
/** 增 / 删 / 挪：牌组内容变了，宿主应标脏。 */
    {
    type: "cards";
}
/** 翻页 / 平移缩放 / 滚动 / 播放位置：只是看法变了。标不标脏归宿主。 */
| {
    type: "view";
}
/** "live" 卡：宿主报「内容变了」，何时真去要一帧由视图定。 */
| {
    type: "invalidate";
    id: string;
}
/** restore / clear 之后整副牌换了：视图该整个重画。不是用户改动，宿主不应据此标脏。 */
| {
    type: "reset";
};

/** 参考窗在容器里住的目录（不带尾斜杠）。 */
export declare function deckDir(app: string): string;

export declare interface DeckManifest {
    version: number;
    index: number;
    items: ManifestItem[];
}

/** 清单版本比这个库新：不降级、不猜，报出去。 */
export declare class DeckManifestTooNewError extends Error {
    readonly fileVersion: number;
    readonly libVersion: number;
    constructor(fileVersion: number, libVersion: number);
}

/** restore 的入参：卡可以不带 id（载入时本来就没有）。 */
export declare interface DeckRestore {
    index?: number;
    cards: readonly NewCard[];
    carried?: readonly CarriedItem[];
}

export declare interface DeckSnapshot {
    index: number;
    cards: Card[];
    carried: CarriedItem[];
}

/** 解码结果可以直接喂 Deck.restore()。 */
export declare interface DecodedDeck {
    index: number;
    cards: NewCard[];
    carried: CarriedItem[];
}

/** 从容器里读回牌组。目录里没有 manifest.json → 空牌组（不是错）。清单不是合法 JSON → 抛错（不静默当空）。 */
export declare function decodeDeck(o: DecodeOptions): Promise<DecodedDeck>;

/** 清单已经在手上（宿主从别处搬来的、或测试）时用这个。 */
export declare function decodeDeckFromJson(manifestJson: unknown, o: Pick<DecodeOptions, "knownKinds" | "getFile">): DecodedDeck;

export declare interface DecodeOptions {
    app: string;
    /** 这个宿主画得出来的种类。其余的原样带着。 */
    knownKinds: readonly string[];
    /** 按文件名（含目录）取字节；没有就返回 null。 */
    getFile: (path: string) => Blob | null;
}

/** 把牌组编成容器里的一组文件：`.<app>/references/manifest.json` + 每张卡的字节。宿主原样存。 */
export declare function encodeDeck(s: DeckSnapshot, o: EncodeOptions): Map<string, Blob>;

export declare interface EncodeOptions {
    /** 宿主的名字，决定目录：`.<app>/references/`。 */
    app: string;
}

/** mime → 扩展名（不带点）。不认识的图片给 "img"（WeebPaint 既有），其余不认识的给 "bin"。 */
export declare function extForMime(mime: string): string;

export declare interface ManifestItem {
    kind: string;
    /** 字节在容器里的文件名（含目录）。 */
    src?: string;
    vp?: CardView | null;
    name?: string;
    mime?: string;
    target?: string;
    origin?: string;
    play?: CardPlay;
    [extra: string]: unknown;
}

/** 把任何版本的清单升到当前版。缺 version 视为 1；不是对象 → 空清单。 */
export declare function migrateDeckManifest(json: unknown): DeckManifest;

/** 文件名 → mime（按扩展名猜）。猜不出 → ""。 */
export declare function mimeForName(name: string): string;

/** 新卡：只有 kind 必填，其余缺省为空。 */
export declare type NewCard = {
    kind: CardKind;
} & Partial<Omit<Card, "id" | "kind">>;

export { }
