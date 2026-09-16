import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AnthropicProviderService } from './anthropic-provider.service';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

describe('AnthropicProviderService.generateJson', () => {
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: AnthropicProviderService;
  const schema = z.object({ summary: z.string() });

  beforeEach(() => {
    mockCreate.mockReset();
    configService = { get: vi.fn().mockReturnValue('test-api-key') };
    service = new AnthropicProviderService(
      configService as unknown as ConfigService,
    );
  });

  it('parses and validates a well-formed JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"summary": "hello"}' }],
    });

    const result = await service.generateJson('prompt', schema);

    expect(result).toEqual({ summary: 'hello' });
  });

  it('strips a markdown code fence if the model adds one anyway', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"summary": "hi"}\n```' }],
    });

    const result = await service.generateJson('prompt', schema);

    expect(result).toEqual({ summary: 'hi' });
  });

  it('throws a clear error when the response is not valid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    await expect(service.generateJson('prompt', schema)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error when the JSON does not match the expected schema', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"wrong": true}' }],
    });

    await expect(service.generateJson('prompt', schema)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error when the SDK call itself fails', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));

    await expect(service.generateJson('prompt', schema)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error when no API key is configured, without ever calling the SDK', async () => {
    configService.get.mockReturnValue(undefined);

    await expect(service.generateJson('prompt', schema)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
