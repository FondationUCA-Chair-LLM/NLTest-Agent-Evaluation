import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig, { StagehandConfigTrusted } from "./stagehand.config.js";
import boxen from "boxen";
import chalk from "chalk";
import { FrameworkInterface } from "../../FrameworkInterface.js";
import { Locator } from "playwright";
import { expect } from "playwright/test";
import { Cookie, LocalStorage, StorageState } from "../../../types/storageState.js";
import { Page as PlaywrightPage } from "playwright";

export class FrameworkStagehand implements FrameworkInterface {
    framework: Stagehand;
    context: BrowserContext
    page: Page

    static async InitFramework(trusted: boolean = false): Promise<FrameworkStagehand> {
        let stagehand: Stagehand;
        if (trusted) {
            stagehand = new Stagehand({ ...StagehandConfigTrusted });
        }
        else {
            stagehand = new Stagehand({ ...StagehandConfig });
        }

        await stagehand.init();

        if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
            console.log(
                boxen(
                    `View this session live in your browser: \n${chalk.blue(
                        `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
                    )}`,
                    { title: "Browserbase", padding: 1, margin: 3 }
                )
            );
        }
        return new FrameworkStagehand(stagehand);

    }

    constructor(framework: Stagehand) {
        this.framework = framework
        this.context = framework.context
        this.page = framework.context.pages()[0]
    }
    async expect(locator: Locator): Promise<void> {
        await expect(locator).toBeEditable();
    }

    async getByTextWithInnerText(filter: string): Promise<string[]> {
        return await this.page.getByText(filter).allInnerTexts();
    }

    async getByRole(element: "alert" | "alertdialog" | "application" | "article" | "banner" | "blockquote" | "button" | "caption" | "cell" | "checkbox" | "code" | "columnheader" | "combobox" | "complementary" | "contentinfo" | "definition" | "deletion" | "dialog" | "directory" | "document" | "emphasis" | "feed" | "figure" | "form" | "generic" | "grid" | "gridcell" | "group" | "heading" | "img" | "insertion" | "link" | "list" | "listbox" | "listitem" | "log" | "main" | "marquee" | "math" | "meter" | "menu" | "menubar" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "navigation" | "none" | "note" | "option" | "paragraph" | "presentation" | "progressbar" | "radio" | "radiogroup" | "region" | "row" | "rowgroup" | "rowheader" | "scrollbar" | "search" | "searchbox" | "separator" | "slider" | "spinbutton" | "status" | "strong" | "subscript" | "superscript" | "switch" | "tab" | "table" | "tablist" | "tabpanel" | "term" | "textbox" | "time" | "timer" | "toolbar" | "tooltip" | "tree" | "treegrid" | "treeitem",
        target: string): Promise<Locator> {
        return this.page.getByRole(element, { name: target });
    }

    async locateInnerHandles(element: string): Promise<any> {
        return (await this.page.locator(element).elementHandles());
    }

    async isPresent(element: string): Promise<boolean> {
        return await this.page.locator(`text=${element}`).count() > 0;
    }

    async getInnerText(element: string): Promise<string> {
        return await this.page.innerText('body');
    }

    async locateWithInnerText(element: string): Promise<string[]> {
        return await this.page.locator('a').allInnerTexts();
    }

    async locate(element: string): Promise<Locator> {
        return this.page.locator(`text=${element}`)
    }

    async CloseFramework(): Promise<void> {
        if (this.framework) {
            return await this.framework.close()
        }
        throw Error("Error on Close : Framework not initialized")
    }

    extract(): Promise<{ page_text?: string | undefined; }> {
        return this.page.extract();
    }

    async getUIElements(): Promise<{
        links: string[];
        buttons: string[];
        fields: string[];
        forms: string[];
        checkboxes: string[];
        selects: string[];
        staticText: string[];
        fieldValues: Record<string, string>;
    }> {

        let links = [];
        let buttons = [];
        let fields = [];
        let forms = [];
        let selects = [];
        let staticText = [];
        let fieldValues: Record<string, string> = {};

        links = await this.page.locator('a:visible').allInnerTexts();
        buttons = await this.page.locator('button:visible').allInnerTexts();
        fields = await this.page.$$eval('input', inputs =>
            inputs.map(input => input.getAttribute('name') || '(no name)')
        );//page.locator('input:visible').all().;
        forms = await this.page.locator('form:visible').allInnerTexts();
        //page.locator('checkbox:visible').allInnerTexts();
        selects = await this.page.locator('select:visible').allInnerTexts();
        staticText = await this.page.locator('p:visible, li:visible, span:visible').allInnerTexts();

        const checkboxes = await this.page.$$eval(
            'input[type="checkbox"], input[type="radio"]',
            (inputs) =>
                inputs.map(input => {
                    const el = input as HTMLInputElement; // cast ici
                    return `${el.type}|${el.name}|${el.value}|${el.checked}`
                })
        );

        const inputs = await this.page.$$('input:not([type=hidden]), textarea:not([hidden])');


        for (const input of inputs) {
            const name = (await input.getAttribute('name')) || (await input.getAttribute('id')) || '(no name)';
            const value = await input.evaluate((el: HTMLInputElement) => el.value);
            fields.push(name);
            fieldValues[name] = value;
        }


        return { links, buttons, fields, forms, checkboxes, selects, staticText, fieldValues }
    }

    async act(action: string): Promise<any> {
        return await this.page.act({ action: action })

    }

    async waitForTimeout(ms: number): Promise<void> {
        await this.page.waitForTimeout(ms)
    }

    goto(url: string): Promise<any> {
        return this.page.goto(url);
    }

    async init(): Promise<void> {
        await this.framework.init()
        this.page = this.framework.page
        this.context = this.framework.context
    }

    async close(): Promise<void> {
        await this.framework.close()
    }

    async extractTables(): Promise<string[][][]> {
        const tablesData: string[][][] = await this.page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));

            // On ne garde que les tables qui ont au moins un th
            const tablesWithHeaders = tables.filter(table => table.querySelector('th'));

            return tablesWithHeaders.map(table => {
                const rows = Array.from(table.querySelectorAll('tr'));

                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    // On retourne le HTML complet de chaque cellule pour garder tous les attributs
                    return cells.map(cell => cell.outerHTML);
                });
            });
        });

        return tablesData;
    }

    getUrl(): string {
        return this.page.url();
    }

    async getStorageState(): Promise<StorageState> {
        return await this.context.storageState();
    }

    async takeScreenshot(path: string): Promise<void> {
        await this.page.screenshot({ path: path });
    }

    getPlaywrightPage(): PlaywrightPage {
        return this.page;
    }

    async clearStorageAndCookies(): Promise<void> {
        await this.page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await this.context.clearCookies();
    }

    async addCookies(cookie: Cookie[]): Promise<void> {
        await this.context.addCookies(cookie);
    }

    async addLocalStorage(storage: LocalStorage[]): Promise<void> {
        for (const item of storage) {
            await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [item.name, item.value]);
        }
    }

    async getPopupInfo(): Promise<{ hasPopup: boolean; popupCount: number; popupSignatures: string[] }> {
        return this.page.evaluate(() => {

            const elements = Array.from(document.querySelectorAll("*"));

            const visibleElements = elements.filter(el => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return rect.width > 50 && rect.height > 50 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    parseFloat(style.opacity) > 0;
            });

            //Trouve le z-index le plus élevé de la page
            const maxZIndex = visibleElements.reduce((max, el) => {
                const z = parseInt(window.getComputedStyle(el).zIndex || "0", 10);
                return isNaN(z) ? max : Math.max(max, z);
            }, 0);

            // Filtre les éléments qui sont probablement des popups
            const popups = visibleElements.filter(el => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();

                //Centre de l'élément visible dans la fenêtre
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const inViewport = centerX > 0 && centerX < window.innerWidth &&
                    centerY > 0 && centerY < window.innerHeight;

                const isPopupPosition = ["fixed", "absolute"].includes(style.position);

                //Z-index élevé (au-dessus de la majorité des éléments)
                const zIndex = parseInt(style.zIndex || "0", 10);
                const highZ = !isNaN(zIndex) && zIndex >= maxZIndex - 5; // top layer

                return inViewport && isPopupPosition && highZ;
            });

            const signatures = popups.map(el => {
                const tag = el.tagName;
                const classes = (el.className || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
                const rect = el.getBoundingClientRect();
                return `${tag}${classes ? "." + classes : ""} [${rect.width.toFixed(0)}x${rect.height.toFixed(0)}] : "${(el.textContent ?? "").slice(0, 200).trim()}"`;
            });



            return {
                hasPopup: popups.length > 0,
                popupCount: popups.length,
                popupSignatures: signatures
            };
        });
    }

}