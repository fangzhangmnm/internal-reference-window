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
    /** 0.4.0「只放内存」（RAM only）：字节不随文档保存，只记原文件多大；下次打开是一个空位，提示重新导入、补回原位。null = 照常存。
     *  2026-10-09 user「然后能不能加RAM only，就是不落盘，每次重新上传，这个非常有用！！！」→ 选了「B」（存一个空位）——翻掉 2026-09-29 去掉「只在这次有效」的决定。 */
    ram: {
        bytes: number;
    } | null;
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
    /** 0.4.0：这张卡「只放内存」开 / 关。存不存变了 → 通知 "cards"（宿主标脏）。关掉要求手上有字节（空位关不了）。 */
    setRam(id: string, on: boolean): void;
    /** 0.4.0：给「只放内存」的空位补回字节（重新导入）。存的东西没变（这种卡本来就不存字节）→ 通知 "view"。 */
    fill(id: string, bytes: Blob, mime?: string): void;
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
    readonly earlier: "back";
    readonly later: "forward";
    readonly current: "check";
    readonly play: "play";
    readonly pause: "pause";
};

export declare type RefBitmapSource = (ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) & {
    close?: () => void;
};

/** keep = 原样存进文档；compress = 宿主转码后存；ram = 只放内存（不存，下次是空位、提示重新导入）；cancel = 不要。 */
export declare type RefImportChoice = "keep" | "compress" | "ram" | "cancel";

export declare type RefImportKind = "image" | "text" | "audio" | "video";

export declare interface RefImportOptions {
    /** 这个宿主画得出来的种类（不在里面的 = 不收、报 unsupported）。 */
    kinds: readonly string[];
    transcoder?: RefTranscoder | null;
    ask?: ((q: RefImportQuestion) => Promise<RefImportChoice>) | null;
    /** 超过这么多字节才问（按种类；不给 = 不问）。 */
    askAbove?: Partial<Record<RefImportKind, number>>;
    /** 超过这么多字节 = 建议「只放内存」（question.suggestRam；user 2026-10-09「这里可能是全家族仓我们唯一一个真的需要nudge用户」）。不给 = 不建议。 */
    ramAbove?: number;
}

/** 问用户的时候给宿主的信息。canCompress = 宿主的转码认这种；suggestRam = 超过宿主给的线（ramAbove），面板该把「只放内存」放在前面。 */
export declare interface RefImportQuestion {
    name: string;
    kind: RefImportKind;
    bytes: number;
    estimate: number | null;
    canCompress: boolean;
    suggestRam: boolean;
}

/** filled = 补回了「只放内存」的空位（同种类、同名的那张；没新加卡）。 */
export declare interface RefImportResult {
    added: Card[];
    filled: Card[];
    skipped: RefImportSkip[];
    notes: string[];
}

export declare interface RefImportSkip {
    name: string;
    why: "unsupported" | "cancelled" | "failed";
    message?: string;
}

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
    /** ＋ 菜单：把当前这张卡往前 / 往后挪一位。 */
    moveEarlier?: string;
    moveLater?: string;
    /** 计数钮（「3/12」）的提示：点它按名字跳转。 */
    jump?: string;
    /** 没有名字的卡在跳转列表里叫什么，按种类给（如 image → 图片、live → 画布镜像）。 */
    kindNames?: Record<string, string>;
    /** 链接卡取不到内容时卡上写什么。 */
    linkMissing?: string;
    /** 0.4.0 音频卡：播放 / 暂停钮、＋ 菜单里的「循环」「速度」（速度项后面跟「0.75×」）。 */
    play?: string;
    pause?: string;
    loop?: string;
    rate?: string;
    /** 0.4.0「只放内存」：＋ 菜单里的开关；读回来是空位时卡上那句话（前面库自己写「名字 · 大小」）。 */
    ram?: string;
    ramMissing?: string;
}

/** 链接卡的内容端口：宿主按 target 给字节（图片 / 文字…）。null = 现在给不出来（页被删了、还没加载）。 */
export declare type RefLinkProvider = (target: string, kind: string) => Promise<Blob | null> | Blob | null;

/** 宿主交回的一帧。直接给画面 = 画面的像素尺寸就是这张卡的尺寸（WeebPaint 的画布小窗）。
 *  按提示出了小尺寸的宿主要另外说明这张卡「本来多大」（source 之外带 width / height），否则窗口一变大小，同样的缩放下图就跟着变大变小。 */
export declare type RefLiveFrame = RefLiveSource | {
    source: RefLiveSource;
    width: number;
    height: number;
};

/** 出帧函数。两个参数都可以不理（WeebPaint 现有的 provider 就不理）。返回 null = 这一帧出不了，保留上一帧。 */
export declare type RefLiveProvider = (want: RefLiveWant, target: string | null) => RefLiveFrame | null;

export declare type RefLiveSource = HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

/** ＋ 菜单里列哪些「宿主出画面的卡」。不给 = 只有一项，用 labels.live。 */
export declare interface RefLiveTarget {
    target: string | null;
    label: string;
}

/** 要帧时告诉宿主：窗口现在有多少设备像素。只是提示——「铺满窗口看，这么多像素就够了」。 */
export declare interface RefLiveWant {
    width: number;
    height: number;
}

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

/** 宿主注入的转码：会压哪几种、压完大概多大（给面板上报数；可不给）、怎么压。 */
export declare interface RefTranscoder {
    kinds: readonly RefImportKind[];
    estimate?(kind: RefImportKind, file: Blob): Promise<number | null>;
    encode(kind: RefImportKind, file: Blob): Promise<{
        blob: Blob;
        mime: string;
        note?: string;
    }>;
}

export declare type RefViewport = GestureViewport;

export declare const WP_REFERENCE_WINDOW_TAG = "wp-reference-window";

export declare class WpReferenceWindow extends HTMLElement {
    static get observedAttributes(): string[];
    /** 0.3.1：窗身可拿焦点（粘贴归焦点）。属性只能在这里加（自定义元素构造器里加属性 = createElement 直接炸）；宿主可自定 tabindex。 */
    connectedCallback(): void;
    liveProvider: RefLiveProvider | null;
    /** 两帧之间至少隔多久（毫秒）。归宿主定：只有宿主知道自己出一帧多贵。缺省 300 = WeebPaint 现值。 */
    liveMinIntervalMs: number;
    /** ＋ 菜单里列哪些画面（多台相机的宿主用）。null = 只列一项。 */
    liveTargets: (() => RefLiveTarget[]) | null;
    /** 链接卡的内容端口（0.3.0）：bytes 为空、有 target 的非 live 卡从这里要内容。null = 这个宿主没有可链接的东西。 */
    linkProvider: RefLinkProvider | null;
    menuPort: RefMenuPort | null;
    /** 拖把地板（宿主注入 = ui/floating-window 运行时量的「顶栏下缘」；缺省 60 = 旧常数，裸挂可用）。
     *  拖 / 恢复 / 视口钳制三条路都吃它——出血区规则只准一个出处（2026-09-02 C2）。 */
    topFloor: number;
    /** 0.4.0 音频卡的速度档（宿主注入，如 [1, 0.75, 0.5]；保音高）。null = 不给速度（库的缺省；user 2026-10-09「默认不开，moonsinger开」）。 */
    audioRates: readonly number[] | null;
    /** 底边地板（宿主注入 = 屏底被占掉的高度：app 内软键盘、iOS 键盘那一块……；缺省 0）。拖 / resize / 视口钳制都吃它——
     *  否则右下角的 resize 把手会被键盘盖住（user 2026-09-30「参考窗或者任何浮窗需要保证 move 和 resize 能点到」）。改了之后宿主调 reclamp()。 */
    bottomFloor: number;
    private _canvas;
    private _cctx;
    private _textEl;
    private _audioLayer;
    private _aPlay;
    private _aName;
    private _aSeek;
    private _aTime;
    /** 0.4.0 音频卡：一个窗一个 <audio>，记着正在放哪张卡。翻到别的卡 / 关窗都不停（user「关窗的时候音乐不停」、2026-10-09「1. 不停」）。 */
    private _audio;
    private _audioOf;
    private _audioUrl;
    private _rate;
    private _emptyEl;
    private _plusEl;
    private _menu;
    private _delArmed;
    private _chipsEl;
    private _chipCountEl;
    private _menuAnchor;
    private _deck;
    private _offDeck;
    private _muted;
    private _shownId;
    private _bitmaps;
    private _decoding;
    private _texts;
    private _linked;
    private _linkMissing;
    private _resolving;
    private _textPinch;
    private _textPinchStart;
    private _textScrollRaf;
    private _labels;
    private _liveSource;
    private _liveSize;
    private _liveOf;
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
    /** 键盘焦点在参考窗上（含窗内文字卡）= 宿主的 Ctrl+V 应落到这里（0.3.1，user「看 focus」）。 */
    get hasFocus(): boolean;
    get open(): boolean;
    set open(v: boolean);
    attributeChangedCallback(name: string, oldV: string | null, newV: string | null): void;
    close(): void;
    /** 0.4.0 导入漏斗（deck/import.ts）：嗅种类 → 够大就问宿主（ask）→ 原样 / 压（宿主注入的 transcoder）/ 不要 → 进牌组；加进去了就开窗。
     *  kinds 缺省 = 图片 / 文字 / 音频。结果（加了哪些、哪些没进、为什么）原样还给宿主，由宿主明说。 */
    importFiles(files: readonly Blob[], opts?: Omit<RefImportOptions, "kinds"> & {
        kinds?: readonly string[];
    }): Promise<RefImportResult>;
    /** 元素从文档里拿掉 = 停（关窗不停；整个窗没了才停）。 */
    disconnectedCallback(): void;
    /** 当前这张音频卡：播放 / 暂停（换了一张卡 = 先停上一张、从这张记着的位置放）。不是音频卡 = 什么都不做。 */
    togglePlay(): void;
    /** 正在放（任何一张音频卡）。 */
    get playing(): boolean;
    private _loadAudio;
    private _stopAudio;
    /** 放到哪 / 循环记进卡（视图态：牌组发 view，不标脏）。 */
    private _saveAudioPos;
    private _updateAudioLayer;
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
    addImage(bitmap: RefBitmapSource, blob: Blob | null, opts?: {
        name?: string;
        origin?: string | null;
    }): void;
    /** 追加一张文字卡并翻到它（0.3.0）。name 缺省取首行。 */
    addText(text: string, opts?: {
        name?: string;
        origin?: string | null;
        mime?: string;
    }): void;
    /** 画布镜像页：已有 → 翻过去；没有 → 追加并翻到（liveProvider 缺席 = no-op）。 */
    showLive(target?: string | null, name?: string): void;
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
    markLiveDirty(target?: string | null): void;
    private _emit;
    private _emitViewport;
    private _emitRect;
    private _emitItems;
    private _saveCurrentVp;
    private _loadCurrentVp;
    /** fit 但不发事件（程序性初始适应；用户双击走 fitToPanel）。 */
    fitToPanelSilent(): void;
    private _page;
    /** 用户把当前这张卡挪一位。还在看这张卡，只是它排的位置变了。 */
    private _moveCurrent;
    /** 用户从跳转列表里点了第 i 张。 */
    private _jumpTo;
    private _cardLabel;
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
    private _decodeText;
    /** 链接卡：向宿主要内容。要不到 → 记下「缺」，卡上如实写；宿主 invalidate 后再要。 */
    private _resolveLink;
    private _afterItemsChanged;
    /** 文字卡：内容层显示 / 隐藏 + 灌内容 + 字号 + 滚动位置。 */
    private _updateTextLayer;
    private _updateChips;
    private _sourceSize;
    private _afterShow;
    private _bind;
    private _ramMissingText;
    private _menuItems;
    private _audioMenuItems;
    private _liveMenuId;
    private _liveMenuTargets;
    private _liveMenuItems;
    /** 跳转列表：点计数钮弹出，一张卡一行，点哪个跳哪个。复用同一个菜单端口，不加新 gizmo。 */
    private _toggleJump;
    /** 两个菜单共用一个端口：要开的和正开着的不是同一个锚 → 先把开着的收掉（同一个锚则交给端口自己的 toggle 语义）。 */
    private _swapMenuAnchor;
    private _toggleMenu;
    private _pokeIdle;
    private _onDown;
    private _onMove;
    private _onUp;
    private _onWheel;
    private _setTextScale;
    private _cancelLongPress;
    private _beginPick;
    private _endPick;
    private _pickAt;
    private _resizeCanvasToBody;
    private _invalidate;
    private _stopLiveTimer;
    /** 手上的帧是另一张卡的（多台相机之间翻页）→ 扔掉，连节流的计时一起清：新卡的第一帧要立刻出，不许先画一下别人的画面。 */
    private _dropLiveIfOther;
    /** 向宿主要一帧。要到了返回 true。 */
    private _takeLiveFrame;
    private _recomposeLive;
    private _render;
    private _updateEmptyHint;
    /** 视口护栏：尺寸不超视口预算、位置不落屏外（拖已自钳；这里兜 restore/open/浏览器窗口 resize/
     *  native CSS resize 四条路）。返回是否有修正。 */
    /** 地板变了（键盘露 / 收、顶栏高度变）之后宿主调：整窗钳回可见区，动了就发 rectchange。 */
    reclamp(): void;
    private _clampIntoViewport;
}

export { }
