/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ButtonInteraction, ChatInputCommandInteraction, Message } from 'discord.js';
import type { IUnifiedIncomingMessage, IUnifiedMessageContent, IUnifiedOutgoingMessage, IUnifiedUser } from '../../types';

export const DISCORD_MESSAGE_LIMIT = 2000;

// ==================== Incoming Message Conversion ====================

/**
 * Convert Discord Message to unified incoming message
 */
export function toUnifiedIncomingMessage(msg: Message): IUnifiedIncomingMessage | null {
  const user = toUnifiedUser(msg.author);
  if (!user) return null;

  const content = extractMessageContent(msg);

  return {
    id: msg.id,
    platform: 'discord',
    chatId: msg.channelId,
    user,
    content,
    timestamp: msg.createdTimestamp,
    replyToMessageId: msg.reference?.messageId ?? undefined,
    raw: msg,
  };
}

/**
 * Convert Discord slash command interaction to unified incoming message
 */
export function interactionToUnifiedMessage(interaction: ChatInputCommandInteraction): IUnifiedIncomingMessage | null {
  const user = toUnifiedUser(interaction.user);
  if (!user) return null;

  return {
    id: interaction.id,
    platform: 'discord',
    chatId: interaction.channelId,
    user,
    content: {
      type: 'command',
      text: `/${interaction.commandName}`,
    },
    timestamp: interaction.createdTimestamp,
  };
}

/**
 * Convert Discord button interaction to unified incoming message with action
 */
export function buttonInteractionToUnifiedMessage(interaction: ButtonInteraction): IUnifiedIncomingMessage | null {
  const user = toUnifiedUser(interaction.user);
  if (!user) return null;

  const category = extractCategory(interaction.customId);
  const action = extractAction(interaction.customId);

  return {
    id: interaction.id,
    platform: 'discord',
    chatId: interaction.channelId,
    user,
    content: {
      type: 'action',
      text: interaction.customId,
    },
    timestamp: interaction.createdTimestamp,
    action: {
      type: category === 'system' || category === 'session' || category === 'help' || category === 'agent' ? 'system' : category === 'pairing' || category === 'error' ? 'platform' : 'chat',
      name: `${category}.${action}`,
      params: parseCallbackParams(interaction.customId),
    },
    raw: interaction,
  };
}

/**
 * Convert Discord user to unified user
 */
export function toUnifiedUser(discordUser: { id: string; username: string; displayName?: string; globalName?: string | null }): IUnifiedUser | null {
  if (!discordUser) return null;

  return {
    id: discordUser.id,
    username: discordUser.username,
    displayName: discordUser.globalName || discordUser.displayName || discordUser.username || `User ${discordUser.id}`,
  };
}

// ==================== Message Content Extraction ====================

/**
 * Extract content from a Discord message
 */
function extractMessageContent(msg: Message): IUnifiedMessageContent {
  // Text content
  if (msg.content) {
    return {
      type: 'text',
      text: msg.content,
    };
  }

  // Attachments
  if (msg.attachments.size > 0) {
    const attachment = msg.attachments.first()!;
    const contentType = attachment.contentType || '';

    if (contentType.startsWith('image/')) {
      return {
        type: 'photo',
        text: msg.content || '',
        attachments: [
          {
            type: 'photo',
            fileId: attachment.id,
            fileName: attachment.name ?? undefined,
            mimeType: contentType,
            size: attachment.size,
          },
        ],
      };
    }

    return {
      type: 'document',
      text: msg.content || '',
      attachments: [
        {
          type: 'document',
          fileId: attachment.id,
          fileName: attachment.name ?? undefined,
          mimeType: contentType || undefined,
          size: attachment.size,
        },
      ],
    };
  }

  return { type: 'text', text: '' };
}

// ==================== Outgoing Message Conversion ====================

/**
 * Convert IUnifiedOutgoingMessage to Discord send parameters
 */
export function toDiscordSendParams(message: IUnifiedOutgoingMessage): {
  content: string;
  components?: unknown[];
} {
  let text = message.text || '';

  // Convert HTML parse mode to Discord markdown
  if (message.parseMode === 'HTML') {
    text = htmlToDiscordMarkdown(text);
  }

  return {
    content: text,
    components: message.replyMarkup as unknown[] | undefined,
  };
}

// ==================== Text Formatting ====================

/**
 * Convert HTML formatting to Discord markdown
 */
export function htmlToDiscordMarkdown(html: string): string {
  let text = html;

  // Bold: <b>text</b> -> **text**
  text = text.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  text = text.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');

  // Italic: <i>text</i> -> *text*
  text = text.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  text = text.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');

  // Code: <code>text</code> -> `text`
  text = text.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // Pre-formatted: <pre>text</pre> -> ```text```
  text = text.replace(/<pre>([\s\S]*?)<\/pre>/gi, '```$1```');

  // Links: <a href="url">text</a> -> [text](url)
  text = text.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Underline: <u>text</u> -> __text__
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, '__$1__');

  // Strikethrough: <s>text</s> -> ~~text~~
  text = text.replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~');
  text = text.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');

  // HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  return text;
}

/**
 * Escape Discord markdown characters
 */
export function escapeDiscordMarkdown(text: string): string {
  return text.replace(/([*_~`|\\])/g, '\\$1');
}

// ==================== Message Splitting ====================

/**
 * Split a long message into chunks that fit Discord's limit
 */
export function splitMessage(text: string, maxLength: number = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    // Try to find a newline split point in the last 20% of the chunk
    const searchStart = Math.floor(maxLength * 0.8);
    let splitIndex = remaining.lastIndexOf('\n', maxLength);

    if (splitIndex < searchStart) {
      // No good newline, try space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }

    if (splitIndex < searchStart) {
      // No good split point, force split at limit
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

// ==================== Callback Data Utilities ====================

/**
 * Parse callback data: "category:action:param1:param2"
 */
export function parseCallbackData(data: string): { category: string; action: string; params: string[] } {
  const parts = data.split(':');
  return {
    category: parts[0] || '',
    action: parts[1] || '',
    params: parts.slice(2),
  };
}

/**
 * Build callback data string
 */
export function buildCallbackData(category: string, ...parts: string[]): string {
  return [category, ...parts].join(':');
}

/**
 * Extract category from callback data
 */
export function extractCategory(data: string): string {
  return data.split(':')[0] || '';
}

/**
 * Extract action from callback data
 */
export function extractAction(data: string): string {
  return data.split(':')[1] || '';
}

/**
 * Parse callback params into a record
 */
function parseCallbackParams(data: string): Record<string, string> {
  const parts = data.split(':');
  const params: Record<string, string> = {};

  if (parts[0] === 'agent' && parts[1]) {
    params.agentType = parts[1];
  } else if (parts[0] === 'confirm' && parts.length >= 3) {
    params.callId = parts[1];
    params.value = parts[2];
  }

  return params;
}
