/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import { spawn, type ChildProcess } from 'child_process';

/**
 * Configuration for TaskAgent
 */
export interface TaskAgentConfig {
  id: string;
  workingDir: string;
  /** Shell to use for command execution (defaults to system shell) */
  shell?: string;
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Maximum execution time in ms (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Auto-approve all commands without confirmation */
  yoloMode?: boolean;
  onStreamEvent: (data: IResponseMessage) => void;
  onSignalEvent?: (data: IResponseMessage) => void;
}

/**
 * Result of a task execution
 */
export interface TaskResult {
  success: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}

/**
 * TaskAgent - Executes shell commands and scripts in a workspace directory.
 *
 * Streams stdout/stderr back to the UI in real-time and reports
 * success/failure when the command completes.
 */
export class TaskAgent {
  private readonly id: string;
  private readonly workingDir: string;
  private readonly shell: string;
  private readonly env: Record<string, string>;
  private readonly timeout: number;
  private readonly yoloMode: boolean;
  private readonly onStreamEvent: (data: IResponseMessage) => void;
  private readonly onSignalEvent?: (data: IResponseMessage) => void;
  private currentProcess: ChildProcess | null = null;
  private statusMessageId: string | null = null;
  private isRunning = false;

  constructor(config: TaskAgentConfig) {
    this.id = config.id;
    this.workingDir = config.workingDir;
    this.shell = config.shell || (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
    this.env = config.env || {};
    this.timeout = config.timeout || 300000;
    this.yoloMode = config.yoloMode || false;
    this.onStreamEvent = config.onStreamEvent;
    this.onSignalEvent = config.onSignalEvent;
  }

  /**
   * Start the task agent (emit ready status)
   */
  async start(): Promise<void> {
    this.emitStatusMessage('session_active');
  }

  /**
   * Stop any running command
   */
  async stop(): Promise<void> {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
      // Give process time to exit gracefully, then force kill
      await new Promise<void>((resolve) => {
        const forceKillTimeout = setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            this.currentProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        if (this.currentProcess) {
          this.currentProcess.once('exit', () => {
            clearTimeout(forceKillTimeout);
            resolve();
          });
        } else {
          clearTimeout(forceKillTimeout);
          resolve();
        }
      });
    }
    this.currentProcess = null;
    this.isRunning = false;
    this.emitFinish();
  }

  /**
   * Execute a command and stream output
   */
  async sendMessage(data: { content: string; msg_id?: string }): Promise<TaskResult> {
    const command = data.content.trim();
    if (!command) {
      return { success: false, exitCode: null, signal: null, error: 'Empty command' };
    }

    // If a command is already running, stop it first
    if (this.isRunning) {
      await this.stop();
    }

    const msgId = data.msg_id || uuid();
    this.isRunning = true;

    return new Promise<TaskResult>((resolve) => {
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const mergedEnv = { ...process.env, ...this.env };

      this.currentProcess = spawn(this.shell, shellArgs, {
        cwd: this.workingDir,
        env: mergedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
      });

      let outputBuffer = '';
      let hasEmittedContent = false;

      const emitOutput = (chunk: string) => {
        outputBuffer += chunk;
        hasEmittedContent = true;
        this.onStreamEvent({
          type: 'content',
          conversation_id: this.id,
          msg_id: msgId,
          data: outputBuffer,
        });
      };

      // Emit the command being executed as a tool call
      this.onStreamEvent({
        type: 'content',
        conversation_id: this.id,
        msg_id: msgId,
        data: '',
      });

      // Emit a thought showing what command is being run
      this.onStreamEvent({
        type: 'thought',
        conversation_id: this.id,
        msg_id: uuid(),
        data: {
          subject: 'Executing command',
          description: `\`${command}\`\nWorking directory: \`${this.workingDir}\``,
        },
      });

      if (this.currentProcess.stdout) {
        this.currentProcess.stdout.on('data', (data: Buffer) => {
          emitOutput(data.toString());
        });
      }

      if (this.currentProcess.stderr) {
        this.currentProcess.stderr.on('data', (data: Buffer) => {
          emitOutput(data.toString());
        });
      }

      this.currentProcess.on('error', (error: Error) => {
        this.isRunning = false;
        this.currentProcess = null;

        if (!hasEmittedContent) {
          this.emitError(`Failed to execute command: ${error.message}`);
        } else {
          emitOutput(`\n[Error: ${error.message}]`);
        }

        this.emitFinish();
        resolve({
          success: false,
          exitCode: null,
          signal: null,
          error: error.message,
        });
      });

      this.currentProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        this.isRunning = false;
        this.currentProcess = null;

        // Emit exit code info
        if (code !== 0 && code !== null) {
          emitOutput(`\n[Process exited with code ${code}]`);
        }

        this.emitFinish();
        resolve({
          success: code === 0,
          exitCode: code,
          signal,
        });
      });
    });
  }

  /**
   * Handle confirmation (used when yoloMode is off and a command needs approval)
   */
  confirmMessage(data: { confirmKey: string; callId: string }): Promise<TaskResult> {
    // Task agent doesn't need complex confirmation - commands are either run or not
    if (data.confirmKey === 'allow') {
      return Promise.resolve({ success: true, exitCode: 0, signal: null });
    }
    return Promise.resolve({ success: false, exitCode: null, signal: null, error: 'Command rejected by user' });
  }

  /**
   * Kill the agent and any running processes
   */
  kill(): void {
    this.stop().catch((error) => {
      console.error('[TaskAgent] Error stopping task agent:', error);
    });
  }

  get isConnected(): boolean {
    return true;
  }

  get hasActiveSession(): boolean {
    return true;
  }

  private emitStatusMessage(status: 'connecting' | 'connected' | 'session_active' | 'disconnected' | 'error'): void {
    if (!this.statusMessageId) {
      this.statusMessageId = uuid();
    }

    this.onStreamEvent({
      type: 'agent_status',
      conversation_id: this.id,
      msg_id: this.statusMessageId,
      data: {
        backend: 'task',
        status,
      },
    });
  }

  private emitError(error: string): void {
    this.onStreamEvent({
      type: 'error',
      conversation_id: this.id,
      msg_id: uuid(),
      data: error,
    });
  }

  private emitFinish(): void {
    if (this.onSignalEvent) {
      this.onSignalEvent({
        type: 'finish',
        conversation_id: this.id,
        msg_id: uuid(),
        data: null,
      });
    }
  }
}
