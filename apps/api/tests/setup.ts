import { jest, beforeAll, afterEach, afterAll } from '@jest/globals';

// Create a mock implementation of Storage
class MockStorage implements Storage {
  private store: Record<string, string> = {};
  [name: string]: any;
  
  get length(): number {
    return Object.keys(this.store).length;
  }
  
  clear(): void {
    this.store = {};
  }
  
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
  
  removeItem(key: string): void {
    delete this.store[key];
  }
  
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

// Create a mock implementation of fetch
const mockFetch = jest.fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>();

// Set up the mocks before any tests run
beforeAll(() => {
  // Mock localStorage
  const mockStorage = new MockStorage();
  
  // Add the mock implementations
  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
  
  // Mock fetch
  Object.defineProperty(global, 'fetch', {
    value: mockFetch,
    writable: true,
  });
  
  // Mock fetch to return a basic response by default
  mockFetch.mockImplementation((input, init) => {
    return Promise.resolve(new Response(JSON.stringify({}), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));
  });
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Clear localStorage
  if (global.localStorage) {
    (global.localStorage as unknown as MockStorage).clear();
  }
});

// Mock console methods to keep test output clean
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && !args[0].includes('Error: Could not parse CSS stylesheet')) {
      originalConsoleError(...args);
    }
  };
  
  console.warn = (...args) => {
    const suppressedWarnings = [
      'componentWillMount',
      'componentWillReceiveProps',
      'UNSAFE_',
    ];
    if (!suppressedWarnings.some(entry => 
      typeof args[0] === 'string' && args[0].includes(entry)
    )) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
