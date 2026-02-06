/**
 * Helpery do testowania API
 */

import { NextRequest } from "next/server";

/**
 * Mock Supabase client dla testów
 */
export function createMockSupabaseClient(mockData: any = {}) {
  // Helper do tworzenia query builder chain
  const createQueryBuilder = (table: string) => {
    let queryChain: any = {
      // Obsługa .select() bez .eq()
      select: jest.fn((columns?: string) => {
        const selectBuilder: any = {
          // Obsługa .eq() po .select()
          eq: jest.fn((column: string, value: any) => {
            const eqBuilder: any = {
              // Obsługa kolejnego .eq() po .eq() (np. .eq("id", id).eq("is_active", true))
              eq: jest.fn((nextColumn: string, nextValue: any) => {
                const nextEqBuilder: any = {
                  single: jest.fn(() => {
                    // Dla trips z .eq("id", id).eq("is_active", true).single()
                    if (table === "trips" && column === "id") {
                      return Promise.resolve({ 
                        data: mockData.trip || null, 
                        error: mockData.trip ? null : { 
                          message: "Not found", 
                          code: "PGRST116",
                          details: "The result contains 0 rows",
                          hint: null,
                          status: 404,
                          // Upewnij się, że error ma wszystkie wymagane właściwości
                        } as any
                      });
                    }
                    return Promise.resolve({ data: mockData.trip || null, error: null });
                  }),
                };
                // Obsługa bezpośredniego wykonania query po .eq().eq() (bez .single())
                const nextEqPromise = Promise.resolve({ 
                  data: mockData.trip ? [mockData.trip] : [], 
                  error: null 
                });
                nextEqBuilder.then = nextEqPromise.then.bind(nextEqPromise);
                nextEqBuilder.catch = nextEqPromise.catch.bind(nextEqPromise);
                nextEqBuilder.finally = nextEqPromise.finally.bind(nextEqPromise);
                Object.setPrototypeOf(nextEqBuilder, Promise.prototype);
                return nextEqBuilder;
              }),
              // Obsługa .single() po .eq()
              single: jest.fn(() => {
                // Dla trips z id
                if (table === "trips" && column === "id") {
                  return Promise.resolve({ 
                    data: mockData.trip || null, 
                    error: mockData.trip ? null : { 
                      message: "Not found", 
                      code: "PGRST116",
                      details: "The result contains 0 rows",
                      hint: null,
                      status: 404
                    } 
                  });
                }
                // Dla bookings z booking_ref
                if (table === "bookings" && column === "booking_ref") {
                  return Promise.resolve({ 
                    data: mockData.booking || null, 
                    error: mockData.booking ? null : { 
                      message: "Not found", 
                      code: "PGRST116",
                      details: "The result contains 0 rows",
                      hint: null,
                      status: 404
                    } 
                  });
                }
                // Dla profiles z id
                if (table === "profiles" && column === "id") {
                  return Promise.resolve({ 
                    data: mockData.user ? { id: mockData.user.id, role: mockData.user.role } : null, 
                    error: null 
                  });
                }
                // Domyślne
                return Promise.resolve({ data: null, error: null });
              }),
              // Obsługa .limit() po .eq()
              limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
            };
            // Obsługa bezpośredniego wykonania query po .eq() (bez .single())
            // Query builder musi być thenable (Promise-like)
            const eqPromise = Promise.resolve({
              data: (table === "trips" && column === "is_active")
                ? (Array.isArray(mockData.trips) ? mockData.trips : (mockData.trip ? [mockData.trip] : []))
                : [],
              error: null
            });
            eqBuilder.then = eqPromise.then.bind(eqPromise);
            eqBuilder.catch = eqPromise.catch.bind(eqPromise);
            eqBuilder.finally = eqPromise.finally.bind(eqPromise);
            Object.setPrototypeOf(eqBuilder, Promise.prototype);
            return eqBuilder;
          }),
          // Obsługa .or() po .select() - template string jak "slug.eq.xxx,public_slug.eq.xxx"
          or: jest.fn((filter: string) => {
            const orBuilder: any = {
              eq: jest.fn((column: string, value: any) => {
                const eqBuilder: any = {
                  // Obsługa kolejnego .eq() po .or().eq() (np. .or().eq("is_active", true).eq(...))
                  eq: jest.fn((nextColumn: string, nextValue: any) => {
                    const nextEqBuilder: any = {
                      single: jest.fn(() => {
                        // Dla trips z .or().eq("is_active", true).single()
                        if (table === "trips" && column === "is_active") {
                          return Promise.resolve({ 
                            data: mockData.trip || null, 
                            error: mockData.trip ? null : { 
                              message: "Not found", 
                              code: "PGRST116",
                              details: "The result contains 0 rows",
                              hint: null,
                              status: 404
                            } 
                          });
                        }
                        return Promise.resolve({ data: mockData.trip || null, error: null });
                      }),
                    };
                    const nextEqPromise = Promise.resolve({ 
                      data: mockData.trip ? [mockData.trip] : [], 
                      error: null 
                    });
                    nextEqBuilder.then = nextEqPromise.then.bind(nextEqPromise);
                    nextEqBuilder.catch = nextEqPromise.catch.bind(nextEqPromise);
                    nextEqBuilder.finally = nextEqPromise.finally.bind(nextEqPromise);
                    return nextEqBuilder;
                  }),
                  single: jest.fn(() => {
                    // Dla trips z .or().eq("is_active", true).single()
                    if (table === "trips" && column === "is_active") {
                      return Promise.resolve({ 
                        data: mockData.trip || null, 
                        error: mockData.trip ? null : { 
                          message: "Not found", 
                          code: "PGRST116",
                          details: "The result contains 0 rows",
                          hint: null,
                          status: 404
                        } 
                      });
                    }
                    return Promise.resolve({ data: mockData.trip || null, error: null });
                  }),
                };
                // Obsługa bezpośredniego wykonania query po .or().eq() (bez .single())
                const orEqPromise = Promise.resolve({ 
                  data: mockData.trip ? [mockData.trip] : [], 
                  error: null 
                });
                eqBuilder.then = orEqPromise.then.bind(orEqPromise);
                eqBuilder.catch = orEqPromise.catch.bind(orEqPromise);
                eqBuilder.finally = orEqPromise.finally.bind(orEqPromise);
                try {
                  Object.setPrototypeOf(eqBuilder, Promise.prototype);
                } catch (e) {
                  // Ignoruj błąd
                }
                return eqBuilder;
              }),
            };
            // Obsługa bezpośredniego wykonania query po .or() (bez .eq())
            const orPromise = Promise.resolve({ 
              data: mockData.trip ? [mockData.trip] : [], 
              error: null 
            });
            orBuilder.then = orPromise.then.bind(orPromise);
            orBuilder.catch = orPromise.catch.bind(orPromise);
            orBuilder.finally = orPromise.finally.bind(orPromise);
            try {
              Object.setPrototypeOf(orBuilder, Promise.prototype);
            } catch (e) {
              // Ignoruj błąd
            }
            return orBuilder;
          }),
          // Obsługa .single() bezpośrednio po .select()
          single: jest.fn(() => Promise.resolve({ data: mockData.trip || null, error: null })),
        };
        
        // Obsługa bezpośredniego wykonania query po .select() (bez .eq())
        // To jest używane w GET /api/trips gdzie jest .select("*") bez .eq()
        // Query builder musi być thenable (Promise-like)
        // Tworzymy Promise i dodajemy metody query builder do niego
        const selectPromiseValue = {
          data: table === "trips" 
            ? (Array.isArray(mockData.trips) ? mockData.trips : (mockData.trip ? [mockData.trip] : []))
            : [],
          error: null
        };
        const selectPromise = Promise.resolve(selectPromiseValue);
        
        // Dodaj metody Promise do selectBuilder, aby był thenable
        selectBuilder.then = selectPromise.then.bind(selectPromise);
        selectBuilder.catch = selectPromise.catch.bind(selectPromise);
        selectBuilder.finally = selectPromise.finally.bind(selectPromise);
        // Ustaw Symbol.toStringTag aby był rozpoznawany jako Promise
        (selectBuilder as any)[Symbol.toStringTag] = 'Promise';
        
        return selectBuilder;
      }),
      insert: jest.fn(() => ({
        select: jest.fn(() =>
          Promise.resolve({ data: [{ id: "new-id" }], error: null })
        ),
      })),
      update: jest.fn(() => {
        const updateBuilder: any = {
          eq: jest.fn((column: string, value: any) => {
            const eqBuilder: any = {
              select: jest.fn(() => Promise.resolve({ data: mockData.updated || null, error: null })),
              single: jest.fn(() => Promise.resolve({ data: mockData.updated || null, error: null })),
            };
            // Obsługa bezpośredniego wykonania update (bez .select())
            eqBuilder.then = (resolve: any) => {
              return Promise.resolve({ data: mockData.updated || null, error: null }).then(resolve);
            };
            return eqBuilder;
          }),
        };
        return updateBuilder;
      }),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };
    
    return queryChain;
  };

  const mockClient = {
    from: jest.fn((table: string) => createQueryBuilder(table)),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: mockData.user || null },
          error: null,
        })
      ),
      getClaims: jest.fn(() =>
        Promise.resolve({
          data: mockData.user
            ? {
                claims: { sub: mockData.user.id },
              }
            : null,
          error: null,
        })
      ),
    },
    rpc: jest.fn((fnName: string, params: any) => {
      if (fnName === "reserve_trip_seats") {
        return Promise.resolve({ data: mockData.reservedTrip || { id: params.p_trip_id }, error: null });
      }
      if (fnName === "release_trip_seats") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fnName === "create_booking") {
        return Promise.resolve({
          data: mockData.booking ? { id: mockData.booking.id, booking_ref: mockData.booking.booking_ref } : { id: "booking-id", booking_ref: "BK-TEST-123" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };

  return mockClient as any;
}

/**
 * Mock Paynow client dla testów
 */
export function createMockPaynowClient(mockData: any = {}) {
  return {
    createPayment: jest.fn(() =>
      Promise.resolve({
        paymentId: mockData.paymentId || "PAYNOW-TEST-123",
        redirectUrl: mockData.redirectUrl || "https://paynow.pl/payment/123",
      })
    ),
    verifySignature: jest.fn(() => mockData.isValidSignature !== false),
  };
}

/**
 * Mock NextRequest dla testów API
 */
export function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return request;
}

/**
 * Mock fetch response
 */
export function createMockFetchResponse(data: any, status: number = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  } as Response);
}

/**
 * Mock email service (Resend)
 */
export function createMockEmailService() {
  return {
    sendEmail: jest.fn(() =>
      Promise.resolve({
        id: "email-id-123",
        from: "test@example.com",
        to: ["recipient@example.com"],
        subject: "Test Email",
      })
    ),
  };
}

/**
 * Helper do mockowania globalnego fetch
 */
export function mockGlobalFetch(mockResponse: any, status: number = 200) {
  (global.fetch as jest.Mock) = jest.fn(() =>
    Promise.resolve(createMockFetchResponse(mockResponse, status))
  );
}

/**
 * Helper do resetowania mocków
 */
export function resetMocks() {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockClear();
}
