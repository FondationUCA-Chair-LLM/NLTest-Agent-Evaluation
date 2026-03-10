import { Cookie, LocalStorage, StorageState } from "../types/storageState.js";
import { ActResult } from "../types/actResult.js";
import { Page } from "playwright";

export interface FrameworkInterface {
  init(): Promise<void>
  CloseFramework(): Promise<void>
  goto(url: string): Promise<Response>;
  act(action: string): Promise<ActResult>;
  waitForTimeout(ms: number): Promise<void>;
  getUIElements(): Promise<{
    links: string[];
    buttons: string[];
    fields: string[];
    forms: string[];
    checkboxes: string[];
    selects: string[];
    staticText: string[];
    fieldValues: Record<string, string>;
  }>
  extract(): Promise<{ page_text?: string | undefined; }>
  locate(element: string): Promise<any>
  locateInnerHandles(element: string): Promise<any>
  locateWithInnerText(element: string): Promise<string[]>
  getInnerText(element: string): Promise<string>
  isPresent(element: string): Promise<boolean>
  getByRole(element: string, target: string): Promise<any>
  getByTextWithInnerText(filter: string): Promise<string[]>
  expect(locator: any): Promise<void>
  extractTables(): Promise<string[][][]>
  getUrl() : string 
  getStorageState() : Promise<StorageState>
  takeScreenshot(path: string): Promise<void>
  getPlaywrightPage(): Page
  clearStorageAndCookies(): Promise<void>
  addCookies(cookie: Cookie[]): Promise<void>
  addLocalStorage(storage: LocalStorage[]): Promise<void>
  getPopupInfo(): Promise<{ hasPopup: boolean; popupCount: number; popupSignatures: string[] }>
}