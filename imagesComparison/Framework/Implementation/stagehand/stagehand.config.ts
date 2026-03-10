import type { ConstructorParams } from "@browserbasehq/stagehand";
import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client.js";
import { OpenAI } from "openai";
import { model_nav, server } from "../../../config/config.js";

export const StagehandConfig: ConstructorParams = {
  verbose: 0/* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,
  experimental: true,
  // LLM configuration for stagehand
  llmClient: new CustomOpenAIClient({
    modelName: model_nav,
    client: new OpenAI({
      baseURL: server + "/v1",
      apiKey: "ollama",
    }),
  }),

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      blockAds: true,
      viewport: {
        width: 1024,
        height: 768,
        
      },
     
    },
  },
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
    //headless: true /* Whether to run the browser in headless mode */,
     
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;
