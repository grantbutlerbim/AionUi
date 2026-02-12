/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ChannelAgentType } from '../../types';

/**
 * Agent display information for selection UI
 */
export interface AgentDisplayInfo {
  type: ChannelAgentType;
  emoji: string;
  name: string;
}

// ==================== Menu Components ====================

/**
 * Create main menu action buttons
 */
export function createMainMenuComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('session:new').setLabel('New Chat').setStyle(ButtonStyle.Primary).setEmoji('🆕'),
      new ButtonBuilder().setCustomId('agent:show').setLabel('Agent').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('session:status').setLabel('Status').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
      new ButtonBuilder().setCustomId('help:show').setLabel('Help').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    ),
  ];
}

/**
 * Create pairing keyboard buttons
 */
export function createPairingComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('pairing:refresh').setLabel('Refresh Code').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('help:pairing').setLabel('Pairing Help').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    ),
  ];
}

// ==================== Response Components ====================

/**
 * Create response action buttons (shown after AI completes a response)
 */
export function createResponseActionsComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('action:copy').setLabel('Copy').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId('action:regenerate').setLabel('Regenerate').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('action:continue').setLabel('Continue').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
    ),
  ];
}

// ==================== Agent Selection ====================

/**
 * Create agent selection buttons
 */
export function createAgentSelectionComponents(agents: AgentDisplayInfo[], currentAgent?: ChannelAgentType): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonsInRow = 0;

  for (const agent of agents) {
    const isCurrent = agent.type === currentAgent;
    const label = isCurrent ? `✓ ${agent.name}` : agent.name;

    currentRow.addComponents(new ButtonBuilder().setCustomId(`agent:${agent.type}`).setLabel(label).setStyle(isCurrent ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji(agent.emoji));

    buttonsInRow++;
    // Discord allows max 5 buttons per row
    if (buttonsInRow >= 4) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonsInRow = 0;
    }
  }

  if (buttonsInRow > 0) {
    rows.push(currentRow);
  }

  return rows;
}

// ==================== Session Control ====================

/**
 * Create session control buttons
 */
export function createSessionControlComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('session:new').setLabel('New Session').setStyle(ButtonStyle.Primary).setEmoji('🆕'),
      new ButtonBuilder().setCustomId('session:status').setLabel('Session Status').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
    ),
  ];
}

// ==================== Help ====================

/**
 * Create help navigation buttons
 */
export function createHelpComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('help:features').setLabel('Features').setStyle(ButtonStyle.Secondary).setEmoji('🤖'),
      new ButtonBuilder().setCustomId('help:pairing').setLabel('Pairing Guide').setStyle(ButtonStyle.Secondary).setEmoji('🔗'),
      new ButtonBuilder().setCustomId('help:tips').setLabel('Tips').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
    ),
  ];
}

// ==================== Error Recovery ====================

/**
 * Create error recovery buttons
 */
export function createErrorRecoveryComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('error:retry').setLabel('Retry').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('session:new').setLabel('New Session').setStyle(ButtonStyle.Secondary).setEmoji('🆕'),
    ),
  ];
}

// ==================== Confirmation ====================

/**
 * Create tool confirmation buttons
 * @param callId - The tool call ID for routing the response
 * @param options - Available confirmation options
 */
export function createToolConfirmationComponents(callId: string, options: Array<{ label: string; value: string }>): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonsInRow = 0;

  for (const option of options) {
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm:${callId}:${option.value}`)
        .setLabel(option.label)
        .setStyle(option.value.includes('cancel') || option.value.includes('reject') ? ButtonStyle.Danger : ButtonStyle.Success),
    );

    buttonsInRow++;
    if (buttonsInRow >= 3) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonsInRow = 0;
    }
  }

  if (buttonsInRow > 0) {
    rows.push(currentRow);
  }

  return rows;
}

// ==================== Pairing Status ====================

/**
 * Create pairing status check buttons
 */
export function createPairingStatusComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('pairing:check').setLabel('Check Status').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
      new ButtonBuilder().setCustomId('pairing:refresh').setLabel('Get New Code').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    ),
  ];
}
