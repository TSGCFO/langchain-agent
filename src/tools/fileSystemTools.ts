import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

export const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description: "Read the contents of a file at the specified path",
  schema: z.object({
    path: z.string().describe("The path to the file to read"),
  }),
  func: async ({ path: filePath }) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error) {
      if (error instanceof Error) {
        return `Error reading file: ${error.message}`;
      }
      return "An unknown error occurred while reading the file";
    }
  },
});

export const writeFileTool = new DynamicStructuredTool({
  name: "write_file",
  description: "Write content to a file at the specified path",
  schema: z.object({
    path: z.string().describe("The path where the file should be written"),
    content: z.string().describe("The content to write to the file"),
  }),
  func: async ({ path: filePath, content }) => {
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      return `Successfully wrote to ${filePath}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error writing file: ${error.message}`;
      }
      return "An unknown error occurred while writing the file";
    }
  },
});

export const listFilesTool = new DynamicStructuredTool({
  name: "list_files",
  description: "List files in a directory",
  schema: z.object({
    path: z.string().describe("The directory path to list files from"),
    recursive: z.boolean().optional().describe("Whether to list files recursively"),
  }),
  func: async ({ path: dirPath, recursive = false }) => {
    try {
      if (recursive) {
        const files: string[] = [];
        
        async function walk(dir: string) {
          const items = await fs.readdir(dir, { withFileTypes: true });
          
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              await walk(fullPath);
            } else {
              files.push(fullPath);
            }
          }
        }
        
        await walk(dirPath);
        return files.join("\n");
      } else {
        const files = await fs.readdir(dirPath);
        return files.join("\n");
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error listing files: ${error.message}`;
      }
      return "An unknown error occurred while listing files";
    }
  },
});

export const deleteFileTool = new DynamicStructuredTool({
  name: "delete_file",
  description: "Delete a file at the specified path",
  schema: z.object({
    path: z.string().describe("The path to the file to delete"),
  }),
  func: async ({ path: filePath }) => {
    try {
      await fs.unlink(filePath);
      return `Successfully deleted ${filePath}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error deleting file: ${error.message}`;
      }
      return "An unknown error occurred while deleting the file";
    }
  },
});

export const fileSystemTools = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  deleteFileTool,
];