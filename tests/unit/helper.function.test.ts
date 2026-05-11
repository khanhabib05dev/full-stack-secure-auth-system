// src/helpers/sendSuccess.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Response } from "express";
import { sendSuccess } from "../../src/utils/apiResponse";




function sum(a: number, b: number) {
    return a + b;
}

function isEven(num: number) {
    return num % 2 === 0;
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function greet(name = "Guest") {
    return `Hello ${name}`;
}

function createUser(name: string, role = "user") {
    return { name, role };
}

function divide(a: number, b: number) {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
}

function parseJson(json: string) {
    return JSON.parse(json);
}

describe("unit testing exam", () => {


    // error handling


    it("parsse json", () => {
        // arrabge 
        let payload = {
            "name":"haib",
            "age":20
        }
        //act
        const result = parseJson(JSON.stringify(payload));
      console.log(result);
      
        //assert 
        expect(result).toBeTypeOf("object");
        expect(result).toMatchObject({
             name: "haib",
  age: 20,
        })

    })
   it("should throw error for invalid json", () => {
  expect(() => parseJson("{ invalid }")).toThrow();
});

    it("error divide", () => {
        // arrabge 
        let a = 4
        let b = 0
        //act
        const result = divide(a, b);
        console.log(result);

        //assert 
        expect(result).toThrow("Division by zero")

    })

    it(" divide", () => {
        // arrabge 
        let a = 16
        let b = 4
        //act
        const result = divide(a, b);

        //assert 
        expect(result).toBe(4)

    })


    it("sum", () => {
        // arrange
        const a = 10;
        const b = 5
        // act
        const result = sum(a, b);
        //assert
        expect(result).toBe(15)
    });

    it("even", () => {
        //arrange
        let num = 10;
        let num2 = 9;

        //act

        const result = isEven(num);
        const result2 = isEven(num2);

        //assert

        expect(result).toBe(true)
        expect(result2).toBe(false)
    })
    it("capitalize", () => {
        //arrange
        let str = "hello"
        //act
        const result = capitalize(str);
        //assert
        expect(result).toEqual("Hello")
    })
    it("greet with value", () => {
        //arrange
        let str = "habib"
        //act
        const result = greet(str)
        //assert
        expect(result).toMatch(`Hello ${str}`)

    })

    it("greet with default vallue", () => {
        //act
        const result = greet();
        //assert
        expect(result).toMatch(`Hello Guest`)

    });


    it("create user", () => {
        //arrange

        const payload = {
            name: "Habib",
            role: "BOKACHODA"
        };


        //act
        const result = createUser(payload.name, payload.role);
        //assert
        expect(result).toMatchObject({
            name: "Habib",
            role: "BOKACHODA"
        })

    })


    it("create user with default role", () => {
        //arrange

        const payload = {
            name: "Habib",
        };


        //act
        const result = createUser(payload.name);
        //assert
        expect(result).toMatchObject({
            name: "Habib",
            role: "user"
        })

    })









});