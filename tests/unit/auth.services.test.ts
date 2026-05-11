// tests/unit/auth.service.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup/prismaMock";
import { authServices } from "../../src/modules/auth/auth.service";


describe("AuthService.register", () => {
  // it("throws 409 if email already exists", async () => {
  //   // এখন এটা কাজ করবে ✅
  //   prismaMock.user.findUnique.mockResolvedValue({
  //     id: "1",
  //     email: "exists@test.com",
  //   });

  //   await expect(
  //     authServices.registerUser({ name: "X", email: "exists@test.com", password: "Pass@1" ,agreeTerms:true,role:"customer"})
  //   ).rejects.toMatchObject({ statusCode: 400 });

  //   expect(prismaMock.user.create).not.toHaveBeenCalled();
  // });
});