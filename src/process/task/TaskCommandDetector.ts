/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Task command types detected from agent message content
 */
export type TaskCommand = {
  kind: 'run';
  command: string;
  workingDir?: string;
  timeout?: number;
};

/**
 * Remove markdown code blocks from content to avoid detecting commands in examples
 */
function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '');
}

/**
 * Detect task commands in message content
 *
 * Supported formats:
 * - [TASK_RUN]...[/TASK_RUN] - Execute a shell command
 *
 * NOTE: Commands inside markdown code blocks are ignored to prevent
 * documentation examples from being executed.
 *
 * @param content - The text content to scan
 * @returns Array of detected commands
 */
export function detectTaskCommands(content: string): TaskCommand[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const cleanContent = stripCodeBlocks(content);
  const commands: TaskCommand[] = [];

  // Detect [TASK_RUN]...[/TASK_RUN]
  const runMatches = cleanContent.matchAll(/\[TASK_RUN\]\s*\n?([\s\S]*?)\[\/TASK_RUN\]/gi);
  for (const match of runMatches) {
    const body = match[1];
    const parsed = parseTaskRunBody(body);
    if (parsed) {
      commands.push({ kind: 'run', ...parsed });
    }
  }

  // Fallback: Try to parse unclosed TASK_RUN block (agent forgot closing tag)
  if (commands.length === 0) {
    const hasOpen = /\[TASK_RUN\]/i.test(cleanContent);
    const hasClose = /\[\/TASK_RUN\]/i.test(cleanContent);
    if (hasOpen && !hasClose) {
      const fallbackMatch = cleanContent.match(/\[TASK_RUN\]\s*\n?([\s\S]*?)$/i);
      if (fallbackMatch) {
        const body = fallbackMatch[1];
        const parsed = parseTaskRunBody(body);
        if (parsed) {
          commands.push({ kind: 'run', ...parsed });
        }
      }
    }
  }

  return commands;
}

/**
 * Parse the body of a TASK_RUN block
 *
 * Expected format:
 * command: shell command to execute (can be multi-line)
 * working_dir: optional working directory override
 * timeout: optional timeout in seconds
 */
function parseTaskRunBody(body: string): { command: string; workingDir?: string; timeout?: number } | null {
  if (!body) {
    return null;
  }

  // Extract working_dir (optional)
  const workingDirMatch = body.match(/working_dir:\s*(.+)/i);
  const workingDir = workingDirMatch?.[1]?.trim();

  // Extract timeout (optional)
  const timeoutMatch = body.match(/timeout:\s*(\d+)/i);
  const timeout = timeoutMatch ? parseInt(timeoutMatch[1], 10) : undefined;

  // Extract command - everything after "command:" until next field or end
  const commandMatch = body.match(/command:\s*([\s\S]*?)(?=\n(?:working_dir|timeout):|$)/i);
  let command = commandMatch?.[1]?.trim();

  // Clean up
  if (command) {
    command = command.replace(/\[\/TASK_RUN\]/gi, '').trim();
  }

  if (!command) {
    return null;
  }

  return { command, workingDir, timeout };
}

/**
 * Check if content contains any task commands
 * Useful for quick check before full parsing
 */
export function hasTaskCommands(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  return /\[TASK_RUN\]/i.test(content);
}

/**
 * Strip task command blocks from content
 * Used to create clean display version for UI
 */
export function stripTaskCommands(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  return content
    .replace(/\[TASK_RUN\][\s\S]*?\[\/TASK_RUN\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
