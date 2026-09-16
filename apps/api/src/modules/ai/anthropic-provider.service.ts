import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ZodType } from 'zod';
import { EnvConfig } from '../../config/env.schema';
import { extractJsonText } from './json-extract.util';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const SYSTEM_PROMPT =
  'You respond with a single valid JSON value only — no prose, no markdown code fences, no explanation.';

/**
 * The only place any endpoint talks to Anthropic — keeps the provider
 * swappable later. Never throws in the constructor on a missing API key
 * (that would fail Nest's app bootstrap entirely); the "not configured"
 * check happens lazily, on first call.
 */
@Injectable()
export class AnthropicProviderService {
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async generateJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    const client = this.getClient();

    let raw: string;
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = message.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in AI response');
      }
      raw = textBlock.text;
    } catch {
      throw new ServiceUnavailableException(
        'Không thể kết nối tới dịch vụ AI. Vui lòng thử lại.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonText(raw));
    } catch {
      throw new ServiceUnavailableException(
        'AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.',
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new ServiceUnavailableException(
        'AI trả về dữ liệu không đúng định dạng. Vui lòng thử lại.',
      );
    }
    return result.data;
  }

  private getClient(): Anthropic {
    if (this.client) return this.client;
    const apiKey = this.configService.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Tính năng AI chưa được cấu hình trên máy chủ.',
      );
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }
}
