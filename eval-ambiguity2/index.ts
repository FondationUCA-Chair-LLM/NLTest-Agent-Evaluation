import { NUM_RUNS, test_suite } from "./config/config.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ParserStep } from "./models/ParserStep.js";

var NUM_RUNS_TEMP = NUM_RUNS;

/* function evaluation */
function loadTestCases(filename: string): any {
  const filePath = resolve(filename);
  const fileContent = readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent);
}

async function main() {
  const test_cases = loadTestCases(test_suite);
  let total_eval_clarity: number[] = [];
  for (const test_case of test_cases) {
    console.log(`\n📋 Test Case: ${test_case.name} -----------------------------`);
    let all_eval_clarity: number[] = [];

    NUM_RUNS_TEMP = NUM_RUNS;

    for (let i = 0; i < NUM_RUNS_TEMP; i++) {
      console.log(`🚀 Run #${i + 1} -----------------------------`);
      const eval_c = await run_clarity_tests(test_case.actions, test_case.actions_expected);
      all_eval_clarity.push(...eval_c);
    }
    try {
      total_eval_clarity.push(...all_eval_clarity);
    } catch (error) {
      console.error(`❌ Error accumulating clarity results for test case ${test_case.name}:`, error);
      if (NUM_RUNS_TEMP < NUM_RUNS+10) {
        NUM_RUNS_TEMP += 1;
      }
    }
    const [proba, mclarity] = compute_STD(all_eval_clarity);
    console.log(`\n📊 Results for Test Case: ${test_case.name} -----------------------------`) ;
    console.log(`📐 Number of Evaluations:      ${all_eval_clarity.length}`);
    console.log('Eval Clarity Results:', all_eval_clarity);
    console.log(`📐 Probability:      ${proba.toFixed(4)}`);
    console.log(`📐 Eval Std Clarity:      ${mclarity.toFixed(4)}`);
  }

  // Compute it across all test cases
  const [g_proba, g_clarity] = compute_STD(total_eval_clarity);

  console.log(`📐 Global Probability Clarity:    ${g_proba.toFixed(4)}`);
  console.log(`📐 Global Eval Std clarity:    ${g_clarity.toFixed(4)}`);

}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function run_clarity_tests(
  task: string[],
  taskExpected: string[],
): Promise<number[]> {
  const eval_clarity: number[] = [];

  for (var i = 0; i < task.length; i++) {
    if (i !== 0) {
      if (!task[i].startsWith("Assert")) {
        let parserstep = new ParserStep();
        const result_parse = await parserstep.CheckStep(task, i);
        eval_clarity.push(...result_parse.res);
        console.debug(`📐 Eval Clarity:      ${result_parse.res}`);
        eval_clarity.push(...result_parse.res);
        console.debug(`📐 Eval Clarity:      ${result_parse.res}`);
      }
    }
  }
  return eval_clarity;
}

function normalized_std(binary_results: number[]): [number, number] {
  if (binary_results.length === 0) {
    return [0, 0];
  }
  const p = average(binary_results);
  return [p, 2 * Math.sqrt(p * (1 - p))];
}

function compute_STD(
  eval_clarity: number[]
): [number, number] {
  const [proba, mclarity] = normalized_std(eval_clarity);
  return [proba, mclarity];
}

main();