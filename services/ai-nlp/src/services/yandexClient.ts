/**
 * Yandex Cloud Foundation Models client
 */

import axios from 'axios';
import { AIMessage, AIResponse, AIRequest } from '../types/ai';
import { logger } from '../utils/logger';

const BASE_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const folderId = process.env.YC_FOLDER_ID;
const apiKey = process.env.YC_API_KEY;
const modelId = process.env.YC_MODEL_ID || 'foundation-models/yandexgpt-lite';

if (!folderId) {
  logger.warn('YC_FOLDER_ID is not set. Requests to YandexGPT will fail until it is configured.');
}

if (!apiKey) {
  logger.warn('YC_API_KEY is not set. Requests to YandexGPT will fail until it is configured.');
}

function buildModelUri(): string {
  if (!folderId) {
    return modelId;
  }

  // Allow passing fully-qualified URI via env
  if (modelId.startsWith('gpt://') || modelId.startsWith('emb://')) {
    return modelId;
  }

  // Default format for GPT models
  if (modelId.startsWith('foundation-models/')) {
    const suffix = modelId.replace('foundation-models/', '');
    return `gpt://${folderId}/${suffix}`;
  }

  return `gpt://${folderId}/${modelId}`;
}

export async function callYandexModel(payload: AIRequest): Promise<AIResponse> {
  if (!apiKey || !folderId) {
    logger.error('❌ YC_API_KEY or YC_FOLDER_ID is missing. Cannot call YandexGPT.');
    logger.error(`   YC_FOLDER_ID: ${folderId ? '✅ Set' : '❌ Missing'}`);
    logger.error(`   YC_API_KEY: ${apiKey ? '✅ Set' : '❌ Missing'}`);
    throw new Error('YC_API_KEY or YC_FOLDER_ID is missing.');
  }

  logger.info(`🤖 Calling YandexGPT API...`);
  logger.info(`   Model URI: ${buildModelUri()}`);
  logger.info(`   Messages count: ${payload.messages.length}`);

  const completionOptions = {
    stream: false,
    temperature:
      payload.completionOptions?.temperature ?? Number(process.env.YC_TEMPERATURE || 0.6),
    maxTokens: payload.completionOptions?.maxTokens ?? Number(process.env.YC_MAX_TOKENS || 800),
    topP: payload.completionOptions?.topP ?? Number(process.env.YC_TOP_P || 0.9),
  };

  const messages: AIMessage[] = payload.messages;

  const requestBody = {
    modelUri: buildModelUri(),
    completionOptions,
    messages,
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Api-Key ${apiKey}`,
    'x-folder-id': folderId,
  };

  const response = await axios.post(BASE_URL, requestBody, { headers });

  const alternative = response.data?.result?.alternatives?.[0];
  if (!alternative) {
    logger.error('❌ Empty response from YandexGPT');
    throw new Error('Empty response from YandexGPT');
  }

  const message: AIMessage = alternative.message as AIMessage;
  const usage = response.data?.result?.usage;

  logger.info(`✅ YandexGPT response received:`);
  logger.info(`   Input tokens: ${usage?.inputTextTokens || 0}`);
  logger.info(`   Completion tokens: ${usage?.completionTokens || 0}`);
  logger.info(`   Total tokens: ${usage?.totalTokens || 0}`);
  logger.info(`   Response text: ${message.text?.substring(0, 100)}...`);

  return {
    message,
    usage: {
      inputTokens: usage?.inputTextTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
    },
    raw: response.data,
  };
}
