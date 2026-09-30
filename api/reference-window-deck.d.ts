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
    /** 小封面（视频首帧 / 音乐封面），总是随文档保存：开文档那一刻位子上就有东西。 */
    face: Blob | null;
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
    /** 条目引用的字节：key = "src" | "face"。 */
    files: {
        src?: Blob;
        face?: Blob;
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
    invalidate(id: string): void;
    onChange(fn: (what: DeckChange) => void): () => void;
}

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

export declare interface DeckManifest {
    /** 缺省 = WeebPaint format 2 的 refPanels（没有版本戳）。 */
    version?: number;
    index: number;
    items: ManifestItem[];
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

export declare function decodeDeck(manifest: unknown, o: DecodeOptions): DecodedDeck;

export declare interface DecodeOptions {
    /** 这个宿主画得出来的种类。其余的原样带着。 */
    knownKinds: readonly string[];
    /** 按文件名取字节；没有就返回 null。 */
    getFile: (name: string) => Blob | null;
}

export declare function encodeDeck(s: DeckSnapshot, o: EncodeOptions): {
    manifest: DeckManifest;
    files: Map<string, Blob>;
};

export declare interface EncodeOptions {
    /** 给第 position 张卡的字节（或小封面）起文件名。ext 不带点，由本库按 mime 定（不认识的 mime 给 "bin"）。 */
    nameFile: (position: number, ext: string, role: "bytes" | "face") => string;
    /** 给就写版本戳，不给就不写（WeebPaint format 2 没有版本戳）。 */
    version?: number;
}

/** mime → 扩展名（不带点）。参数里的 charset 之类先剥掉。不认识 → "bin"。 */
export declare function extForMime(mime: string): string;

export declare interface ManifestItem {
    kind: string;
    /** 字节在容器里的文件名。 */
    src?: string;
    vp?: CardView | null;
    /** 小封面在容器里的文件名。 */
    face?: string;
    name?: string;
    mime?: string;
    target?: string;
    origin?: string;
    play?: CardPlay;
    [extra: string]: unknown;
}

/** 文件名 → mime（按扩展名猜）。猜不出 → ""。 */
export declare function mimeForName(name: string): string;

/** 新卡：只有 kind 必填，其余缺省为空。 */
export declare type NewCard = {
    kind: CardKind;
} & Partial<Omit<Card, "id" | "kind">>;

export { }
