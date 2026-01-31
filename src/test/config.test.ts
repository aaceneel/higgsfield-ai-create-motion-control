import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured } from '../services/supabase';
import { klingApi } from '../services/kling';

describe('Configuration Tests', () => {
  it('should check Supabase configuration', () => {
    // This will check if environment variables are set
    const isConfigured = isSupabaseConfigured();
    expect(typeof isConfigured).toBe('boolean');
  });

  it('should check Kling API configuration', () => {
    const isConfigured = klingApi.isConfigured();
    expect(typeof isConfigured).toBe('boolean');
  });
});

describe('Service Tests', () => {
  it('should have Kling API service methods', () => {
    expect(klingApi).toHaveProperty('createMotionTransfer');
    expect(klingApi).toHaveProperty('getTaskResult');
    expect(klingApi).toHaveProperty('waitForCompletion');
    expect(klingApi).toHaveProperty('generateMotionTransfer');
    expect(klingApi).toHaveProperty('isConfigured');
  });
});
