/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaskAgent } from '@/agent/task';
import { ipcBridge } from '@/common';
import { transformMessage } from '@/common/chatLib';
import type { TMessage } from '@/common/chatLib';
import type { IResponseMessage } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import { addMessage, addOrUpdateMessage } from '@process/message';
import { cronBusyGuard } from '@process/services/cron/CronBusyGuard';
import BaseAgentManager from './BaseAgentManager';

export interface TaskAgentManagerData {
  conversation_id: string;
  workspace?: string;
  /** Shell to use for command execution */
  shell?: string;
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Maximum execution time in ms */
  timeout?: number;
  /** YOLO mode (auto-approve all commands) */
  yoloMode?: boolean;
}

class TaskAgentManager extends BaseAgentManager<TaskAgentManagerData> {
  workspace?: string;
  agent!: TaskAgent;
  private bootstrap: Promise<TaskAgent>;
  private options: TaskAgentManagerData;

  constructor(data: TaskAgentManagerData) {
    super('task', data);
    this.conversation_id = data.conversation_id;
    this.workspace = data.workspace;
    this.options = data;

    this.bootstrap = this.initAgent(data);
  }

  private async initAgent(data: TaskAgentManagerData): Promise<TaskAgent> {
    this.agent = new TaskAgent({
      id: data.conversation_id,
      workingDir: data.workspace || process.cwd(),
      shell: data.shell,
      env: data.env,
      timeout: data.timeout,
      yoloMode: data.yoloMode,
      onStreamEvent: (message) => this.handleStreamEvent(message),
      onSignalEvent: (message) => this.handleSignalEvent(message),
    });

    try {
      await this.agent.start();
      return this.agent;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emitErrorMessage(`Failed to start task agent: ${errorMsg}`);
      throw error;
    }
  }

  private handleStreamEvent(message: IResponseMessage): void {
    const msg = { ...message, conversation_id: this.conversation_id };

    // Persist messages to database
    const tMessage = transformMessage(msg);
    if (tMessage) {
      if (msg.type === 'content' && msg.msg_id) {
        addOrUpdateMessage(this.conversation_id, tMessage);
      } else {
        addMessage(this.conversation_id, tMessage);
      }
    }

    // Emit to frontend via unified response stream
    ipcBridge.conversation.responseStream.emit(msg);
  }

  private handleSignalEvent(message: IResponseMessage): void {
    const msg = { ...message, conversation_id: this.conversation_id };

    // Handle finish event
    if (msg.type === 'finish') {
      cronBusyGuard.setProcessing(this.conversation_id, false);
    }

    // Emit signal events to frontend
    ipcBridge.conversation.responseStream.emit(msg);
  }

  async sendMessage(data: { content: string; files?: string[]; msg_id?: string }) {
    cronBusyGuard.setProcessing(this.conversation_id, true);
    try {
      await this.bootstrap;

      // Save user message to chat history
      if (data.msg_id && data.content) {
        const userMessage: TMessage = {
          id: data.msg_id,
          msg_id: data.msg_id,
          type: 'text',
          position: 'right',
          conversation_id: this.conversation_id,
          content: { content: data.content },
          createdAt: Date.now(),
        };
        addMessage(this.conversation_id, userMessage);
      }

      // Send command to agent
      const result = await this.agent.sendMessage({
        content: data.content,
        msg_id: data.msg_id,
      });

      return result;
    } catch (error) {
      cronBusyGuard.setProcessing(this.conversation_id, false);

      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emitErrorMessage(`Failed to execute task: ${errorMsg}`);
      throw error;
    }
  }

  private emitErrorMessage(error: string): void {
    const message: IResponseMessage = {
      type: 'error',
      conversation_id: this.conversation_id,
      msg_id: uuid(),
      data: error,
    };

    const tMessage = transformMessage(message);
    if (tMessage) {
      addMessage(this.conversation_id, tMessage);
    }

    ipcBridge.conversation.responseStream.emit(message);
  }

  stop() {
    return this.agent?.stop?.() ?? Promise.resolve();
  }

  kill() {
    try {
      this.agent?.kill?.();
    } finally {
      super.kill();
    }
  }
}

export default TaskAgentManager;
