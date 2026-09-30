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

declare interface GestureViewport {
    tx: number;
    ty: number;
    scale: number;
    rot: number;
}

/** 新卡：只有 kind 必填，其余缺省为空。 */
export declare type NewCard = {
    kind: CardKind;
} & Partial<Omit<Card, "id" | "kind">>;

export declare const REF_ICON_IDS: {
    readonly folder: "folder";
    readonly paste: "paste";
    readonly cloud: "cloud";
    readonly pip: "picture-in-picture";
    readonly oneToOne: "one-to-one";
    readonly trash: "trash-can";
    readonly x: "x";
    readonly plus: "new";
    readonly prev: "chevron-left";
    readonly next: "chevron-right";
};

export declare type RefBitmapSource = (ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) & {
    close?: () => void;
};

export declare type RefItem = {
    kind: "image";
    bitmap: RefBitmapSource;
    blob: Blob | null;
    vp: RefViewport | null;
} | {
    kind: "live";
    vp: RefViewport | null;
};

export declare interface RefLabels {
    load?: string;
    paste?: string;
    cloud?: string;
    live?: string;
    oneToOne?: string;
    del?: string;
    delConfirm?: string;
    closeWin?: string;
    prev?: string;
    next?: string;
    menu?: string;
    move?: string;
    resize?: string;
    resizeAria?: string;
}

export declare type RefLiveSource = HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

export declare interface RefMenuHandle {
    close(): void;
    refresh(): void;
    readonly isOpen: boolean;
}

export declare interface RefMenuItem {
    id: string;
    label: string;
    icon?: string;
    hidden?: boolean;
    danger?: boolean;
    separatorBefore?: boolean;
}

export declare interface RefMenuOpts {
    anchor: HTMLElement;
    items: () => RefMenuItem[];
    onPick: (id: string) => void | "keep";
    onClose?: () => void;
    align?: "left" | "right";
    band?: "menu";
    swallowOutsideTap?: boolean;
    ariaLabel?: string;
}

/** toggle 语义：同锚已开 → 关并返回 null；否则开并返回句柄。 */
export declare type RefMenuPort = (opts: RefMenuOpts) => RefMenuHandle | null;

export declare interface RefPanelRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export declare type RefViewport = GestureViewport;

export declare const WP_REFERENCE_WINDOW_TAG = "wp-reference-window";

export declare class WpReferenceWindow extends HTMLElement {
    static get observedAttributes(): string[];
    liveProvider: (() => RefLiveSource | null) | null;
    menuPort: RefMenuPort | null;
    /** 拖把地板（宿主注入 = ui/floating-window 运行时量的「顶栏下缘」；缺省 60 = 旧常数，裸挂可用）。
     *  拖 / 恢复 / 视口钳制三条路都吃它——出血区规则只准一个出处（2026-09-02 C2）。 */
    topFloor: number;
    private _canvas;
    private _cctx;
    private _emptyEl;
    private _plusEl;
    private _menu;
    private _delArmed;
    private _chipsEl;
    private _chipCountEl;
    private _deck;
    private _offDeck;
    private _muted;
    private _shownId;
    private _bitmaps;
    private _decoding;
    private _labels;
    private _liveSource;
    private _liveDirty;
    private _lastLiveComposeT;
    private _liveThrottle;
    private _vp;
    private _raf;
    private _panelDrag;
    private _resizeDrag;
    private _pointers;
    private _gestureStart;
    private _picking;
    private _longPressTimer;
    private _lpStart;
    private _lpEvent;
    private _idleTimer;
    constructor();
    get deck(): Deck;
    set deck(d: Deck);
    get open(): boolean;
    set open(v: boolean);
    attributeChangedCallback(name: string, oldV: string | null, newV: string | null): void;
    close(): void;
    get live(): boolean;
    isLive(): boolean;
    get viewport(): RefViewport;
    set viewport(v: RefViewport | null | undefined);
    get rect(): RefPanelRect;
    set rect(o: Partial<RefPanelRect> | null | undefined);
    set labels(l: RefLabels);
    /** 整表替换（load 恢复用）。旧 image bitmap 全部释放。 */
    setItems(items: RefItem[], index?: number): void;
    /** 追加一张图并翻到它（导入漏斗尾）。 */
    addImage(bitmap: RefBitmapSource, blob: Blob | null): void;
    /** 画布镜像页：已有 → 翻过去；没有 → 追加并翻到（liveProvider 缺席 = no-op）。 */
    showLive(): void;
    /** 清空（换画/重置）。 */
    clearAll(): void;
    /** 宿主读走全部状态（desk 同步 + 保存收集）。当前页 vp 先回写。 */
    getRefState(): {
        index: number;
        items: Array<{
            kind: "image";
            blob: Blob | null;
            vp: RefViewport | null;
        } | {
            kind: "live";
            vp: RefViewport | null;
        }>;
    };
    get itemCount(): number;
    fitToPanel(): void;
    /** 1:1 像素（user 0830）：1 图像素 = 1 **设备**像素（像素图标真面目；scale=1/dpr）、摆正（rot=0）、
     *  当前画布中心的图点保持锚定。菜单项触发 = 用户交互 → 发事件。 */
    oneToOne(): void;
    private _scaleBounds;
    private _containVp;
    markLiveDirty(): void;
    private _emit;
    private _emitViewport;
    private _emitRect;
    private _emitItems;
    private _saveCurrentVp;
    private _loadCurrentVp;
    /** fit 但不发事件（程序性初始适应；用户双击走 fitToPanel）。 */
    fitToPanelSilent(): void;
    private _page;
    private _deleteCurrent;
    /** 自己改牌组的那一下不听自己的回声。别的监听者（宿主、VR 视图）照常收到。 */
    private _mute;
    private _closeAllBitmaps;
    /** 别人（宿主直接用 .deck、或共用这副牌的另一个视图）改了牌组。 */
    private _onDeckChange;
    /** 把视图对齐到牌组现状。幂等：牌组没变就什么都不做。 */
    private _syncFromDeck;
    /** 只给了字节没给位图的图片卡（宿主直接往牌组里加的）：这里解。解不出来要说，不许装没事。 */
    private _decode;
    private _afterItemsChanged;
    private _updateChips;
    private _sourceSize;
    private _afterShow;
    private _bind;
    private _menuItems;
    private _toggleMenu;
    private _pokeIdle;
    private _onDown;
    private _onMove;
    private _onUp;
    private _onWheel;
    private _cancelLongPress;
    private _beginPick;
    private _endPick;
    private _pickAt;
    private _resizeCanvasToBody;
    private _invalidate;
    private _stopLiveTimer;
    private _recomposeLive;
    private _render;
    private _updateEmptyHint;
    /** 视口护栏：尺寸不超视口预算、位置不落屏外（拖已自钳；这里兜 restore/open/浏览器窗口 resize/
     *  native CSS resize 四条路）。返回是否有修正。 */
    private _clampIntoViewport;
}

export { }
