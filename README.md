# EvalAgent

A comprehensive test evaluation suite for LLM-powered browser automation agents. This project provides three distinct evaluation approaches to assess and validate the performance of language models in web testing scenarios.

## 📁 Project Structure

This repository contains three main programs, each in its own directory, plus a shared test suite:


- **[eval-agent-stagehandv1/](eval-eval-agent-stagehandv1/)** - Firt tool to evaluate the agent_readiness, agent_navigate and agent_assert
- **[eval-ambiguity/](eval-ambiguity/)** - Evaluation of the agent agent_clarify
- **[imagesComparison/](imagesComparison/)** - Image-based Evaluation of the agent agent_navigate agent_assert
- **[LlmAsJudge/](LlmAsJudge/)** - Dual-agent DOM comparison
- **[tests/](tests/)** - Shared test suites and reference images

## 🎯 Components Overview

### eval-ambiguity

A test case preprocessor that transforms ambiguous or complex test instructions into clearer, more atomic steps. This tool helps standardize test cases for better LLM comprehension.

**Example transformation:**
```
Input:
"Fill the form with 'toto' in the field 'First Name' and 'Tata' in the field 'Last Name' 
and 'toto@example.com' in the field 'E-Mail' and 'new_password' in the field 'Password'"

Output:
- "Fill the field 'First Name' with 'toto'"
- "Fill the field 'Last Name' with 'Tata'"
- "Fill the field 'E-Mail' with 'toto@example.com'"
- "Fill the field 'Password' with 'new_password'"
```

### imagesComparison

A visual regression testing framework based on [NL-test-case-runner](https://github.com/FondationUCA-Chair-LLM/NL-test-case-runner) Eval-Agent. This tool validates each action by comparing screenshots against reference images.

**Workflow:**
1. Execute an action
2. Capture screenshot
3. Compare with reference image
4. If match: continue to next step
5. If mismatch: skip to next test case

### LlmAsJudge

A sophisticated dual-agent evaluation framework that runs two LLM instances simultaneously and compares their DOM states at each step.

**Architecture:**
- **Trusted Agent**: Uses a reliable reference model (e.g., llama3.3:70b)
- **Evaluated Agent**: The model being tested

**Evaluation Modes:**

#### 1. Pure DOM Comparison (Standard Mode)
Uses test files with "eval" in the name (e.g., [TestG-EVAL.json](tests/TestG-EVAL.json)):
- Compare DOM states at each step
- If DOM matches: continue
- If DOM differs: synchronize evaluated agent with trusted agent's state

#### 2. Hybrid Image + DOM Comparison (Enhanced Mode)
Uses test files with images (e.g., [TestG-EVAL-image.json](tests/TestG-EVAL-image.json)):

```
1. Compare trusted agent screenshot with reference image
   ├─ Match → Compare DOMs between agents
   │          ├─ Match → Continue
   │          └─ Mismatch → Sync evaluated agent to trusted agent
   └─ Mismatch → Compare evaluated agent with reference image
              ├─ Match → Sync trusted agent to evaluated agent
              └─ Mismatch → All comparisons failed, skip to next test
```

## 🚀 Installation

For each subdirectory (except [tests/](tests/)):

```bash
cd <subdirectory>
npm install
```

If you encounter dependency issues, use:

```bash
npm install --legacy-peer-deps
```

npm install @browserbasehq/stagehand@2.3.0



## ⚙️ Configuration

Each program has its own configuration file at `config/config.ts`:

### Common Configuration Options
- `NUM_RUNS` - Number of test iterations
- `test_suite` - Path to test file
- Model selection and parameters

### LlmAsJudge-Specific Options
- `imagePercentageDiff` - Threshold for image comparison tolerance
- `test_suite_images` - Path to reference images directory
- `model_nav_trusted` - Model for trusted agent

### imagesComparison-Specific Options
- `test_suite` - Path to test file with images
- `imagePercentageDiff` - Image comparison tolerance

### Runtime Arguments

Override configuration values via command-line arguments:

```bash
npm start NUM_RUNS:10 model_eval:myModel
```

View all available arguments:

```bash
npm start help
```

Runtime arguments take precedence over [config.ts](eval-ambiguity/config/config.ts) values.

## 📖 Usage

### General Usage

```bash
cd <subdirectory>
npm start
```

Results are displayed in the terminal and saved to `results.xlsx`.

### imagesComparison Usage

1. Use a test suite with images (files containing "image" in the name)
   - Example: [TestG-EVAL-image.json](tests/TestG-EVAL-image.json)
2. Configure the image directory path in [config.ts](imagesComparison/config/config.ts)
   - Example: `../tests/images/TestG-EVAL-image/`
3. Run the program

### LlmAsJudge Usage

**Standard Mode (DOM-only):**
- Use test files with "eval" in the name (e.g., [TestG-EVAL.json](tests/TestG-EVAL.json))
- Pure LLM-as-judge evaluation without image validation

**Enhanced Mode (Image + DOM):**
- Use test files with reference images (e.g., [TestG-EVAL-image.json](tests/TestG-EVAL-image.json))
- Provides higher accuracy but requires prepared image datasets
- Not a pure LLM-as-judge approach due to image validation

## 🏗️ Framework Architecture

This repository currently uses **Stagehand** as the browser automation framework, but is designed for extensibility.

The framework abstraction layer is defined in `Framework/FrameworkInterface.ts`, allowing you to integrate alternative frameworks:

1. Create a new directory under `Framework/Implementation/`
2. Implement the `FrameworkInterface`
3. Follow the pattern in [Framework/Implementation/stagehand/](LlmAsJudge/Framework/Implementation/stagehand/)

This architecture enables easy framework swapping while maintaining consistent behavior across all evaluation modes.

## ⚠️ Known Issues

### XPath Resolution with llama3.3:70b

When using llama3.3:70b with Stagehand's `.act()` observation functionality, element IDs may be returned wrapped in brackets (e.g., `[0-42]` instead of `0-42`), causing XPath lookup failures.

#### Workaround

Modify the Stagehand package to strip brackets from element IDs:

**File:** `node_modules/@browserbasehq/stagehand/dist/index.js`

**Find:**
```javascript
const lookUpIndex = elementId.toString();
```

**Replace with:**
```javascript
const lookUpIndex = elementId.toString().replace(/^\[|\]$/g, "");
```

**Full context:**
```javascript
const elementsWithSelectors = yield Promise.all(
  observationResponse.elements.map((element) => __async(this, null, function* () {
    const _a15 = element, { elementId } = _a15, rest = __objRest(_a15, ["elementId"]);
    
    this.logger({
      category: "observation",
      message: "Getting xpath for element",
      level: 1,
      auxiliary: {
        elementId: {
          value: elementId.toString(),
          type: "string"
        }
      }
    });
    
    // Apply the fix here
    const lookUpIndex = elementId.toString().replace(/^\[|\]$/g, "");
    const xpath = combinedXpathMap[lookUpIndex];
    
    if (!xpath || xpath === "") {
      this.logger({
        category: "observation",
        message: `Empty xpath returned for element: ${elementId}`,
        level: 1
      });
    }
    // ...
```

> **Note:** This is a temporary workaround. Consider creating a patch file or reporting this issue to the Stagehand repository.

