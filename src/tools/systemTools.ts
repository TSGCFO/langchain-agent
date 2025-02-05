import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export const openApplicationTool = new DynamicStructuredTool({
  name: "open_application",
  description: "Open a system application like Notepad, Word (winword), Calculator (calc), etc.",
  schema: z.object({
    appName: z.string().describe("The name of the application to open (e.g., 'notepad', 'winword', 'calc')")
  }),
  func: async ({ appName }) => {
    try {
      const command = process.platform === 'win32' ? 
        `start ${appName}` : 
        process.platform === 'darwin' ? 
          `open -a "${appName}"` : 
          `${appName}`;

      await execAsync(command);
      return `Successfully opened ${appName}`;
    } catch (error) {
      throw new Error(`Failed to open ${appName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

export const createTextFileTool = new DynamicStructuredTool({
  name: "create_text_file",
  description: "Create a new text file with specified content",
  schema: z.object({
    filename: z.string().describe("The name of the file to create (e.g., 'example.txt')"),
    content: z.string().describe("The content to write to the file"),
    directory: z.string().optional().describe("Optional directory path (defaults to current directory)")
  }),
  func: async ({ filename, content, directory = '.' }) => {
    try {
      const filepath = join(directory, filename);
      await writeFile(filepath, content, 'utf8');
      return `Successfully created file: ${filepath}`;
    } catch (error) {
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

export const executeCommandTool = new DynamicStructuredTool({
  name: "execute_command",
  description: "Execute a system command (use with caution)",
  schema: z.object({
    command: z.string().describe("The command to execute"),
    workingDir: z.string().optional().describe("Optional working directory")
  }),
  func: async ({ command, workingDir }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir
      });
      return stdout || stderr || 'Command executed successfully';
    } catch (error) {
      throw new Error(`Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

export const systemTools = [
  openApplicationTool,
  createTextFileTool,
  executeCommandTool
];
