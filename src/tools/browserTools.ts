import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const openUrlTool = new DynamicStructuredTool({
  name: "open_url",
  description: "Open a URL in the default web browser",
  schema: z.object({
    url: z.string().url().describe("The URL to open in the browser"),
  }),
  func: async ({ url }) => {
    try {
      const isWindows = process.platform === "win32";
      const command = isWindows ? `start ${url}` : `open ${url}`;
      
      await execAsync(command);
      return `Opened URL: ${url}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error opening URL: ${error.message}`;
      }
      return "An unknown error occurred while opening the URL";
    }
  },
});

export const searchWebTool = new DynamicStructuredTool({
  name: "search_web",
  description: "Perform a web search using the default search engine",
  schema: z.object({
    query: z.string().describe("The search query"),
    searchEngine: z.enum(["google", "bing", "duckduckgo"]).default("google"),
  }),
  func: async ({ query, searchEngine }) => {
    try {
      const encodedQuery = encodeURIComponent(query);
      let searchUrl: string;

      switch (searchEngine) {
        case "google":
          searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
          break;
        case "bing":
          searchUrl = `https://www.bing.com/search?q=${encodedQuery}`;
          break;
        case "duckduckgo":
          searchUrl = `https://duckduckgo.com/?q=${encodedQuery}`;
          break;
        default:
          searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
      }

      const isWindows = process.platform === "win32";
      const command = isWindows ? `start ${searchUrl}` : `open ${searchUrl}`;
      
      await execAsync(command);
      return `Performed search for: ${query} using ${searchEngine}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error performing search: ${error.message}`;
      }
      return "An unknown error occurred while performing the search";
    }
  },
});

export const downloadFileTool = new DynamicStructuredTool({
  name: "download_file",
  description: "Download a file from a URL",
  schema: z.object({
    url: z.string().url().describe("The URL of the file to download"),
    outputPath: z.string().describe("The path where the file should be saved"),
  }),
  func: async ({ url, outputPath }) => {
    try {
      // Using curl or wget based on platform
      const isWindows = process.platform === "win32";
      const command = isWindows
        ? `curl -L "${url}" -o "${outputPath}"`
        : `wget -O "${outputPath}" "${url}"`;

      await execAsync(command);
      return `Successfully downloaded file to: ${outputPath}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error downloading file: ${error.message}`;
      }
      return "An unknown error occurred while downloading the file";
    }
  },
});

export const browserTools = [
  openUrlTool,
  searchWebTool,
  downloadFileTool,
];