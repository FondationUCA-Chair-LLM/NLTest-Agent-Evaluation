import { model_eval, test_suite } from "../config/config.js";
import ExcelJS from 'exceljs';

async function createExcelFile(titles: string[], values: string[]) {
    const workbook = new ExcelJS.Workbook();
    const model = model_eval.replace(":", " ");
    const sheet = workbook.addWorksheet(model);

    sheet.columns = [
        { header: 'Site_eval', key: 'site_eval', width: 20 },
        { header: 'Readiness', key: 'readiness', width: 20 },
        { header: 'Navigation', key: 'navigation', width: 20 },
        { header: 'Assertion', key: 'assertion', width: 20 },
        { header: 'Standarddev_readi', key: 'standarddev_readi', width: 20 },
        { header: 'Standarddev_nav', key: 'standarddev_nav', width: 20 },
        { header: 'Standarddev_assert', key: 'standarddev_assert', width: 20 },
        { header: 'Site_nl', key: 'site_nl', width: 20 },
        { header: 'Correctness', key: 'correctness', width: 20 },
        { header: 'Real_consis', key: 'real_consis', width: 20 },
        { header: 'Consistency', key: 'consistency', width: 20 },
        { header: 'Err_relative_moy', key: 'err_relative_moy', width: 20 },
        { header: 'Nb_fail', key: 'nb_fail', width: 20 },
        { header: 'Nb_INC', key: 'nb_inc', width: 20 }
    ];

    const row: Record<string, any> = {};


    const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");
    row['site_eval'] = site;

    sheet.addRow(row);

    row['site_eval'] = null;
    titles.forEach((t, i) => row[t.toLowerCase()] = values[i]);

    sheet.addRow(row);

    sheet.getRow(2).getCell('site_eval').font = {
        color: { argb: 'FF0000' }
    };

    console.log("colonnes créées");

    await workbook.xlsx.writeFile('../WebSites&Results/results.xlsx'); //results.xlsx
    console.log("Fichier créé !");
}


export async function writeInFile(titles: string[], values: string[]) {
    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.readFile('../WebSites&Results/results.xlsx'); //results.xlsx
    } catch {
        console.debug("Fichier manquant, création du fichier…");
        await createExcelFile(titles, values);
        return;
    }

    const model = model_eval.replace(":", " ");
    let sheet = workbook.getWorksheet(model);

    if (!sheet) {
        console.error('Feuille absente, création...');
        sheet = workbook.addWorksheet(model);

        sheet.columns = [
            { header: 'Site_eval', key: 'site_eval', width: 20 },
            { header: 'Readiness', key: 'readiness', width: 20 },
            { header: 'Navigation', key: 'navigation', width: 20 },
            { header: 'Assertion', key: 'assertion', width: 20 },
            { header: 'Standarddev_readi', key: 'standarddev_readi', width: 20 },
            { header: 'Standarddev_nav', key: 'standarddev_nav', width: 20 },
            { header: 'Standarddev_assert', key: 'standarddev_assert', width: 20 },
            { header: 'Site_nl', key: 'site_nl', width: 20 },
            { header: 'Correctness', key: 'correctness', width: 20 },
            { header: 'Real_consis', key: 'real_consis', width: 20 },
            { header: 'Consistency', key: 'consistency', width: 20 },
            { header: 'Err_relative_moy', key: 'err_relative_moy', width: 20 },
            { header: 'Nb_fail', key: 'nb_fail', width: 20 },
            { header: 'Nb_INC', key: 'nb_inc', width: 20 }
        ];


        const row: Record<string, any> = {};

        const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");
        row['site_eval'] = site;
        sheet.addRow(row);

        row['site_eval'] = null;
        titles.forEach((t, i) => row[t.toLowerCase()] = values[i]);

        sheet.addRow(row);

        sheet.getRow(2).getCell('site_eval').font = {
            color: { argb: 'FF0000' }
        };

        // const rowColor = sheet.getRow(2);

        // titles.forEach(key => {
        //     const cell = rowColor.getCell(key.toLowerCase());
        //     if (cell) {
        //         cell.font = { color: { argb: 'FF0000' } };
        //     }
        // });

        await workbook.xlsx.writeFile('../WebSites&Results/results.xlsx'); //results.xlsx
        console.log("Feuille recréée et ligne ajoutée !");
        return;
    }



    const headerRow = sheet.getRow(1);

    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];

    if (headerValues.length === 0) {
        console.error("Aucune en-tête trouvée dans la feuille; impossible de réinjecter les colonnes.");
        sheet.columns = [];
    } else {
        sheet.columns = headerValues.map((header: any) => ({
            header: String(header),
            key: String(header).toLowerCase(),
            width: 20
        }));
    }




    let lastReadinessUsedRow = 1;
    const totalReadinessRows = sheet.rowCount || 1;

    const colIndexReadi = getColIndexByKey("readiness");

    if (colIndexReadi === null) {
        console.error(`Colonne manquante : "readiness"`);
        return;
    }


    for (let r = totalReadinessRows; r >= 2; r--) {
        const cell = sheet.getRow(r).getCell(colIndexReadi);
        const val = cell ? cell.value : null;
        if (val !== null && val !== undefined) {
            if (r > lastReadinessUsedRow) lastReadinessUsedRow = r;
            break;
        }
    }


    const cellReadi = sheet.getRow(lastReadinessUsedRow).getCell(colIndexReadi);
    const font = cellReadi.font;

    const colIndex = getColIndexByKey("site_eval");
    const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");



    let passed = false;

    if (colIndex === null) return;

    if (font && font.color && font.color.argb === 'FF0000') {
        sheet.getRow(lastReadinessUsedRow + 2).getCell(colIndex).value = site;

        sheet.getRow(lastReadinessUsedRow + 2).getCell('site_eval').font = {
            color: { argb: 'FF0000' }
        };
        titles.forEach((t, i) => {
            sheet.getRow(lastReadinessUsedRow + 2).getCell(t.toLowerCase()).value = values[i];
        });
    }
    else {
        titles.forEach((t, i) => {
            sheet.getRow(lastReadinessUsedRow + 1).getCell(t.toLowerCase()).value = values[i];
        });

    }

    function getColIndexByKey(key: string): number | null {
        const k = key.toLowerCase();
        if (!sheet) return null;
        const cols = sheet.columns;

        for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const colKey = col.key ? String(col.key).toLowerCase() : "";
            if (colKey === k) return i + 1;
        }

        return null;
    }

    await workbook.xlsx.writeFile('../WebSites&Results/results.xlsx'); //results.xlsx
    console.log(`Valeurs ajoutées !`);
}





export async function updateTotal(titles: string[], values: string[]) {
    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.readFile('../WebSites&Results/results.xlsx'); //results.xlsx
    } catch {
        console.log("Fichier manquant, création du fichier…");
        //await createExcelFile(titles, values);
        return;
    }

    const model = model_eval.replace(":", " ");
    let sheet = workbook.getWorksheet(model);

    if (!sheet) {
        console.error('Feuille absente, création...');
        sheet = workbook.addWorksheet(model);

        sheet.columns = [
            { header: 'Site_eval', key: 'site_eval', width: 20 },
            { header: 'Readiness', key: 'readiness', width: 20 },
            { header: 'Navigation', key: 'navigation', width: 20 },
            { header: 'Assertion', key: 'assertion', width: 20 },
            { header: 'Standarddev_readi', key: 'standarddev_readi', width: 20 },
            { header: 'Standarddev_nav', key: 'standarddev_nav', width: 20 },
            { header: 'Standarddev_assert', key: 'standarddev_assert', width: 20 },
            { header: 'Site_nl', key: 'site_nl', width: 20 },
            { header: 'Correctness', key: 'correctness', width: 20 },
            { header: 'Real_consis', key: 'real_consis', width: 20 },
            { header: 'Consistency', key: 'consistency', width: 20 },
            { header: 'Err_relative_moy', key: 'err_relative_moy', width: 20 },
            { header: 'Nb_fail', key: 'nb_fail', width: 20 },
            { header: 'Nb_INC', key: 'nb_inc', width: 20 }
        ];


        const row: Record<string, any> = {};

        const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");
        row['site_eval'] = site;
        sheet.addRow(row);

        row['site_eval'] = null;
        titles.forEach((t, i) => row[t.toLowerCase()] = values[i]);

        sheet.addRow(row);

        sheet.getRow(2).getCell('site_eval').font = {
            color: { argb: 'FF0000' }
        };

        await workbook.xlsx.writeFile('../WebSites&Results/results.xlsx'); //results.xlsx
        console.log("Feuille recréée et ligne ajoutée !");
        return;
    }


    function getColIndexByKey(key: string): number | null {
        const k = key.toLowerCase();
        if (!sheet) return null;
        const cols = sheet.columns;

        for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const colKey = col.key ? String(col.key).toLowerCase() : "";
            if (colKey === k) return i + 1;
        }

        return null;
    }


    const headerRow = sheet.getRow(1);

    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];

    if (headerValues.length === 0) {
        console.error("Aucune en-tête trouvée dans la feuille; impossible de réinjecter les colonnes.");
        sheet.columns = [];
    } else {
        sheet.columns = headerValues.map((header: any) => ({
            header: String(header),
            key: String(header).toLowerCase(),
            width: 20
        }));
    }

    let lastSiteUsedRow = 1;
    const totalRows = sheet.rowCount || 1;

    const colIndex = getColIndexByKey('readiness');

    if (colIndex === null) {
        console.error(`Colonne manquante : "readiness"`);
        return;
    }

    for (let r = totalRows; r >= 2; r--) {
        const cell = sheet.getRow(r).getCell(colIndex);
        const val = cell ? cell.value : null;
        if (val !== null && val !== undefined) {
            if (r > lastSiteUsedRow) lastSiteUsedRow = r;
            break;
        }
    }

    titles.forEach((t, i) => {

        console.log(lastSiteUsedRow);
        console.log(values[i]);
        console.log(t.toLocaleLowerCase());
        sheet.getRow(lastSiteUsedRow).getCell(t.toLowerCase()).value = values[i];


        const cell = sheet.getRow(lastSiteUsedRow).getCell(t.toLowerCase());
        if (cell) {
            cell.font = { color: { argb: 'FF0000' } };
        }
    });

    await workbook.xlsx.writeFile('../WebSites&Results/results.xlsx'); //results.xlsx
    console.log(`Valeurs ajoutées !`);
}