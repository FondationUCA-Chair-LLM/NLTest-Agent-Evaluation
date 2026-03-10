import { FrameworkInterface } from "../Framework/FrameworkInterface.js";

export async function getTablesFromUIWithFusion(framework: FrameworkInterface): Promise<string[][]> {
    const tstring: string[][] = []
    const tables = await getTables(framework)
    for (let i = 0; i < tables.length; i++) {
        let t = await getFinalTables(tables[i], i)
        tstring.push(cleanHtml(t))
    }
    return tstring
}

function cleanHtml(table: string[]): string[] {
    return table.map(cellHtml => {
        // Supprime les balises th et td et leurs attributs
        let cleaned = cellHtml
            // Supprime <th ...> ou <td ...>
            .replace(/<t[dh][^>]*>/gi, '')
            // Supprime </th> et </td>
            .replace(/<\/t[dh]>/gi, '')
            // Supprime colspan="x" et rowspan="y" (au cas où il reste dans d'autres balises)
            .replace(/\s*(colspan|rowspan)="\d*"/gi, '')
            // Supprime les espaces en début/fin
            .trim();

        return cleaned;
    });
}

async function getTables(framework: FrameworkInterface): Promise<string[][][]> {
    const tables = await framework.extractTables();
    return tables.map(table => {
        if (IsColumn(table)) {
            return transpose(table);
        }
        return table;
    });
}

function transpose(table: string[][]): string[][] {
    const rows = table.length;
    const cols = table[0].length;
    const result: string[][] = [];

    for (let c = 0; c < cols; c++) {
        const newRow: string[] = [];
        for (let r = 0; r < rows; r++) {
            newRow.push(table[r][c] ?? "");
        }
        result.push(newRow);
    }
    return result;
}

function IsColumn(table: string[][]): boolean {
    for (const row of table) {
        let hasTh = false;
        let hasTd = false;

        for (const cell of row) {
            const cellLower = cell.toLowerCase().trim();
            if (cellLower.startsWith('<th')) {
                hasTh = true;
            } else if (cellLower.startsWith('<td')) {
                hasTd = true;
            }
        }

        // Si un mélange de th et td est trouvé → vertical
        if (hasTh && hasTd) {
            return true;
        }
    }

    // Sinon, toutes les lignes sont purement th ou td → horizontal
    return false;
}

async function getFinalTables(table: string[][], pos: number): Promise<string[]> {

    // const vertical = IsColumn(table)

    let standardizeTable: string[][]
    let tab: string[][][]
    let headerTable: string[][] = []
    let contentTable: string[][] = []
    standardizeTable = StandardizeTable(table)

    tab = getHeaderAndContent(standardizeTable)
    headerTable = tab[0]
    contentTable = tab[1]

    const FinalheaderTable = cleanHeaderTable(headerTable)
    return FormatTable(FinalheaderTable, contentTable)
}

function FormatTable(header: string[], content: string[][]): string[] {
    const strTab: string[] = [];

    for (let i = 0; i < content.length; i++) {
        const row = content[i] || [];
        const pairs: string[] = [];

        for (let j = 0; j < row.length; j++) {
            pairs.push(`${header[j]}:${row[j]}`);
        }

        strTab.push(`{ ${pairs.join(", ")} }`);
    }
    return strTab;
}

function getHeaderAndContent(table: string[][]): [string[][], string[][]] {
    const th: string[][] = [];
    const td: string[][] = [];

    for (let i = 0; i < table.length; i++) {
        const row = table[i];
        const thRow: string[] = [];
        const tdRow: string[] = [];

        for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (IsHeader(cell)) {
                thRow.push(cell);
            } else {
                tdRow.push(cell);
            }
        }

        if (thRow.length > 0) th.push(thRow);
        if (tdRow.length > 0) td.push(tdRow);
    }
    return [th, td];
}

function IsHeader(cell: string): Boolean {
    if (!cell) return false;
    return /<\s*th\b[^>]*>/i.test(cell);
}

function insertAt<T>(list: T[], element: T, index: number): T[] {

    if (index < 0) {
        throw new Error("Index hors limites");
    }

    // Si insertion plus loin que la fin → on remplit avec undefined
    while (list.length < index) {
        list.push(undefined as unknown as T);
    }

    // index == list.length  → insertion à la fin
    list.splice(index, 0, element);

    return list;
}

function StandardizeTable(table: string[][]) {

    const cellDico: Record<number, [number, string]> = {};

    table.forEach(line => {

        // Le maxIndex doit être ré-évalué après chaque insertion
        const computeMax = () => Math.max(
            line.length - 1,
            ...Object.keys(cellDico).map(k => parseInt(k))
        );

        let maxIndex = computeMax();

        // Itération de droite → gauche
        for (let i = maxIndex; i >= 0; i--) {

            // 1️⃣ Appliquer un rowspan existant AVANT toute lecture de cell
            if (cellDico[i]) {
                insertAt(line, cellDico[i][1], i);
                if (cellDico[i][0] === 1) delete cellDico[i];
                else cellDico[i][0]--;
                maxIndex = computeMax();
                continue;
            }

            let cell = line[i];
            if (cell === undefined) continue;

            // 2️⃣ Détection du rowspan
            const rowspan = IsRowSpan(cell);
            if (rowspan > 1) {
                const cleared = clearCellRowspan(cell);
                cellDico[i] = [rowspan - 1, cleared];
            }

            // 3️⃣ Détection du colspan
            const colspan = IsColSpan(cell);
            if (colspan > 1) {
                const cleared = clearCellColspan(cell);
                for (let c = 1; c < colspan; c++) {
                    // Remplir les colonnes manquantes avec la même valeur
                    insertAt(line, cleared, i + 1);
                }
                maxIndex = computeMax();
            }
        }

        // 4️⃣ Ajuster la longueur de la ligne pour correspondre au header final
        // headerLength = nombre de colonnes après standardisation du header
        const headerLength = table[0].length; // ou valeur fixe si tu as le header final
        // while (line.length < headerLength) {
        //     line.push(""); // ou undefined si tu veux
        // }
    });

    return table;
}

function extractText(html: string): string {
    return html.replace(/<[^>]+>/g, "").trim();
}

function cleanHeaderTable(headerTable: string[][]): string[] {
    const rows = headerTable.length;
    if (!headerTable[0]) headerTable[0] = [];
    const cols = headerTable[0].length;

    const finalHeader: string[] = [];

    for (let col = 0; col < cols; col++) {
        let parts: string[] = [];

        for (let row = 0; row < rows; row++) {
            const raw = headerTable[row][col] ?? "";
            const cell = extractText(raw);

            if (cell === "") continue;
            if (parts[parts.length - 1] !== cell) {
                parts.push(cell);
            }
        }

        finalHeader.push(parts.join("_"));
    }

    return finalHeader;
}

function IsRowSpan(cell: string) {
    const match = cell.match(/rowspan\s*=\s*"(\d+)"/i);
    if (!match) return 0;
    return parseInt(match[1], 10);
}

function IsColSpan(cell: string) {
    const match = cell.match(/colspan\s*=\s*"(\d+)"/i);
    if (!match) return 0;
    return parseInt(match[1], 10);
}

function clearCellRowspan(cell: string) {
    // Supprime l'attribut rowspan="..." (insensible à la casse et aux espaces)
    const newCell = cell.replace(/\s*rowspan\s*=\s*"\d+"/i, "");
    return newCell;
}

function clearCellColspan(cell: string) {
    // Supprime l'attribut colspan="..." (insensible à la casse et aux espaces)
    const newCell = cell.replace(/\s*colspan\s*=\s*"\d+"/i, "");
    return newCell;
}