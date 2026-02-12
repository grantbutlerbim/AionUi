/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpDetector } from '@/agent/acp/AcpDetector';
import type { TProviderWithModel } from '@/common/storage';
import { ProcessConfig } from '@/process/initStorage';
import { ConversationService } from '@/process/services/conversationService';
import WorkerManage from '@/process/WorkerManage';
import { getChannelMessageService } from '../agent/ChannelMessageService';
import { getChannelManager } from '../core/ChannelManager';
import { createAgentSelectionComponents, createHelpComponents, createMainMenuComponents, createSessionControlComponents } from '../plugins/discord/DiscordComponents';
import type { AgentDisplayInfo } from '../plugins/telegram/TelegramKeyboards';
import { createAgentSelectionKeyboard, createHelpKeyboard, createMainMenuKeyboard, createSessionControlKeyboard } from '../plugins/telegram/TelegramKeyboards';
import { createAgentSelectionCard, createFeaturesCard, createHelpCard, createMainMenuCard, createPairingGuideCard, createSessionStatusCard, createSettingsCard, createTipsCard } from '../plugins/lark/LarkCards';
import { getChannelConversationName, isChannelPlatform } from '../types';
import type { ChannelAgentType, ChannelPlatform } from '../types';
import type { ActionHandler, IRegisteredAction } from './types';
import { SystemActionNames, createErrorResponse, createSuccessResponse } from './types';

export type { ChannelPlatform };
export { getChannelConversationName };

/**
 * Get platform-specific main menu markup
 */
function getPlatformMainMenuMarkup(platform: string) {
  if (platform === 'lark') return createMainMenuCard();
  if (platform === 'discord') return createMainMenuComponents();
  return createMainMenuKeyboard();
}

/**
 * Get the default model for a channel platform
 * Reads from saved config or falls back to default Gemini model
 */
export async function getChannelDefaultModel(platform: ChannelPlatform): Promise<TProviderWithModel> {
  const configKeys: Record<ChannelPlatform, string> = {
    telegram: 'assistant.telegram.defaultModel',
    lark: 'assistant.lark.defaultModel',
    discord: 'assistant.discord.defaultModel',
  };
  const configKey = configKeys[platform];

  try {
    // Try to get saved model selection
    const savedModel = await ProcessConfig.get(configKey);
    if (savedModel?.id && savedModel?.useModel) {
      // Get full provider config from model.config
      const providers = await ProcessConfig.get('model.config');
      if (providers && Array.isArray(providers)) {
        const provider = providers.find((p) => p.id === savedModel.id);
        if (provider && provider.model?.includes(savedModel.useModel)) {
          return {
            ...provider,
            useModel: savedModel.useModel,
          } as TProviderWithModel;
        }
      }
    }

    // Fallback: try to get any Gemini provider
    const providers = await ProcessConfig.get('model.config');
    if (providers && Array.isArray(providers)) {
      const geminiProvider = providers.find((p) => p.platform === 'gemini');
      if (geminiProvider && geminiProvider.model?.length > 0) {
        return {
          ...geminiProvider,
          useModel: geminiProvider.model[0],
        } as TProviderWithModel;
      }
    }
  } catch (error) {
    console.warn(`[SystemActions] Failed to get saved model for ${platform}, using default:`, error);
  }

  // Default fallback - minimal config for Gemini
  return {
    id: 'gemini_default',
    platform: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    useModel: 'gemini-2.0-flash',
  };
}

/**
 * SystemActions - Handlers for system-level actions
 *
 * These actions handle session management, help, and settings.
 * They don't require AI processing - just system operations.
 */

/**
 * Handle session.new - Create a new conversation session
 */
export const handleSessionNew: ActionHandler = async (context) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  if (!context.channelUser) {
    return createErrorResponse('User not authorized');
  }

  // Clear existing session and agent for this user
  // 清除现有会话和 agent
  const existingSession = sessionManager.getSession(context.channelUser.id);
  if (existingSession) {
    // 清除 ChannelMessageService 中的 agent 缓存
    const messageService = getChannelMessageService();
    await messageService.clearContext(existingSession.id);

    // 直接使用 session.conversationId 清理 WorkerManage 中的 agent
    // 确保即使 sessionConversationMap 为空也能正确清理
    if (existingSession.conversationId) {
      try {
        WorkerManage.kill(existingSession.conversationId);
        console.log(`[SystemActions] Killed old conversation: ${existingSession.conversationId}`);
      } catch (err) {
        console.warn(`[SystemActions] Failed to kill old conversation:`, err);
      }
    }
  }
  sessionManager.clearSession(context.channelUser.id);

  // 获取用户选择的模型（根据平台）/ Get user selected model (based on platform)
  const platform: ChannelPlatform = isChannelPlatform(context.platform) ? context.platform : 'telegram';
  const model = await getChannelDefaultModel(platform);
  const conversationName = getChannelConversationName(platform);

  // 使用 ConversationService 创建新会话（始终创建新的，不复用）
  // Use ConversationService to create new conversation (always new, don't reuse)
  const result = await ConversationService.createGeminiConversation({
    model,
    source: platform,
    name: conversationName,
  });

  if (!result.success || !result.conversation) {
    return createErrorResponse(`Failed to create session: ${result.error || 'Unknown error'}`);
  }

  // Create session with the new conversation ID
  // 使用新会话 ID 创建 session
  const session = sessionManager.createSessionWithConversation(context.channelUser, result.conversation.id);

  const markup = getPlatformMainMenuMarkup(context.platform);
  return createSuccessResponse({
    type: 'text',
    text: `🆕 <b>New Session Created</b>\n\nSession ID: <code>${session.id.slice(-8)}</code>\n\nYou can start a new conversation now!`,
    parseMode: 'HTML',
    replyMarkup: markup,
  });
};

/**
 * Handle session.status - Show current session status
 */
export const handleSessionStatus: ActionHandler = async (context) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  const userId = context.channelUser?.id;
  const session = userId ? sessionManager.getSession(userId) : null;

  // Use platform-specific markup
  if (context.platform === 'lark') {
    const sessionData = session ? { id: session.id, agentType: session.agentType, createdAt: session.createdAt, lastActivity: session.lastActivity } : undefined;
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createSessionStatusCard(sessionData),
    });
  }

  if (!session) {
    return createSuccessResponse({
      type: 'text',
      text: '📊 <b>Session Status</b>\n\nNo active session.\n\nSend a message to start a new conversation, or tap the "New Chat" button.',
      parseMode: 'HTML',
      replyMarkup: context.platform === 'discord' ? createSessionControlComponents() : createSessionControlKeyboard(),
    });
  }

  const duration = Math.floor((Date.now() - session.createdAt) / 1000 / 60);
  const lastActivity = Math.floor((Date.now() - session.lastActivity) / 1000);

  return createSuccessResponse({
    type: 'text',
    text: ['📊 <b>Session Status</b>', '', `🤖 Agent: <code>${session.agentType}</code>`, `⏱ Duration: ${duration} min`, `📝 Last activity: ${lastActivity} sec ago`, `🔖 Session ID: <code>${session.id.slice(-8)}</code>`].join('\n'),
    parseMode: 'HTML',
    replyMarkup: context.platform === 'discord' ? createSessionControlComponents() : createSessionControlKeyboard(),
  });
};

/**
 * Handle help.show - Show help menu
 */
export const handleHelpShow: ActionHandler = async (context) => {
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createHelpCard(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: ['❓ <b>AionUi Assistant</b>', '', 'A remote assistant to interact with AionUi via Telegram.', '', '<b>Common Actions:</b>', '• 🆕 New Chat - Start a new session', '• 📊 Status - View current session status', '• ❓ Help - Show this help message', '', 'Send a message to chat with the AI assistant.'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: context.platform === 'discord' ? createHelpComponents() : createHelpKeyboard(),
  });
};

/**
 * Handle help.features - Show feature introduction
 */
export const handleHelpFeatures: ActionHandler = async (context) => {
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createFeaturesCard(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: ['🤖 <b>Features</b>', '', '<b>AI Chat</b>', '• Natural language conversation', '• Streaming output, real-time display', '• Context memory support', '', '<b>Session Management</b>', '• Single session mode', '• Clear context anytime', '• View session status', '', '<b>Message Actions</b>', '• Copy reply content', '• Regenerate reply', '• Continue conversation'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: context.platform === 'discord' ? createHelpComponents() : createHelpKeyboard(),
  });
};

/**
 * Handle help.pairing - Show pairing guide
 */
export const handleHelpPairing: ActionHandler = async (context) => {
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createPairingGuideCard(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: ['🔗 <b>Pairing Guide</b>', '', '<b>First-time Setup:</b>', '1. Send any message to the bot', '2. Bot displays pairing code', '3. Approve pairing in AionUi settings', '4. Ready to use after pairing', '', '<b>Notes:</b>', '• Pairing code valid for 10 minutes', '• AionUi app must be running', '• One Telegram account can only pair once'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: context.platform === 'discord' ? createHelpComponents() : createHelpKeyboard(),
  });
};

/**
 * Handle help.tips - Show usage tips
 */
export const handleHelpTips: ActionHandler = async (context) => {
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createTipsCard(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: ['💬 <b>Tips</b>', '', '<b>Effective Conversations:</b>', '• Be clear and specific', '• Feel free to ask follow-ups', '• Regenerate if not satisfied', '', '<b>Quick Actions:</b>', '• Use bottom buttons for quick access', '• Tap message buttons for actions', '• New chat clears history context'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: context.platform === 'discord' ? createHelpComponents() : createHelpKeyboard(),
  });
};

/**
 * Handle settings.show - Show settings info
 */
export const handleSettingsShow: ActionHandler = async (context) => {
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '',
      replyMarkup: createSettingsCard(),
    });
  }
  return createSuccessResponse({
    type: 'text',
    text: ['⚙️ <b>Settings</b>', '', 'Channel settings need to be configured in the AionUi app.', '', 'Open AionUi → WebUI → Channels'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: createMainMenuKeyboard(),
  });
};

/**
 * Handle agent.show - Show agent selection keyboard/card
 */
export const handleAgentShow: ActionHandler = async (context) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  // Get current agent type from session
  const userId = context.channelUser?.id;
  const session = userId ? sessionManager.getSession(userId) : null;
  const currentAgent = session?.agentType || 'gemini';

  // Get available agents dynamically
  const availableAgents = getAvailableChannelAgents();

  if (availableAgents.length === 0) {
    return createErrorResponse('No agents available');
  }

  // Use platform-specific markup
  if (context.platform === 'lark') {
    return createSuccessResponse({
      type: 'text',
      text: '', // Lark card includes the text
      replyMarkup: createAgentSelectionCard(availableAgents, currentAgent),
    });
  }

  const agentMarkup = context.platform === 'discord' ? createAgentSelectionComponents(availableAgents, currentAgent) : createAgentSelectionKeyboard(availableAgents, currentAgent);

  return createSuccessResponse({
    type: 'text',
    text: ['🔄 <b>Switch Agent</b>', '', 'Select an AI agent for your conversations:', '', `Current: <b>${getAgentDisplayName(currentAgent)}</b>`].join('\n'),
    parseMode: 'HTML',
    replyMarkup: agentMarkup,
  });
};

/**
 * Handle agent.select - Switch to a different agent
 */
export const handleAgentSelect: ActionHandler = async (context, params) => {
  const manager = getChannelManager();
  const sessionManager = manager.getSessionManager();

  if (!sessionManager) {
    return createErrorResponse('Session manager not available');
  }

  if (!context.channelUser) {
    return createErrorResponse('User not authorized');
  }

  const newAgentType = params?.agentType as ChannelAgentType;

  // Validate agent type is available
  const availableAgents = getAvailableChannelAgents();
  const isValidAgent = availableAgents.some((agent) => agent.type === newAgentType);
  if (!newAgentType || !isValidAgent) {
    return createErrorResponse('Invalid or unavailable agent type');
  }

  // Get current session
  const existingSession = sessionManager.getSession(context.channelUser.id);

  // If same agent, no need to switch
  if (existingSession?.agentType === newAgentType) {
    const markup = getPlatformMainMenuMarkup(context.platform);
    return createSuccessResponse({
      type: 'text',
      text: `✓ Already using <b>${getAgentDisplayName(newAgentType)}</b>`,
      parseMode: 'HTML',
      replyMarkup: markup,
    });
  }

  // Clear existing session and agent
  if (existingSession) {
    const messageService = getChannelMessageService();
    await messageService.clearContext(existingSession.id);

    if (existingSession.conversationId) {
      try {
        WorkerManage.kill(existingSession.conversationId);
        console.log(`[SystemActions] Killed old conversation for agent switch: ${existingSession.conversationId}`);
      } catch (err) {
        console.warn(`[SystemActions] Failed to kill old conversation:`, err);
      }
    }
  }
  sessionManager.clearSession(context.channelUser.id);

  // Create new session with the selected agent type
  const session = sessionManager.createSession(context.channelUser, newAgentType);

  console.log(`[SystemActions] Switched agent to ${newAgentType} for user ${context.channelUser.id}`);

  const markup = getPlatformMainMenuMarkup(context.platform);
  return createSuccessResponse({
    type: 'text',
    text: [`✓ <b>Switched to ${getAgentDisplayName(newAgentType)}</b>`, '', 'A new conversation has been started.', '', 'Send a message to begin!'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: markup,
  });
};

/**
 * Get display name for agent type
 */
function getAgentDisplayName(agentType: ChannelAgentType): string {
  const names: Record<ChannelAgentType, string> = {
    gemini: '🤖 Gemini',
    acp: '🧠 Claude',
    codex: '⚡ Codex',
    'openclaw-gateway': '🐾 OpenClaw',
  };
  return names[agentType] || agentType;
}

/**
 * Map backend type to ChannelAgentType
 * Only returns types that are supported by channels
 */
function backendToChannelAgentType(backend: string): ChannelAgentType | null {
  const mapping: Record<string, ChannelAgentType> = {
    gemini: 'gemini',
    claude: 'acp',
    codex: 'codex',
    'openclaw-gateway': 'openclaw-gateway',
  };
  return mapping[backend] || null;
}

/**
 * Get emoji for agent backend
 */
function getAgentEmoji(backend: string): string {
  const emojis: Record<string, string> = {
    gemini: '🤖',
    claude: '🧠',
    codex: '⚡',
    'openclaw-gateway': '🐾',
  };
  return emojis[backend] || '🤖';
}

/**
 * Get available agents for channel selection
 * Filters detected agents to only those supported by channels
 */
function getAvailableChannelAgents(): AgentDisplayInfo[] {
  const detectedAgents = acpDetector.getDetectedAgents();
  const availableAgents: AgentDisplayInfo[] = [];
  const seenTypes = new Set<ChannelAgentType>();

  // Always include Gemini as it's built-in
  availableAgents.push({ type: 'gemini', emoji: '🤖', name: 'Gemini' });
  seenTypes.add('gemini');

  // Add detected ACP agents (claude, codex, etc.)
  for (const agent of detectedAgents) {
    const channelType = backendToChannelAgentType(agent.backend);
    if (channelType && !seenTypes.has(channelType)) {
      availableAgents.push({
        type: channelType,
        emoji: getAgentEmoji(agent.backend),
        name: agent.name,
      });
      seenTypes.add(channelType);
    }
  }

  return availableAgents;
}

/**
 * All system actions
 */
export const systemActions: IRegisteredAction[] = [
  {
    name: SystemActionNames.SESSION_NEW,
    category: 'system',
    description: 'Create a new conversation session',
    handler: handleSessionNew,
  },
  {
    name: SystemActionNames.SESSION_STATUS,
    category: 'system',
    description: 'Show current session status',
    handler: handleSessionStatus,
  },
  {
    name: SystemActionNames.HELP_SHOW,
    category: 'system',
    description: 'Show help menu',
    handler: handleHelpShow,
  },
  {
    name: SystemActionNames.HELP_FEATURES,
    category: 'system',
    description: 'Show feature introduction',
    handler: handleHelpFeatures,
  },
  {
    name: SystemActionNames.HELP_PAIRING,
    category: 'system',
    description: 'Show pairing guide',
    handler: handleHelpPairing,
  },
  {
    name: SystemActionNames.HELP_TIPS,
    category: 'system',
    description: 'Show usage tips',
    handler: handleHelpTips,
  },
  {
    name: SystemActionNames.SETTINGS_SHOW,
    category: 'system',
    description: 'Show settings info',
    handler: handleSettingsShow,
  },
  {
    name: SystemActionNames.AGENT_SHOW,
    category: 'system',
    description: 'Show agent selection',
    handler: handleAgentShow,
  },
  {
    name: SystemActionNames.AGENT_SELECT,
    category: 'system',
    description: 'Switch to a different agent',
    handler: handleAgentSelect,
  },
];
