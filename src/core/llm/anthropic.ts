import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

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
    modelName: config.modelName || "claude-3-claude-3-5-sonnet-20241022",
    maxTokens: config.maxTokens || 1024,
    temperature: config.temperature ?? 0
  });
}

export async function generateStructuredOutput<T extends Record<string, unknown>>(
  model: ChatAnthropic,
  messages: BaseMessage[],
  schema: z.ZodType<T>,
  systemPrompt?: string
): Promise<T> {
  try {
    // Create a structured output parser with the Zod schema
    const parser = StructuredOutputParser.fromZodSchema(schema);

    // Create format instructions
    const formatInstructions = parser.getFormatInstructions();

    // Prepare messages with system prompt and format instructions
    const allMessages = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      ...messages,
      new HumanMessage(
        `${formatInstructions}\n\nPlease provide your response in the exact format specified above.`
      )
    ];

    // Generate the response
    const response = await model.invoke(allMessages);

    // Parse the output
    try {
      return await parser.parse(response.content.toString());
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = response.content.toString().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return await parser.parse(jsonMatch[0]);
      }
      throw parseError;
    }
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
    // If there's a system prompt, add it as a system message
    const allMessages = systemPrompt
      ? [new SystemMessage(systemPrompt), ...messages]
      : messages;

    const response = await model.invoke(allMessages);
    return response.content.toString();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate text: ${error.message}`);
    }
    throw error;
  }
}