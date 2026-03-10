import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import {model_eval, model_assert, NUM_RUNS, server, StagehandConfig} from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";
import { Obs } from "./Observe.js";

import * as fs from "fs";
import * as path from "path";
import { exit } from "process";

const prompt_extract2 = "Extract all the elements with the format (id, description, type).\n Use the the DOM structure to get the type (button, link, title).";

const prompt_extract = `Extract all the elements of the current page. Return these elements with the format (id, description, type).\n 
Use the the DOM structure to get the type (button, link, StaticText).\n
The description should be the text content of the element.\n
Read the descriptions and the types of the elements carrefully to not forget any element.\n
example:\n
<a href="https://toto.org" id="1">Example</a>\n
id: 1, description: 'Example', type: 'link'\n
`;

const prompt_assert = `Your task is to return the result of an Assertion evaluated on the page. You will be given the page content and an Assertion.\n
                Tha page content is a list of elements formatted as 'id, description, type'\n 
                Respond 'True' if the Assertion is True and 'False' otherwise.\n
                Let think step by step and return the final verdict.\n
                Read the descriptions and the types of the elements carrefully.\n
                Assertion: {input},\n
                Page: {page}'
                `;
const prompt_eval = `Your task is to check if an action can be performed on the page. You will be given a page content and an action.
The page content is a list of elements formatted as 'id, description, type'\n 
Respond 'True' if the action can be performed on the page and 'False' otherwise.\n
Let think step by step and return the final verdict.\n
Read the descriptions and the types of the elements carrefully.\n
Action: {input}, 
Page: {page}`;

/* function evaluation */
function loadTestCases(filename: string): any {
    const filePath = path.resolve(filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
}

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {

    const test_cases = loadTestCases('test_cases.json');
    let total_eval: number[] = [];
    let total_nav: number[] = [];
    let total_assert: number[] = [];
    for (const test_case of test_cases) {
        console.log(`\n📋 Test Case: ${test_case.name} -----------------------------`);
        let all_eval: number[] = [];
        let all_nav: number[] = [];
        let all_assert: number[] = [];
        
         for (let i = 0; i < NUM_RUNS; i++) {
            console.log(`🚀 Run #${i + 1} -----------------------------`);
            const [eval_r, nav_r, assert_r] = await run_search(test_case.actions, test_case.expected);
            console.log(`Test case Eval Results: ${eval_r}`);
            console.log(`Test case Nav Results: ${nav_r}`);
            console.log(`Test case  Assert Results: ${assert_r}`);
            all_eval.push(...eval_r);
            all_nav.push(...nav_r);
            all_assert.push(...assert_r);
        }
         // results to global totals
        total_eval.push(...all_eval);
        total_nav.push(...all_nav);
        total_assert.push(...all_assert);

        const [meval, mnav, massert] = compute_STD(all_eval, all_nav, all_assert);

        console.log(`\n📊 Final Metrics for Test Case: ${test_case.name}`);
        console.log(`✅ Match Rate Eval:   ${(average(all_eval)).toFixed(2)}`);
        console.log(`✅ Match Rate Nav:    ${(average(all_nav)).toFixed(2)}`);
        console.log(`✅ Match Rate Assert: ${(average(all_assert)).toFixed(2)}`);
        console.log(`📐 Eval Std Dev:      ${meval.toFixed(4)}`);
        console.log(`📐 Nav Std Dev:       ${mnav.toFixed(4)}`);
        console.log(`📐 Assert Std Dev:    ${massert.toFixed(4)}`);

        // Clear for next test case
        all_eval = [];
        all_nav = [];
        all_assert = [];
    }

    // Compute it across all test cases
    const [g_eval, g_nav, g_assert] = compute_STD(total_eval, total_nav, total_assert);

    console.log("\n 📊 GLOBAL METRICS ACROSS ALL TEST CASES -----------------------------");
    console.log(`🌍 Global Match Rate Eval:   ${(average(total_eval)).toFixed(2)}`);
    console.log(`🌍 Global Match Rate Nav:    ${(average(total_nav)).toFixed(2)}`);
    console.log(`🌍 Global Match Rate Assert: ${(average(total_assert)).toFixed(2)}`);
    console.log(`📐 Global Eval Std Dev:      ${g_eval.toFixed(4)}`);
    console.log(`📐 Global Nav Std Dev:       ${g_nav.toFixed(4)}`);
    console.log(`📐 Global Assert Std Dev:    ${g_assert.toFixed(4)}`);
}

function average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function run_search(
    task: string[],
    expected: number[]
): Promise<[number[], number[], number[]]> {
    const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  
const [eval_results, nav_results, assert_results] = await simple_run(
        task, expected, context, page
    );

  await stagehand.close();

  return [eval_results, nav_results, assert_results];
}

async function simple_run(
    task: string[],
    expected: number[],
    context: BrowserContext,
    page: Page
): Promise<[number[], number[], number[]]> {
    var verdict: boolean = true;
    var data: Obs = new Obs();
    var observed: boolean = false;
    var readiness: boolean = true;
   let actual_index = 0;
    const eval_results: number[] = [];
    const nav_results: number[] = [];
    const assert_results: number[] = [];
   //navigation & evaluation
  for (var i = 0; i < task.length; i++) {
   if (i==0) {
        const site = task[0].match(/'([^']*)'/);
        if (!site) {
            console.log("No valid web site found.");
            return [[], [], []]; // Exit early with empty results if site is null
        }
        await page.goto(site[1]);
        //observe
        [data, observed] = await observe(data, true, page);
         //*******TOCHECK fail ? */
    }
   else {
        if (task[i].startsWith("Assert")==false){
          //evaluate
          readiness = await evaluateWithLLM(page, task[i], data);
          eval_results.push((Number(readiness) === expected[actual_index]) ? 1 : 0); 
            if (readiness == false){
                     console.log ("Fail, evaluate-next KO");
                     //verdict = false;
                     //break;
            } 
          console.log("***current step :"+task[i]  +"***");
          let r=await page.act({ action: task[i]}); // Use the LLM to perform the action , timeoutMs: 5000 
          //await page.waitForTimeout(5000);
          //observe
          [data, observed] = await observe(data, r.success, page); //*******TOCHECK true A MODIFER PAR RETOUR AGENT NAVIGATION */
          nav_results.push((Number(observed) === expected[actual_index]) ? 1 : 0); //*******TOCHECK bassé sur retour agent qui peut être faux expected devrait être un lien ?*/
          if (observed == false){
                     console.log ("Fail, observe-next KO");
                     //*******TOCHECK*/
                     verdict = false;
                     return [eval_results, nav_results, assert_results];

            }
          actual_index += 1;
        }
        else break;
      }}
  //assertions
  console.log("********** Assertions **********");
  var result: string | undefined;
  var j=i;
  while (verdict == true && j < task.length) {      
      if (typeof result == 'undefined')
      {
        //extract
        result = await extract(data,page); 
      }
      //LLM Assert
      const verdict2 = await assert(page,result, task[j]);
      console.log("*** Verdict (llm assert) "+ j  +": "+verdict2+" ***");
      let nbverdict = 0;
      if (verdict2.includes("True") || verdict2.includes("true")) nbverdict = 1;
      else nbverdict = 0;
      assert_results.push(nbverdict === expected[actual_index] ? 1 : 0);
      actual_index += 1;
      if (nbverdict== 0) {
                     verdict = false;
                      return [eval_results, nav_results, assert_results];
            }    
  
  j++;
}
console.log("********** End of Assertions **********");
console.log("Final verdict: " + verdict);




  // Use act() to take actions on the page


  /* Use observe() to plan an action before doing it
  const [action] = await page.observe(
    "Type 'Tell me in one sentence why I should use Stagehand' into the search box",
  );
  await drawObserveOverlay(page, [action]); // Highlight the search box
  await page.waitForTimeout(1_000);
  await clearOverlays(page); // Remove the highlight before typing
  await page.act(action); // Take the action

  // For more on caching, check out our docs: https://docs.stagehand.dev/examples/caching
  await page.waitForTimeout(1_000);
  await actWithCache(page, "Click the suggestion to use AI");
  await page.waitForTimeout(5_000);

  // Use extract() to extract structured data from the page
  const { text } = await page.extract({
    instruction:
      "extract the text of the AI suggestion from the search results",
    schema: z.object({
      text: z.string(),
    }),
  });
  stagehand.log({
    category: "create-browser-app",
    message: `Got AI Suggestion`,
    auxiliary: {
      text: {
        value: text,
        type: "string",
      },
    },
  });*/

  return [eval_results, nav_results, assert_results];
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  
}

async function observe(old: Obs, action_performed: boolean, page: Page, ): Promise<[Obs, boolean]> {
    var obs = new Obs();
    var b: boolean = false;
    await obs.getUIElements(page);
    //debug
    console.log("Observe : found ", obs.links.length, " links");
    console.log("Observe : found ", obs.buttons.length, " buttons");
    console.log("Observe : found ", obs.forms.length, " forms");
    console.log("Observe : found ", obs.fields.length, " fields");
    console.log("Observe : found ", obs.checkboxes.length, " checkboxes");
    console.log("Observe :  performed ", action_performed);

    if (action_performed==true) b=true; //and (old != obs): b=true // TODO PB ICI si on reste sur la même page il faut comparer 2 screenshots ???
    else b=false;
    return [obs, b];
}

async function extract(data: Obs,page: Page, ret?: z.AnyZodObject): Promise<string> {
  var result = "{\n";
  //insert content generated by Obserce
  result += Obs.eleToJson(data.links, "link");
  result += Obs.eleToJson(data.buttons, "button");
  result += Obs.eleToJson(data.checkboxes, "checkbox");
  result += Obs.eleToJson(data.fields, "field");
  result += Obs.eleToJson(data.forms, "form");
  result += Obs.eleToJson(data.selects, "select");
  //extract
    ret = z.object({
      elements : z.array(
      z.object({
      id: z.string(),
      description: z.string(),
      type: z.string()      
    }))});
      
    const result2 =  await page.extract({
      instruction: prompt_extract,
      schema: ret
      //modelName: model
    });
    for(var k=0; k<result2.elements.length; k++) {
      result += "{\"id\": "+result2.elements[k].id+", \"description\": "+result2.elements[k].description+", \"type\": "+result2.elements[k].type+"}\n";
    }
    result += "}";
    //console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    //console.log(result);
    return result;
  }

async function assert(page: Page, result1: string, inst?: string, ret?:z.AnyZodObject) {
  

  //call langchain to evaluate assertion
  const prompt = PromptTemplate.fromTemplate(prompt_assert);      
  const llm = new Ollama({model: model_assert,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  // other params...
  });

  const chain = prompt.pipe(llm);
  const verdict = await chain.invoke({
  page: result1,
  input: inst,
});
return verdict;
}

// Appelle deux agents pour évaluer si l'action suivante peut être effectuée
async function evaluateWithLLM(page: Page, term: string, data: Obs): Promise<boolean> {
        console.log("\n", "Evaluate with LLM", term);
        let content = await extract(data, page);
        
        
   const prompt = PromptTemplate.fromTemplate(prompt_eval);      
  const llm = new Ollama({model: model_eval,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  // other params...
  });
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
  page: content,
  input: term,
  });
  console.log("\n", "Evaluate with LLM response", response);
  return response === "True" || (typeof response === "string" && response.includes("True"));
    }


function normalized_std(binary_results: number[]): number {
    if (binary_results.length === 0) {
        return 0.0;
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

run();