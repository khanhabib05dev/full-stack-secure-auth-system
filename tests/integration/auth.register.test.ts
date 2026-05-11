
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { AuthProvider, UserStatus } from "../../src/generated/prisma/enums";


describe("POST /api/v1/auth/register", () => {
    beforeEach(async () => {

        await prisma.session.deleteMany();
        await prisma.user.deleteMany();
    });

    // it("should register user and send OTP email", async () => {
    //     const res = await request(app)
    //         .post("/api/auth/register")
    //         .send({
    //             name: "Habibur Rahman",
    //             email: "habibur@test.com",
    //             password: "StrongPass@123",
    //             authProvider: AuthProvider.local,
    //             status: UserStatus.active,
    //             role: "customer",
    //             agreeTerms:true
    //         });


    //     expect(res.statusCode).toBe(201);
    //     // expect(res.body).toHaveProperty("token"); // verify-email redirect token
    //     // DB তে user created হয়েছে কিনা
    //     const user = await prisma.user.findUnique({
    //         where: { email: "habibur@test.com" }
    //     });
    //     expect(user).toBeTruthy();
    //     expect(user?.emailVerified).toBe(false); // এখনো verify হয়নি
    // });

    // it("should reject duplicate email", async () => {
    //     await request(app).post("/api/auth/register")
    //         .send({ 

    //              name: "Habibur Rahman",
    //             email: "habibur@test.com",
    //             password: "StrongPass@123",
    //             authProvider: AuthProvider.local,
    //             status: UserStatus.active,
    //             role: "customer",
    //             agreeTerms:true
    //         });

    //     const res = await request(app).post("/api/auth/register")
    //         .send({
    //              name: "Habibur Rahman",
    //             email: "habibur@test.com",
    //             password: "StrongPass@123",
    //             authProvider: AuthProvider.local,
    //             status: UserStatus.active,
    //             role: "customer",
    //             agreeTerms:true
    //         });

       
            

    //     expect(res.status).toBe(400);
    // });
});