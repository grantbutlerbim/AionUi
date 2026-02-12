/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder, type ButtonInteraction, type ChatInputCommandInteraction, type Interaction, type Message } from 'discord.js';
import type { BotInfo, IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { BasePlugin } from '../BasePlugin';
import { DISCORD_MESSAGE_LIMIT, buttonInteractionToUnifiedMessage, extractAction, extractCategory, interactionToUnifiedMessage, splitMessage, toDiscordSendParams, toUnifiedIncomingMessage } from './DiscordAdapter';

/**
 * DiscordPlugin - Discord bot integration for AionUi channel system
 *
 * Uses discord.js v14 with WebSocket gateway connection.
 * Supports DMs and guild channels, slash commands, and interactive buttons.
 */
export class DiscordPlugin extends BasePlugin {
  readonly type: PluginType = 'discord';

  private client: Client | null = null;
  private token: string = '';
  private botInfoData: BotInfo | null = null;
  private activeUsers: Set<string> = new Set();

  // ==================== Lifecycle ====================

  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const token = config.credentials?.token;
    if (!token) {
      throw new Error('Discord bot token is required');
    }
    this.token = token;

    // Create client with required intents
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    });

    this.setupHandlers();
  }

  protected async onStart(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Wait for ready event
    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord client ready timeout (30s)'));
      }, 30000);

      this.client!.once(Events.ClientReady, (readyClient) => {
        clearTimeout(timeout);

        this.botInfoData = {
          id: readyClient.user.id,
          username: readyClient.user.username,
          displayName: readyClient.user.displayName || readyClient.user.username,
        };

        console.log(`[DiscordPlugin] Bot ready: ${readyClient.user.tag}`);
        resolve();
      });
    });

    // Login
    await this.client.login(this.token);
    await readyPromise;

    // Register slash commands
    await this.registerSlashCommands();
  }

  protected async onStop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.activeUsers.clear();
    this.botInfoData = null;
  }

  // ==================== Core Message Methods ====================

  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.client) {
      throw new Error('Discord client not connected');
    }

    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !('send' in channel)) {
      throw new Error(`Cannot send to channel: ${chatId}`);
    }

    const { content, components } = toDiscordSendParams(message);

    // Split long messages
    const chunks = splitMessage(content, DISCORD_MESSAGE_LIMIT);
    let lastMessageId = '';

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const sendOptions: Record<string, unknown> = {
        content: chunks[i],
      };

      // Only attach components to the last chunk
      if (isLast && components) {
        sendOptions.components = components;
      }

      try {
        const sent = await (channel as { send: (opts: Record<string, unknown>) => Promise<Message> }).send(sendOptions);
        lastMessageId = sent.id;
      } catch (error) {
        console.error(`[DiscordPlugin] Failed to send message chunk ${i + 1}:`, error);
        throw error;
      }
    }

    return lastMessageId;
  }

  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    if (!this.client) return;

    try {
      const channel = await this.client.channels.fetch(chatId);
      if (!channel || !('messages' in channel)) return;

      const msgChannel = channel as { messages: { fetch: (id: string) => Promise<Message> } };
      const discordMsg = await msgChannel.messages.fetch(messageId);

      const { content, components } = toDiscordSendParams(message);

      // Truncate to Discord limit
      const truncatedContent = content.length > DISCORD_MESSAGE_LIMIT ? content.slice(0, DISCORD_MESSAGE_LIMIT - 3) + '...' : content;

      const editOptions: Record<string, unknown> = {
        content: truncatedContent,
      };

      if (components) {
        editOptions.components = components;
      }

      await discordMsg.edit(editOptions);
    } catch (error: unknown) {
      // Ignore "Unknown Message" errors (message may have been deleted)
      const errCode = (error as { code?: number }).code;
      if (errCode === 10008) return;
      console.error(`[DiscordPlugin] Failed to edit message:`, error);
    }
  }

  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  getBotInfo(): BotInfo | null {
    return this.botInfoData;
  }

  // ==================== Event Handlers ====================

  private setupHandlers(): void {
    if (!this.client) return;

    // Handle regular messages
    this.client.on(Events.MessageCreate, (msg: Message) => {
      void this.handleTextMessage(msg).catch((error) => {
        console.error(`[DiscordPlugin] Error handling message:`, error);
      });
    });

    // Handle interactions (slash commands + buttons)
    this.client.on(Events.InteractionCreate, (interaction: Interaction) => {
      void this.handleInteraction(interaction).catch((error) => {
        console.error(`[DiscordPlugin] Error handling interaction:`, error);
      });
    });

    // Handle errors
    this.client.on(Events.Error, (error: Error) => {
      console.error(`[DiscordPlugin] Client error:`, error);
      this.setError(error.message);
    });

    this.client.on(Events.Warn, (warning: string) => {
      console.warn(`[DiscordPlugin] Warning:`, warning);
    });
  }

  private async handleTextMessage(msg: Message): Promise<void> {
    // Ignore bot messages (including our own)
    if (msg.author.bot) return;

    // Track user
    this.activeUsers.add(msg.author.id);

    // Convert to unified format
    const unifiedMessage = toUnifiedIncomingMessage(msg);
    if (!unifiedMessage) return;

    // Forward to message handler (non-blocking)
    await this.emitMessage(unifiedMessage);
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await this.handleSlashCommand(interaction);
      return;
    }

    // Handle button clicks
    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction);
      return;
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Track user
    this.activeUsers.add(interaction.user.id);

    // Acknowledge immediately to prevent "application did not respond" error
    await interaction.deferReply();

    const unifiedMessage = interactionToUnifiedMessage(interaction);
    if (!unifiedMessage) {
      await interaction.editReply('Failed to process command.');
      return;
    }

    // Map slash commands to actions
    const commandActions: Record<string, { type: 'system' | 'platform'; name: string }> = {
      start: { type: 'platform', name: 'pairing.show' },
      help: { type: 'system', name: 'help.show' },
      status: { type: 'system', name: 'session.status' },
      new: { type: 'system', name: 'session.new' },
      agent: { type: 'system', name: 'agent.show' },
    };

    const commandAction = commandActions[interaction.commandName];
    if (commandAction) {
      unifiedMessage.action = {
        type: commandAction.type,
        name: commandAction.name,
      };
    }

    // Forward to message handler (non-blocking)
    await this.emitMessage(unifiedMessage);
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    // Track user
    this.activeUsers.add(interaction.user.id);

    const category = extractCategory(interaction.customId);
    const action = extractAction(interaction.customId);

    // Handle confirmation buttons directly via confirmHandler
    if (category === 'confirm') {
      const parts = interaction.customId.split(':');
      const callId = parts[1];
      const value = parts[2];

      if (callId && value && this.confirmHandler) {
        // Acknowledge the button
        await interaction.deferUpdate();

        // Remove buttons from the message
        try {
          await interaction.message.edit({ components: [] });
        } catch {
          // Ignore edit errors
        }

        // Forward to confirm handler
        await this.confirmHandler(interaction.user.id, 'discord', callId, value);
        return;
      }
    }

    // Handle agent selection
    if (category === 'agent' && action !== 'show') {
      // Acknowledge the button
      await interaction.deferUpdate();

      // Remove buttons
      try {
        await interaction.message.edit({ components: [] });
      } catch {
        // Ignore edit errors
      }

      const unifiedMessage = buttonInteractionToUnifiedMessage(interaction);
      if (!unifiedMessage) return;

      unifiedMessage.action = {
        type: 'system',
        name: 'agent.select',
        params: { agentType: action },
      };

      await this.emitMessage(unifiedMessage);
      return;
    }

    // Handle other button actions
    await interaction.deferUpdate();

    const unifiedMessage = buttonInteractionToUnifiedMessage(interaction);
    if (!unifiedMessage) return;

    await this.emitMessage(unifiedMessage);
  }

  // ==================== Slash Commands ====================

  private async registerSlashCommands(): Promise<void> {
    if (!this.client?.user) return;

    const commands = [
      new SlashCommandBuilder().setName('start').setDescription('Start pairing with AionUi'),
      new SlashCommandBuilder().setName('help').setDescription('Show help information'),
      new SlashCommandBuilder().setName('status').setDescription('Show current session status'),
      new SlashCommandBuilder().setName('new').setDescription('Start a new conversation'),
      new SlashCommandBuilder().setName('agent').setDescription('Switch AI agent'),
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(this.token);

      // Register globally (takes up to 1 hour to propagate, but persists)
      await rest.put(Routes.applicationCommands(this.client.user.id), {
        body: commands.map((cmd) => cmd.toJSON()),
      });

      console.log(`[DiscordPlugin] Registered ${commands.length} slash commands`);
    } catch (error) {
      console.error('[DiscordPlugin] Failed to register slash commands:', error);
      // Non-fatal - bot still works with DMs
    }
  }

  // ==================== Static Methods ====================

  /**
   * Test connection with the given token
   */
  static async testConnection(token: string): Promise<{ success: boolean; botInfo?: BotInfo; error?: string }> {
    const testClient = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    try {
      const readyPromise = new Promise<BotInfo>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000);

        testClient.once(Events.ClientReady, (readyClient) => {
          clearTimeout(timeout);
          resolve({
            id: readyClient.user.id,
            username: readyClient.user.username,
            displayName: readyClient.user.displayName || readyClient.user.username,
          });
        });
      });

      await testClient.login(token);
      const botInfo = await readyPromise;

      return { success: true, botInfo };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      // Check for specific Discord error codes
      if (message.includes('TOKEN_INVALID') || message.includes('An invalid token was provided')) {
        return { success: false, error: 'Invalid bot token. Check your token in the Discord Developer Portal.' };
      }

      return { success: false, error: message };
    } finally {
      testClient.destroy();
    }
  }
}
