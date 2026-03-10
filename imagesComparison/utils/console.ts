import chalk from "chalk";
import {
    test_suite as imported_test_suite,
    test_suite_images as imported_test_suite_images,
    NUM_RUNS as imported_NUM_RUNS,
    model_eval as imported_model_eval,
    model_assert as imported_model_assert,
    model_nav as imported_model_nav,
    model_convert_step as imported_model_convert_step,
    server as imported_server,
    imagePercentageDiff as imported_imagePercentageDiff
} from "../config/config.js";

let _test_suite = imported_test_suite;
let _NUM_RUNS = imported_NUM_RUNS;
let _model_eval = imported_model_eval;
let _model_assert = imported_model_assert;
let _model_nav = imported_model_nav;
let _model_convert_step = imported_model_convert_step;
let _server = imported_server;
let _test_suite_images = imported_test_suite_images;
let _imagePercentageDiff = imported_imagePercentageDiff;

const configOverrides = {
    "test_suite": { get value() { return _test_suite; }, set value(v) { _test_suite = v; }, type: String },
    "NUM_RUNS": { get value() { return _NUM_RUNS; }, set value(v) { _NUM_RUNS = v; }, type: Number },
    "model_eval": { get value() { return _model_eval; }, set value(v) { _model_eval = v; }, type: String },
    "model_assert": { get value() { return _model_assert; }, set value(v) { _model_assert = v; }, type: String },
    "model_nav": { get value() { return _model_nav; }, set value(v) { _model_nav = v; }, type: String },
    "model_convert_step": { get value() { return _model_convert_step; }, set value(v) { _model_convert_step = v; }, type: String },
    "server": { get value() { return _server; }, set value(v) { _server = v; }, type: String },
    "test_suite_images": { get value() { return _test_suite_images; }, set value(v) { _test_suite_images = v; }, type: String },
    "imagePercentageDiff": { get value() { return _imagePercentageDiff; }, set value(v) { _imagePercentageDiff = v; }, type: Number }
} as Record<string, { value: any; type: any }>;

function process_args(argv: string[]): Record<string, string> {
    const args = argv.slice(2);
    let parsed = {} as Record<string, string>;
    for (const arg of args) {
        const [key, ...rest] = arg.split(':');
        const value = rest.join(':');
        if (!value) continue;
        parsed[key] = value;
    }
    return parsed;
}

function check_help() {
    if (["help", "h", "-help", "-h", "--help", "--h"].includes(process.argv[2])) {
        console.log("Usage: npm start [key:value ...]");
        console.log("Example: npm start NUM_RUNS:10 model_eval:myModel");
        console.log("Available arguments:");
        for (const key of Object.keys(configOverrides)) {
            console.log(` - ${key}:${configOverrides[key].type.name}`);
        }
        return true;
    }
    return false;
}

async function main() {
    const args = process_args(process.argv);

    if (check_help()) process.exit(0);

    for (const [key, value] of Object.entries(args)) {
        if (key in configOverrides) {
            console.debug(chalk.green(`🔁 Overridden ${key} from ${configOverrides[key].value} to -> ${value}`));
            configOverrides[key].value = configOverrides[key].type(value);
        } else {
            console.warn(`Unknown argument: ${key}`);
        }
    }
}

await main();

export const test_suite = _test_suite;
export const NUM_RUNS = _NUM_RUNS;
export const model_eval = _model_eval;
export const model_assert = _model_assert;
export const model_nav = _model_nav;
export const model_convert_step = _model_convert_step;
export const server = _server;
export const test_suite_images = _test_suite_images;
export const imagePercentageDiff = _imagePercentageDiff;