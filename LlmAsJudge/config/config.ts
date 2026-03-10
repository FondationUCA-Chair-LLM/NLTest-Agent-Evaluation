import dotenv from "dotenv";
dotenv.config();

//test suite
export const test_suite = "../tests/Tests.json"; // "test_cases.json"; // "test_casesV2.json"; // "test_casesV3.json"; // "test_casesV4.json"; // "test_casesV5.json";
//export const test_suite = "../tests/Tests.json";
export const test_suite_images = "../tests/images/TestG-EVAL-image"; // "TestImages"; // "TestImagesV2"; // "TestImagesV3"; // "TestImagesV4"; // "TestImagesV5";

// number of runs for each test case
export var NUM_RUNS = 20;

// percentage of different pixels to consider images as different
export const imagePercentageDiff = 5; 

//models
export const model_eval = "qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest" ; //"qwen3:14b"; //"qwen3:14b"; //"qwen3:14b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_assert = "qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_convert_step = "qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const model_nav = "qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const model_nav_trusted = "llama3.3:70b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const server = "http://192.168.128.44:11434"; // "http://localhost:11434"; //"http://192.168.128.44:11434"

//disable debug logs
console.debug = function() {};