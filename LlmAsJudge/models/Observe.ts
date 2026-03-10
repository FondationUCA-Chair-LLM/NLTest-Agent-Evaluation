import { parseElements } from '../utils/extractor.js';
import { FrameworkInterface } from '../Framework/FrameworkInterface.js';

export class Obs {
    links: string[] = [];
    buttons: string[] = [];
    forms: string[] = [];
    checkboxes: string[] = [];
    selects: string[] = [];
    fields: string[] = [];
    fieldValues: Record<string, string> = {};
    checkedStates: Record<string, boolean> = {};
    statictText: string[] = [];
    tables: Array<Array<string>>;
    framework?: FrameworkInterface;

    constructor(
        links: string[] = [],
        buttons: string[] = [],
        forms: string[] = [],
        fields: string[] = [],
        checkboxes: string[] = [],
        selects: string[] = [],
        statictText: string[] = [],
        tables: Array<Array<string>> = [],
        framework?: FrameworkInterface
    ) {
        this.links = links;
        this.buttons = buttons;
        this.forms = forms;
        this.checkboxes = checkboxes;
        this.fields = fields;
        this.selects = selects;
        this.statictText = statictText;
        this.tables = tables;
        this.framework = framework;
    }

    equals(other: Obs): boolean {
        if (!(other instanceof Obs)) return false;
        return (
            new Set(this.links).size === new Set(other.links).size &&
            new Set(this.buttons).size === new Set(other.buttons).size &&
            new Set(this.fields).size === new Set(other.fields).size &&
            new Set(this.forms).size === new Set(other.forms).size &&
            new Set(this.checkboxes).size === new Set(other.checkboxes).size &&
            new Set(this.statictText).size === new Set(other.statictText).size
        );
    }

    async getUIElements(framework: FrameworkInterface): Promise<void> {
        const ui = await framework.getUIElements()
        this.links = ui.links;
        this.buttons = ui.buttons;
        this.fields = ui.fields;
        this.forms = ui.forms;
        this.checkboxes = ui.checkboxes;
        this.selects = ui.selects;
        this.statictText = ui.staticText;
        this.fieldValues = ui.fieldValues;

        // Extraction via parseElements si nécessaire
        const cpage = await framework.extract();
        const results = parseElements(cpage.page_text);
        for (const r of results) {
            const desc = r.description ?? "(no description)";
            const type = r.type ?? "";
            switch (type) {
                case "link": this.links.push(desc); break;
                case "button": this.buttons.push(desc); break;
                case "form": this.forms.push(desc); break;
                case "field":
                    this.fields.push(desc);
                    this.fieldValues[desc] = ""; // valeur inconnue
                    break;
                case "checkbox": this.checkboxes.push(desc); break;
                case "select": this.selects.push(desc); break;
                case "staticText": this.statictText.push(desc); break;
            }
        }
    }

    static async getUIElementsByText(filter: string, framework: FrameworkInterface): Promise<string[]> {
        return await framework.getByTextWithInnerText(filter)
    }

    static eleToJson(linkList: string[], eleType: string): string {
        return linkList.map(link => `{"id": "", "description": "${link}", "type": "${eleType}"}`).join("\n");
    }
}
