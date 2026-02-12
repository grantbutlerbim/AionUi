---
name: task
description: Execute shell commands and scripts on behalf of the user. Use when asked to "run", "execute", or "ask my agent" to perform a task.
---

# Task Execution Skill

You can execute shell commands and scripts in the user's workspace. When the user asks you to "ask my agent", "run a task", "execute a command", or similar requests, use this skill.

## IMPORTANT RULES

1. **ONE command per block** - Each `[TASK_RUN]` block runs one command
2. **ALWAYS include closing tags** - `[TASK_RUN]` MUST end with `[/TASK_RUN]`
3. **Output commands directly** - Do NOT wrap commands in markdown code blocks
4. **Wait for results** - After outputting a `[TASK_RUN]` block, STOP and wait for the system to return the result before continuing
5. **Be careful with destructive commands** - Warn the user before running commands that modify or delete files/data
6. **Use the workspace** - Commands run in the conversation's workspace directory by default

## Execute a Command

When the user asks you to run a command, output this format DIRECTLY (not in code blocks):

[TASK_RUN]
command: the shell command to execute
[/TASK_RUN]

### Optional fields

- `working_dir`: Override the working directory (absolute path)
- `timeout`: Maximum execution time in seconds (default: 300)

### Example: Simple command

[TASK_RUN]
command: npm test
[/TASK_RUN]

### Example: With options

[TASK_RUN]
command: python3 train.py --epochs 10
working_dir: /home/user/ml-project
timeout: 600
[/TASK_RUN]

### Example: Multi-step pipeline

Run commands sequentially using `&&`:

[TASK_RUN]
command: npm install && npm run build && npm test
[/TASK_RUN]

## Common Use Cases

| User says | Command |
|-----------|---------|
| "Run the tests" | `npm test` or `pytest` |
| "Build the project" | `npm run build` or `make` |
| "Check git status" | `git status` |
| "Install dependencies" | `npm install` or `pip install -r requirements.txt` |
| "Start the dev server" | `npm run dev` |
| "Run the linter" | `npm run lint` |
| "Show disk usage" | `df -h` |
| "List running processes" | `ps aux` |

## Interpreting Results

After you output a `[TASK_RUN]` block, the system will execute the command and return:
- The stdout and stderr output
- The exit code (0 = success, non-zero = failure)

Based on the result:
- If successful: Summarize what happened
- If failed: Analyze the error and suggest fixes
- If the user asks for follow-up: You can run additional commands

## Notes

- Commands execute in the conversation's workspace directory
- stdout and stderr are combined in the output
- Long-running commands will timeout after the specified duration (default: 5 minutes)
- The system response will appear as `[System Response]` in the conversation
