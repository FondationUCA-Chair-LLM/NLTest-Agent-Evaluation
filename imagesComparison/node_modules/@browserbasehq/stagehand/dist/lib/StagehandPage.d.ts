import type { CDPSession, Page as PlaywrightPage } from "@playwright/test";
import { z } from "zod";
import { Page, defaultExtractSchema } from "../types/page";
import { ExtractOptions, ExtractResult, ObserveOptions, ObserveResult } from "../types/stagehand";
import { StagehandAPI } from "./api";
import { ActOptions, ActResult, Stagehand } from "./index";
import { LLMClient } from "./llm/LLMClient";
import { StagehandContext } from "./StagehandContext";
import { EnhancedContext } from "../types/context";
export declare class StagehandPage {
    private stagehand;
    private rawPage;
    private intPage;
    private intContext;
    private actHandler;
    private extractHandler;
    private observeHandler;
    private llmClient;
    private cdpClient;
    private api;
    private userProvidedInstructions?;
    private waitForCaptchaSolves;
    private initialized;
    constructor(page: PlaywrightPage, stagehand: Stagehand, context: StagehandContext, llmClient: LLMClient, userProvidedInstructions?: string, api?: StagehandAPI, waitForCaptchaSolves?: boolean);
    private ensureStagehandScript;
    private _refreshPageFromAPI;
    /**
     * Waits for a captcha to be solved when using Browserbase environment.
     *
     * @param timeoutMs - Optional timeout in milliseconds. If provided, the promise will reject if the captcha solving hasn't started within the given time.
     * @throws StagehandEnvironmentError if called in a LOCAL environment
     * @throws CaptchaTimeoutError if the timeout is reached before captcha solving starts
     * @returns Promise that resolves when the captcha is solved
     */
    waitForCaptchaSolve(timeoutMs?: number): Promise<void>;
    init(): Promise<StagehandPage>;
    get page(): Page;
    get context(): EnhancedContext;
    /**
     * `_waitForSettledDom` waits until the DOM is settled, and therefore is
     * ready for actions to be taken.
     *
     * **Definition of “settled”**
     *   • No in-flight network requests (except WebSocket / Server-Sent-Events).
     *   • That idle state lasts for at least **500 ms** (the “quiet-window”).
     *
     * **How it works**
     *   1.  Subscribes to CDP Network and Page events for the main target and all
     *       out-of-process iframes (via `Target.setAutoAttach { flatten:true }`).
     *   2.  Every time `Network.requestWillBeSent` fires, the request ID is added
     *       to an **`inflight`** `Set`.
     *   3.  When the request finishes—`loadingFinished`, `loadingFailed`,
     *       `requestServedFromCache`, or a *data:* response—the request ID is
     *       removed.
     *   4.  *Document* requests are also mapped **frameId → requestId**; when
     *       `Page.frameStoppedLoading` fires the corresponding Document request is
     *       removed immediately (covers iframes whose network events never close).
     *   5.  A **stalled-request sweep timer** runs every 500 ms.  If a *Document*
     *       request has been open for ≥ 2 s it is forcibly removed; this prevents
     *       ad/analytics iframes from blocking the wait forever.
     *   6.  When `inflight` becomes empty the helper starts a 500 ms timer.
     *       If no new request appears before the timer fires, the promise
     *       resolves → **DOM is considered settled**.
     *   7.  A global guard (`timeoutMs` or `stagehand.domSettleTimeoutMs`,
     *       default ≈ 30 s) ensures we always resolve; if it fires we log how many
     *       requests were still outstanding.
     *
     * @param timeoutMs – Optional hard cap (ms).  Defaults to
     *                    `this.stagehand.domSettleTimeoutMs`.
     */
    _waitForSettledDom(timeoutMs?: number): Promise<void>;
    act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult>;
    extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(instructionOrOptions?: string | ExtractOptions<T>): Promise<ExtractResult<T>>;
    observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]>;
    getCDPClient(): Promise<CDPSession>;
    sendCDP<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    enableCDP(domain: string): Promise<void>;
    disableCDP(domain: string): Promise<void>;
}
