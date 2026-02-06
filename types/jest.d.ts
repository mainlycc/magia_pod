/// <reference types="jest" />

// Deklaracja modułu @jest/globals
declare module '@jest/globals' {
  // Użyj globalnych typów z @types/jest
  export const describe: typeof global.describe;
  export const it: typeof global.it;
  export const test: typeof global.it;
  export const expect: typeof global.expect;
  export const beforeEach: typeof global.beforeEach;
  export const afterEach: typeof global.afterEach;
  export const beforeAll: typeof global.beforeAll;
  export const afterAll: typeof global.afterAll;
  
  // Eksportuj namespace jest z typami Mock
  export namespace jest {
    export function fn<T extends (...args: any[]) => any>(implementation?: T): jest.MockedFunction<T>;
    export function clearAllMocks(): void;
    export function resetAllMocks(): void;
    export function restoreAllMocks(): void;
    export function mock<T = unknown>(moduleName: string): jest.MockedFunction<T>;
    export function spyOn<T extends object, M extends jest.FunctionPropertyNames<T>>(
      object: T,
      method: M
    ): jest.MockedFunction<T[M]>;
    
    // Eksportuj typy Mock
    export type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = jest.MockedFunction<T>;
    export type MockedFunction<T extends (...args: any[]) => any> = T & {
      mock: {
        calls: Parameters<T>[];
        results: ReturnType<T>[];
        instances: any[];
      };
    };
    export type MockedObject<T> = T;
    export type FunctionPropertyNames<T> = {
      [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
    }[keyof T];
  }
  
  // Eksportuj typy bezpośrednio
  export type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;
  export type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = jest.Mock<T>;
}
