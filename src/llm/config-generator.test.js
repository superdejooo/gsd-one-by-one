import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module using factory function
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
  }
}));

// Mock os module using factory function
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/mock/home')
  }
}));

// Import after mocks
import { generateCCRConfig } from './config-generator.js';
import fs from 'fs';
import os from 'os';

describe('generateCCRConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.CCR_DEFAULT_MODEL = 'test-model';
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CCR_DEFAULT_MODEL;
  });

  it('creates config directory if not exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    generateCCRConfig();

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/home/.claude-code-router', { recursive: true });
  });

  it('writes config.json to ~/.claude-code-router/', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mock/home/.claude-code-router/config.json',
      expect.any(String),
      'utf8'
    );
  });

  it('includes NON_INTERACTIVE_MODE: true', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config.NON_INTERACTIVE_MODE).toBe(true);
  });

  it('includes Providers array with openrouter', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config.Providers).toBeInstanceOf(Array);
    expect(config.Providers.length).toBeGreaterThan(0);
    expect(config.Providers[0].name).toBe('openrouter');
    expect(config.Providers[0].api_key).toBe('test-key');
  });

  it('includes Router with default model', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config.Router).toBeDefined();
    expect(config.Router.default).toContain('test-model');
  });

  it('throws if OPENROUTER_API_KEY not set', () => {
    delete process.env.OPENROUTER_API_KEY;

    expect(() => generateCCRConfig()).toThrow('OPENROUTER_API_KEY environment variable is required');
  });

  it('uses CCR_DEFAULT_MODEL env var when provided', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    process.env.CCR_DEFAULT_MODEL = 'custom-model';

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config.Router.default).toBe('openrouter,custom-model');
  });

  it('defaults to z-ai/glm-4.7 when CCR_DEFAULT_MODEL not set', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    delete process.env.CCR_DEFAULT_MODEL;

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config.Router.default).toBe('openrouter,z-ai/glm-4.7');
  });

  it('skips directory creation if directory exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('includes full CCR config structure', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    generateCCRConfig();

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const configContent = writeCall[1];
    const config = JSON.parse(configContent);

    expect(config).toHaveProperty('NON_INTERACTIVE_MODE');
    expect(config).toHaveProperty('LOG');
    expect(config).toHaveProperty('LOG_LEVEL');
    expect(config).toHaveProperty('HOST');
    expect(config).toHaveProperty('PORT');
    expect(config).toHaveProperty('Providers');
    expect(config).toHaveProperty('Router');
    expect(config).toHaveProperty('StatusLine');
  });
});
