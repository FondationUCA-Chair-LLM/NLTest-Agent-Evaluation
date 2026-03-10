import { readFileSync } from "fs";
import { resolve } from "path";
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { imagePercentageDiff } from "./console.js";

// compare 2 images and return true if they are similar within the defined threshold (defined in stagehand.config.ts)
export async function compareImages(comparedImage: string, comparisonImage: string): Promise<boolean> {
    const pathComparedImage = resolve(comparedImage);
    const pathComparisonImage = resolve(comparisonImage);
    console.debug(`Comparing images:\n${pathComparedImage}\n${pathComparisonImage}`);

    const contentComparedImage = PNG.sync.read(readFileSync(pathComparedImage));
    const contentComparisonImage = PNG.sync.read(readFileSync(pathComparisonImage));
    const { width, height } = contentComparedImage;
    const diff = new PNG({ width, height });

    const numDiff = pixelmatch(contentComparedImage.data, contentComparisonImage.data, diff.data, width, height, { threshold: 0 });
    const percDiff = numDiff / (width * height) * 100;

    console.debug(`Image comparison: ${numDiff} different pixels, which is ${percDiff.toFixed(2)}% difference.`);

    return !(percDiff > imagePercentageDiff);
}
