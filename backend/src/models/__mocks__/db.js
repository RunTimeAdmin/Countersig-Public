/**
 * Mock database module for testing
 */

import { vi } from 'vitest';

export const query = vi.fn();
export const pool = {
  query: vi.fn(),
  on: vi.fn()
};
export const setMockQuery = vi.fn();
