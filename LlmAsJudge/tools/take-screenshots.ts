import {
  test_suite,
  test_suite_images,
} from "../config/config.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FrameworkStagehand } from "../Framework/Implementation/stagehand/FrameworkStagehand.js";
import { FrameworkInterface } from "../Framework/FrameworkInterface.js";

let automatic = false;
if (process.argv[2] === "automatic") {
  console.log("Automatic mode activated");
  automatic = true;
} else {
  console.log("Manual mode activated");
}
function loadTestCases(filename: string): any {
  const filePath = resolve(filename);
  const fileContent = readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent);
}

async function main() {
  const test_cases = loadTestCases(test_suite);
  for (const test_case of test_cases) {
    console.log(
      `\n📋 Test Case: ${test_case.name} -----------------------------`
    );
    await run_search(test_case.actions, test_case.expected);
  }
}

async function run_search(task: string[], expected: number[]): Promise<void> {
  const framework = await FrameworkStagehand.InitFramework();

  await simple_run(task, expected, framework);

  await framework.close();
}

async function simple_run(
  task: string[],
  expected: (number | string)[],
  framework: FrameworkInterface
): Promise<void> {
  for (var i = 0; i < task.length; i++) {
    if (i === 0) {
      const site = String(task[0]).match(/'([^']*)'/);
      if (!site) {
        console.log("No valid web site found.");
        return;
      }
      try {
        await framework.goto(site[1]);
        await framework.waitForTimeout(5000);
        await framework.takeScreenshot(resolve(test_suite_images, String(expected[i])));
        console.log("📸 Screenshot taken");
      } catch (error) {
        console.log(`Navigation failed for ${site[1]}:`, error);
        return;
      }
    } else {
      if (!String(task[i]).startsWith("Assert")) {
        try {
          console.log(`➡️  Action ${i} :`, task[i]);
          if (automatic) {
            const r = await framework.act(task[i]);
            await framework.waitForTimeout(5000);

            if (r.success === false) {
              console.log(`❌ Action failed at step ${i}: ${task[i]}`);
              return;
            }
          } else {
            process.stdout.write(
              "Please do the described action and then Press Enter to continue..."
            );
            await new Promise<void>((resolve) => {
              process.stdin.once("data", () => {
                resolve();
              });
            });
          }

          console.log(`✅  Action ${i} terminée`);
          await framework.takeScreenshot(resolve(test_suite_images, String(expected[i])));
          console.log("📸 Screenshot taken\n");
        } catch (error) {
          console.log(`Action failed at step ${i}: ${task[i]} ->`, error);
          break;
        }
      } else {
        break;
      }
    }
  }
}

main();
