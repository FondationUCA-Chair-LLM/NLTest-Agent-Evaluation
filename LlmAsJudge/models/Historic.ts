import { StorageState } from '../types/storageState.js';
import { FrameworkInterface } from '../Framework/FrameworkInterface.js';
/**
 * Class to manage the historic of actions, URL, and storage state.
 * This is used to swap context between different pages while preserving state.
 * It records Playwright actions, the initial and final URLs, and the storage state (cookies and localStorage).
 * 
 * Usage:
 * 1. Initialize with init(url, storageState)
 * 2. Update with update(act_message, context, final_url, action)
 * 3. Swap context with swap(page, stagehand)
 * 
 * Make sure to call init() before using other methods.
 * 
 * You should clear actions when navigating to a new URL with clearActions(url).
 * The storageState must be updated when the URL changes (final_url != url) after an action.
 * The actions list must be cleared when navigating to a new URL (url != current_url).
 */
export class Historic {
    url: string; // The initial URL, all of the actions happenned on this URL
    final_url?: string; // The URL after the last action
    actions: { // Array of recorded Playwright actions
        action: string; // Action type (e.g., click, type)
        selector: string; // XPath selector (From Playwright)
        input?: string | null; // Input value for actions needing it
    }[];
    storageState: StorageState; // Storage state (cookies and localStorage)
    isInitialized: boolean = false; // Flag to check if initialized

    // Initializes the Historic, you need to call init() before using other methods
    constructor() {
        this.url = "";
        this.actions = [];
        this.storageState = { cookies: [], origins: [] };
        this.isInitialized = false;
    }

    // Initialize the Historic with a URL and storage state.
    init(url: string, storageState: StorageState) {
        this.url = url;
        this.storageState = storageState;
        this.isInitialized = true;
    }

    // Clear the actions and update the URL and storage state.
    async clearActions(url: string, storageState: StorageState) {
        this.checkInitialized();
        this.url = url;
        this.actions = [];
        this.storageState = storageState;
    }

    /*
        * Update the historic with a new action and final URL (the URL after the action)
        * if the page changed (final_url != url), we also update the storage state
    */
    async update(act_message: string, final_url: string, action: string) {
        this.checkInitialized();
        this.final_url = final_url;

        // Parse the act_message to extract action, selector, and input
        const parsedAction = parseActMessage(act_message, action);
        if (!parsedAction) {
            return;
        }

        this.actions.push(parsedAction);
        console.debug("historic:", { url: this.url, final_url: this.final_url, actions_count: this.actions.length, isLocalStorageHere: !!this.storageState });
    }

    /*
        * Swap to a new page using the historic data.
        * If the URL changed after the action, we restore the final URL and storage state.
        * If the URL did not change, we restore the original URL and replay the actions to reach the same state.
    */
    async swap(framework: FrameworkInterface, otherHistoric: Historic) {
        this.checkInitialized();
        if (this.url != this.final_url) {
            console.debug(`The action led to a new page, restoring destination URL : ${this.final_url}`);
            await framework.goto(this.final_url!);
            await RestoreStorageState(this.storageState!, framework);
        }
        else {
            console.debug(`Rerun actions since first arrival on the URL: ${this.url}`);
            await framework.goto(this.url);
            await RestoreStorageState(this.storageState!, framework);
            await this.replayActions(framework);
        }
        otherHistoric.storageState = this.storageState;
    }

    // Replay the recorded Playwright actions on the given page
    private async replayActions(framework: FrameworkInterface) {
        this.checkInitialized();
        const page = framework.getPlaywrightPage();
        for (const item of this.actions) {
            console.debug(`Replaying action: ${item.action} on selector: ${item.selector} with input: ${item.input}`);
            if (!item.selector) break;
            const selector = item.selector.startsWith('/')
                ? `xpath=${item.selector}`
                : item.selector;
            switch (item.action) {
                case "click":
                    await page.locator(selector).click();
                    break;
                case "type":
                case "fill":
                    if (!item.input) {
                        break;
                    }
                    await page.locator(selector).fill(item.input);
                    break;
                // Ajouter d'autres actions si nécessaire
                default:
                    throw new Error(`Action ${item.action} not handled.`);
            }
        }
    }

    // Check if the Historic has been initialized
    private checkInitialized() {
        if (!this.isInitialized) {
            throw new Error("Historic not initialized. Call init() before using this method.");
        }
    }
}

// Helper function to parse the act_message
function parseActMessage(act_message: string, action: string): { action: string; selector: string; input?: string | null } | null {
    const match = String(act_message).match(/\[(.*)\].* selector: (.*)/);
    if (match) {
        let matchinput = null;
        if (match[1] === "type") {
            matchinput = action.match(/'([^']*)'/);
        }
        return {
            action: match[1],
            selector: match[2],
            input: matchinput ? matchinput[1] : null
        };
    }
    return null;
}

// Function to restore storage state (cookies and localStorage) for the given Stagehand
async function RestoreStorageState(storageState: StorageState | undefined, framework: FrameworkInterface) {
    if (!storageState) {
        return;
    }
    await framework.clearStorageAndCookies();

    console.debug("🍪 Cookies cleared");
    if (storageState.cookies?.length) {
        try {
            await framework.addCookies(storageState.cookies);
            console.debug(`🍪 ${storageState.cookies.length} cookies restored`);
        } catch (err) {
            console.warn("⚠️ Error while adding cookies:", err);
        }
    }
    if (storageState.origins?.length) {
        try {
            await framework.addLocalStorage(storageState.origins[0].localStorage);
        }
        catch (err: any) {
            console.warn("⚠️ Unable to load the page:", err.message);
        }
    }
}
