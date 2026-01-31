import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock Prisma
export const prismaMock = mockDeep<PrismaClient>();

// Mock Redis
export const redisMock = mockDeep<Redis>();

// Reset mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
  mockReset(redisMock);
});

// Global test timeout
jest.setTimeout(30000);

// Suppress console during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
