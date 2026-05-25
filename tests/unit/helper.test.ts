// import { describe, expect, it, vi } from "vitest";


// function filterActiveUsers(
//     users: { name: string; active: boolean }[]
// ) {
//     return users.filter((user) => user.active);
// }

// function getTotalPrice(
//     items: { name: string; price: number }[]
// ) {
//     return items.reduce((sum, item) => sum + item.price, 0);
// }

// function findUserById(
//     users: { id: number; name: string }[],
//     id: number
// ) {
//     return users.find((user) => user.id === id);
// }

// function getCurrentYear() {
//   return new Date().getFullYear();
// };

// async function getData(url:string){
//    const res = await fetch(url);
//    return await res.json();
// }

// describe("level 4", () => {



//     it("testing date with mock ",()=>{

//         vi.spyOn(Date.prototype,"getFullYear").mockReturnValue(2000);
//         expect(getCurrentYear()).toBe(2000)
       

//     })
//     it("testing data fetch with mock ",async()=>{
// const mockData = {
//   userId: 1,
//   id: 1,
//   title: "delectus aut autem",
//   completed: false
// }
//        global.fetch = vi.fn().mockResolvedValue({
//         json:vi.fn().mockResolvedValue(mockData)
//        }) as any;

//        //act
//        const result = await getData("https://jsonplaceholder.typicode.com/todos/1");

//        expect(fetch).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/todos/1");

//        expect(result).toMatchObject(mockData as any)
       

//     })
//     it("testing data fetch with mock with throw error ",async()=>{
// const mockData = {
//   userId: 1,
//   id: 1,
//   title: "delectus aut autem",
//   completed: false
// }
//        global.fetch = vi.fn().mockRejectedValue(new Error("invalid api"))



      
//         await expect( getData("https://jsonplaceholder.typicode.com/todos/1")).rejects.toThrow("invalid api")
       

//     })


// })