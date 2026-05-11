// tests/setup/prismaMock.ts
import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "../../src/generated/prisma/client";

// Deep mock তৈরি
const prismaMock: DeepMockProxy<PrismaClient> =
  mockDeep<PrismaClient>();

// তোমার prisma singleton/module mock করো
vi.mock("../../src/config/prisma", () => ({
  default: prismaMock,
}));

// প্রতিটি test এর আগে mock reset
beforeEach(() => {
  mockReset(prismaMock);
});

export { prismaMock };