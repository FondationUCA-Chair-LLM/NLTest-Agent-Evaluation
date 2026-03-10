import { model_eval, model_assert, server, NUM_RUNS, test_suite, test_suite_images } from "./utils/console.js";
import { z } from "zod";

import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";
import { Obs } from "./models/Observe.js";

import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { resolve, join } from "path";
import { prompt_assert, prompt_eval } from "./config/prompts.js";
import { extract, splitWithOverlap } from "./utils/extractor.js";
import Asserter from "./models/Asserter.js";
import { FrameworkInterface } from "./Framework/FrameworkInterface.js";
import { FrameworkStagehand } from "./Framework/Implementation/stagehand/FrameworkStagehand.js"

import { compareImages } from "./utils/compare.js";

import { writeInFile, updateTotal } from "./utils/rapportsTests.js";

var NUM_RUNS_TEMP = NUM_RUNS;
const currentScreenshotPath = "./tmp/";

/* function evaluation */
function loadTestCases(filename: string): any {
  const filePath = resolve(filename);
  const fileContent = readFileSync(filePath, "utf-8");

  //check if the images in the test suite exist
  let errorList = [];

  // Ensure the screenshot temp folder exists and is empty
  const tmpDir = resolve(currentScreenshotPath);
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  } else {
    const entries = readdirSync(tmpDir);
    for (const entry of entries) {
      const entryPath = join(tmpDir, entry);
      rmSync(entryPath, { recursive: true });
    }
  }

  //check if expected screenshot files exist
  const testCases = JSON.parse(fileContent);
  for (const testCase of testCases) {
    for (const expectedFile of testCase.expected) {
      if (typeof expectedFile == "number") continue;
      const expectedFilePath = resolve(
        test_suite_images,
        String(expectedFile)
      );
      if (!existsSync(expectedFilePath)) {
        errorList.push(expectedFilePath);
      }
    }
  }
  if (errorList.length > 0) {
    throw new Error(
      `Missing expected screenshot files:\n${errorList.join(
        "\n"
      )}\nYou may want to run 'pnpm screenshots' to generate them.`
    );
  }
  return testCases;
}

async function main() {
  const test_cases = loadTestCases(test_suite);
  let total_eval: number[] = [];
  let total_nav: number[] = [];
  let total_assert: number[] = [];
  for (const test_case of test_cases) {
    console.log(`\n📋 Test Case: ${test_case.name} -----------------------------`);
    let all_eval: number[] = [];
    let all_nav: number[] = [];
    let all_assert: number[] = [];

    NUM_RUNS_TEMP = NUM_RUNS;

    for (let i = 0; i < NUM_RUNS_TEMP; i++) {
      console.log(`🚀 Run #${i + 1} -----------------------------`);
      const [eval_r, nav_r, assert_r] = await run_search(test_case.actions, test_case.expected);
      all_eval.push(...eval_r);
      all_nav.push(...nav_r);
      all_assert.push(...assert_r);
      console.log(all_assert);
    }
    // results to global totals
    total_eval.push(...all_eval);
    total_nav.push(...all_nav);
    total_assert.push(...all_assert);

    const [meval, mnav, massert] = compute_STD(all_eval, all_nav, all_assert);

    console.log(`\n📊 Final Metrics for Test Case: ${test_case.name}`);
    //console.log(`✅ Match Rate Eval:   ${(average(all_eval)).toFixed(2)}`);
    console.log(`✅ Match Rate Nav:    ${(average(all_nav)).toFixed(2)}`);
    console.log(`✅ Match Rate Assert: ${(average(all_assert)).toFixed(2)}`);
    //console.log(`📐 Eval Std Dev:      ${meval.toFixed(4)}`);
    console.log(`📐 Nav Std Dev:       ${mnav.toFixed(4)}`);
    console.log(`📐 Assert Std Dev:    ${massert.toFixed(4)}`);
    console.log(`📐 Nb of runs :    ${NUM_RUNS_TEMP}`);

    const rowName = ['Readiness', 'Navigation', 'Assertion', 'Standarddev_readi', 'Standarddev_nav', 'Standarddev_assert']
    const rowVal = [(average(all_eval)).toFixed(2), (average(all_nav)).toFixed(2), (average(all_assert)).toFixed(2), meval.toFixed(4), mnav.toFixed(4), massert.toFixed(4)]

    await writeInFile(rowName, rowVal);

    // Clear for next test case
    all_eval = [];
    all_nav = [];
    all_assert = [];
  }

  // Compute it across all test cases
  const [g_eval, g_nav, g_assert] = compute_STD(total_eval, total_nav, total_assert);

  console.log("\n 📊 GLOBAL METRICS ACROSS ALL TEST CASES -----------------------------");
  //console.log(`🌍 Global Match Rate Eval:   ${(average(total_eval)).toFixed(2)}`);
  console.log(`🌍 Global Match Rate Nav:    ${(average(total_nav)).toFixed(2)}`);
  console.log(`🌍 Global Match Rate Assert: ${(average(total_assert)).toFixed(2)}`);
  //console.log(`📐 Global Eval Std Dev:      ${g_eval.toFixed(4)}`);
  console.log(`📐 Global Nav Std Dev:       ${g_nav.toFixed(4)}`);
  console.log(`📐 Global Assert Std Dev:    ${g_assert.toFixed(4)}`);

  const rowName = ['Readiness', 'Navigation', 'Assertion', 'Standarddev_readi', 'Standarddev_nav', 'Standarddev_assert']
  const rowVal = [(average(total_eval)).toFixed(2), (average(total_nav)).toFixed(2), (average(total_assert)).toFixed(2), g_eval.toFixed(4), g_nav.toFixed(4), g_assert.toFixed(4)]
  await updateTotal(rowName, rowVal);

}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function run_search(
  task: string[],
  expected: number[] | string[]
): Promise<[number[], number[], number[]]> {

  const framework = await FrameworkStagehand.InitFramework();

  const [eval_results, nav_results, assert_results] = await simple_run(
    task, expected, framework
  );

  await framework.CloseFramework()

  return [eval_results, nav_results, assert_results];
}

async function simple_run(
  task: string[],
  expected: number[] | string[],
  framework: FrameworkInterface,
): Promise<[number[], number[], number[]]> {
  var verdict: boolean = true;
  var data: Obs = new Obs();
  var observed: boolean = false;
  var readiness: boolean = true;
  const eval_results: number[] = [];
  const nav_results: number[] = [];
  const assert_results: number[] = [];

  for (var i = 0; i < task.length; i++) {
    if (i === 0) {
      const site = task[0].match(/'([^']*)'/);
      if (!site) {
        console.log("No valid web site found.");
        return [[], [], []];
      }
      try {
        await framework.goto(site[1]);
        [data, observed] = await observe(data, true, framework, expected[i]);

      } catch (error) {
        console.log(`Navigation failed for ${site[1]}:`, error);
        return [[], [], []];
        verdict = false;
        break;
      }
    } else {
      if (!task[i].match(/Assert/)) {
        /*try {
          readiness = await evaluateWithLLM(framework, task[i], data);
          if (typeof expected[i] === "string") {
            eval_results.push(Number(readiness));
          }
          else {
            eval_results.push((Number(readiness) === expected[i]) ? 1 : 0);
          }
        }
        catch (error) {//eval_results.push(0); 
          console.log(`Evaluation failed at step ${i}: ${task[i]} ->`, error);
          NUM_RUNS_TEMP++;
          continue;
        }*/

        try {
          //eval agent
          console.debug("Performing action with nav agent:", task[i]);
          const r = await framework.act(task[i]);
          await framework.waitForTimeout(5000);

          let source = null;
          [data, observed] = await observe(data, r.success, framework, expected[i]);
          console.debug("Observation result:", data, observed, source);

          if (isNaN(Number(expected[i]))) {
            nav_results.push(Number(observed));
          }
          else {
            nav_results.push((Number(observed) === expected[i]) ? 1 : 0);
          }

          if (observed == false) {
            verdict = false;
            break;
          }
        }
        catch (error) {
          console.log(`Action failed at step ${i}: ${task[i]} ->`, error);
          //nav_results.push(0);
          verdict = false;
          NUM_RUNS_TEMP++;
          break;
        }
      } else {
        break;
      }
    }
  }

  console.log("********** Assertions **********");
  var result: string | undefined;
  var j = i;
  while (verdict === true && j < task.length) {
    let verdict2 = false;
    try {
      if (typeof result === 'undefined') {
        //const terms = extractTermsBetweenQuotes(task[j]);
        result = await extract(data, framework); // undefined, terms);
      }
      verdict2 = await assert(framework, result, task[j]);
      //console.log(verdict2, "********");
    } catch (error) {
      console.log(`Assertion failed at step ${j}: ${task[j]} ->`, error);
      //assert_results.push(0);
      NUM_RUNS_TEMP++;
      j++;
      continue;
    }
    const comp = (verdict2 == false) ? 0 : 1;
    assert_results.push(comp === expected[j] ? 1 : 0);
    verdict = verdict2;
    if (verdict == false) {
      break;
    }

    j++;
  }

  console.log("********** End of Assertions **********");
  console.log("Final verdict: " + verdict);

  return [eval_results, nav_results, assert_results];
}


async function observe(old: Obs, action_performed: boolean, framework: FrameworkInterface, exceptedTest: string | number): Promise<[Obs, boolean, string?]> {
  var obs = new Obs();
  var b: boolean = false;
  await obs.getUIElements(framework);
  //debug
  console.debug("Observe : found ", obs.links.length, " links");
  console.debug("Observe : found ", obs.buttons.length, " buttons");
  console.debug("Observe : found ", obs.forms.length, " forms");
  console.debug("Observe : found ", obs.fields.length, " fields");
  console.debug("Observe : found ", obs.checkboxes.length, " checkboxes");
  console.debug("Observe :  performed ", action_performed);
  console.debug("Observe Tables : ", obs.tables);
  console.debug("Observe : found ", obs.tables.length, " number of tables");

  if (!isNaN(Number(exceptedTest))) {
    return [obs, action_performed];
  }

  //cp img 
  let screenshotPath = `./${currentScreenshotPath}${String(exceptedTest)}`;
  await framework.takeScreenshot(screenshotPath);
  b = (await compareImages(screenshotPath, resolve(test_suite_images, String(exceptedTest))))

  return [obs, b];
}

async function assert(framework: FrameworkInterface, result1: string, inst?: string, ret?: z.AnyZodObject) {

  //call langchain to evaluate assertion
  const prompt = PromptTemplate.fromTemplate(prompt_assert);
  const llm = new Ollama({
    model: model_assert,
    temperature: 0,
    maxRetries: 5,
    baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
    //verbose: true, // for debug
    // other params...
  });
  const chunks = splitWithOverlap(result1, 4000, 50);
  console.debug(`############## assert : "${inst}" for ${chunks.length} chunks `);
  const nbAsserts = inst?.match(/Assert/g)?.length
  if (nbAsserts && nbAsserts > 1) return await Asserter.evaluateAssertionString(inst, chunks, llm);
  const negative_assertion = Asserter.is_negative_assertion(inst);
  return await Asserter.assert_all_chunks(negative_assertion, chunks, llm, Asserter.assert_chunk, inst);
}

// Appelle deux agents pour évaluer si l'action suivante peut être effectuée
async function evaluateWithLLM(framework: FrameworkInterface, term: string, data: Obs): Promise<boolean> {
  console.debug("Evaluate with LLM", term, "\n");
  let content = await extract(data, framework);

  const prompt = PromptTemplate.fromTemplate(prompt_eval);
  const llm = new Ollama({
    model: model_eval,
    temperature: 0,
    maxRetries: 5,
    baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
    // other params...
  });

  const chunks = splitWithOverlap(content, 4000, 50);
  const result: any[] = [];
  const chain = prompt.pipe(llm);
  for (const chunk of chunks) {
    var response = await chain.invoke({
      page: chunk,
      input: term,
    });
    console.debug("\n", "Evaluate with LLM response", response);
    response = response.toLowerCase();
    var match = response.match(/<\/think>\s*(.*)/s);
    var response = match ? match[1] : response;
    match = response.match(/verdict:(.*)/);
    response = match ? match[1] : response;
    result.push(response === "true" || (typeof response === "string" && (response.includes("true") || response.includes("yes"))));
  }
  return result.reduce((acc, val) => acc || val, false);
}

function normalized_std(binary_results: number[]): number {
  if (binary_results.length === 0) {
    return 0;
  }
  const p = average(binary_results);
  return 2 * Math.sqrt(p * (1 - p));
}

function compute_STD(
  eval_results: number[],
  nav_results: number[],
  assert_results: number[]
): [number, number, number] {
  const meval = normalized_std(eval_results);
  const mnav = normalized_std(nav_results);
  const massert = normalized_std(assert_results);
  return [meval, mnav, massert];
}

main();
