import 'dotenv/config';
import { Obs } from "../models/Observe.js";
import { FrameworkInterface } from "../Framework/FrameworkInterface.js";

function normalizeTextId(value: string): string {
    return value.replace(/_[a-z0-9]+$/i, "")//regex qui supprime les id en fin de chaine aprrès un underscore
        .replace(/\s+/g, " ") // supprime les multiples espaces et retours à la ligne
        .replace(/[’‘]/g, "'") // uniformise les apostrophes
        .replace(/“|”/g, '"') // uniformise les guillemets
        .trim()
        .toLowerCase();  // ignore la casse
}

function compareArrayIsEqual(tab1?: string[], tab2?: string[]): boolean {
    const norm1 = new Set((tab1 ?? []).map(v => normalizeTextId(v)));
    const norm2 = new Set((tab2 ?? []).map(v => normalizeTextId(v)));

    if (norm1.size !== norm2.size) return false;
    for (const item of norm1) {
        if (!norm2.has(item)) return false;
    }
    return true;
}

async function CompareDOM(frameworkA: FrameworkInterface, frameworkB: FrameworkInterface): Promise<boolean> {
    const agent1 = new Obs();
    const agent2 = new Obs();
    await agent1.getUIElements(frameworkA)
    await agent2.getUIElements(frameworkB)

    agent1.links = agent1.links.filter((link: string) => !/^@/.test(link));
    agent2.links = agent2.links.filter((link: string) => !/^@/.test(link));

    type NavKey = "buttons" | "links" | "forms" | "fields" | "checkboxes" | "selects" | "statictText";
    const keys: NavKey[] = ["buttons", "links", "forms", "fields", "checkboxes", "selects", "statictText"];

    const comparisons = keys.map(key => compareArrayIsEqual(agent1[key], agent2[key]));

    const confianceFields = sanitizeFields(agent1.fieldValues);
    const evaluerFields = sanitizeFields(agent2.fieldValues);

    const compareFieldValues = Object.entries(confianceFields).every(([key, value]) => value === evaluerFields[key]);

    const compareCheckedStates = compareCheckedStatesEqual(agent1.checkedStates, agent2.checkedStates);

    const isEqual = comparisons.every(Boolean) && compareFieldValues && compareCheckedStates;
    return isEqual;

}

function sanitizeFields(fields: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (/recaptcha|captcha|csrf/.test(key)) continue;
        sanitized[key] = value;
    }
    return sanitized;
}

function compareCheckedStatesEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
}

export async function CompareDOMWithPopUp(frameworkA: FrameworkInterface, frameworkB: FrameworkInterface): Promise<boolean> {
    const popupA = await frameworkA.getPopupInfo();
    const popupB = await frameworkB.getPopupInfo();

    const pagesEqual = await CompareDOM(frameworkA, frameworkB);

    if (!popupA.hasPopup || !popupB.hasPopup) {
        return pagesEqual;
    }

    const setA = new Set(popupA.popupSignatures);
    const setB = new Set(popupB.popupSignatures);

    const samePopup = setA.size === setB.size && [...setA].every(sig => setB.has(sig));

    return samePopup && pagesEqual;
}