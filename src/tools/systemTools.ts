import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const executeCommandTool = new DynamicStructuredTool({
  name: "execute_command",
  description: "Execute a system command",
  schema: z.object({
    command: z.string().describe("The command to execute"),
    cwd: z.string().optional().describe("Working directory for command execution"),
  }),
  func: async ({ command, cwd }) => {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      if (stderr) {
        return `Command executed with warnings:\nOutput: ${stdout}\nWarnings: ${stderr}`;
      }
      return `Command executed successfully:\n${stdout}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error executing command: ${error.message}`;
      }
      return "An unknown error occurred while executing the command";
    }
  },
});

export const processManagementTool = new DynamicStructuredTool({
  name: "manage_process",
  description: "Manage system processes (start, stop, or check status)",
  schema: z.object({
    action: z.enum(["start", "stop", "status"]),
    process: z.string().describe("Process name or identifier"),
  }),
  func: async ({ action, process: processName }) => {
    try {
      const isWindows = process.platform === "win32";
      
      switch (action) {
        case "start":
          // Platform-specific start command
          if (isWindows) {
            await execAsync(`start ${processName}`);
          } else {
            await execAsync(`open ${processName}`);
          }
          return `Started process: ${processName}`;

        case "stop":
          // Platform-specific stop command
          if (isWindows) {
            await execAsync(`taskkill /F /IM ${processName}`);
          } else {
            await execAsync(`pkill -f ${processName}`);
          }
          return `Stopped process: ${processName}`;

        case "status":
          // Platform-specific status command
          if (isWindows) {
            const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}"`);
            return stdout.includes(processName) 
              ? `Process ${processName} is running` 
              : `Process ${processName} is not running`;
          } else {
            const { stdout } = await execAsync(`pgrep -f ${processName}`);
            return stdout 
              ? `Process ${processName} is running` 
              : `Process ${processName} is not running`;
          }
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error managing process: ${error.message}`;
      }
      return "An unknown error occurred while managing the process";
    }
  },
});

export const environmentTool = new DynamicStructuredTool({
  name: "environment",
  description: "Get or set environment variables",
  schema: z.object({
    action: z.enum(["get", "set"]),
    variable: z.string().describe("Environment variable name"),
    value: z.string().optional().describe("Value to set (only for 'set' action)"),
  }),
  func: async ({ action, variable, value }) => {
    try {
      switch (action) {
        case "get":
          const envValue = process.env[variable];
          return envValue 
            ? `${variable}=${envValue}` 
            : `Environment variable ${variable} is not set`;

        case "set":
          if (!value) {
            return "Value is required for set action";
          }
          process.env[variable] = value;
          return `Set ${variable}=${value}`;
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error managing environment variable: ${error.message}`;
      }
      return "An unknown error occurred while managing environment variables";
    }
  },
});

export const systemTools = [
  executeCommandTool,
  processManagementTool,
  environmentTool,
];