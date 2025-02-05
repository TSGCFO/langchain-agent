import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage } from "@langchain/core/messages";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";

export interface AnthropicConfig {
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
}

export function createAnthropicModel(config: AnthropicConfig = {}) {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is required');
  }

  return new ChatAnthropic({
    apiKey,
    modelName: config.modelName || "claude-3-sonnet-20240229",
    maxTokens: config.maxTokens || 1024,
    temperature: config.temperature ?? 0
  });
}

export async function generateStructuredOutput<T>(
  model: ChatAnthropic,
  messages: BaseMessage[],
  schema: Record<string, any>,
  systemPrompt?: string
): Promise<T> {
  try {
    // Create a function parser with the schema
    const functionParser = new JsonOutputFunctionsParser<T>({
      jsonSchema: schema
    });

    // Add formatting instructions to the system prompt
    const fullSystemPrompt = [
      systemPrompt || '',
      'You must respond in valid JSON format according to the provided schema.',
      'Do not include any explanatory text outside the JSON structure.'
    ].join('\n').trim();

    // Generate the response
    const response = await model.invoke(messages, {
      functions: [{ name: "output", parameters: schema }],
      function_call: { name: "output" },
      systemPrompt: fullSystemPrompt
    });

    // Parse the response
    return await functionParser.parse(response.content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate structured output: ${error.message}`);
    }
    throw error;
  }
}

export async function generateText(
  model: ChatAnthropic,
  messages: BaseMessage[],
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await model.invoke(messages, {
      systemPrompt
    });
    return String(response.content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate text: ${error.message}`);
    }
    throw error;
  }
}