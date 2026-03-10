import dotenv from "dotenv";
dotenv.config();

//test suite
export const test_suite = "../tests/tests.json"; //testsClarifyActionsExpected.json";

// number of runs for each test case
export var NUM_RUNS = 20;

//models
export const model_convert_step = "qwen3:4b"; //"mistral:7b"; //"llama3.3:70b";//"gpt-oss:20b-t0-128k"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const server = "http://192.168.128.44:11434"; // "http://localhost:11434"; //"http://192.168.128.44:11434"

//disable debug logs
console.debug = () => { };