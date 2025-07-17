// Setup for React Testing Library
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  hostname: 'localhost',
  search: '',
  pathname: '/',
  reload: jest.fn(),
};

// Mock Shopify App Bridge
jest.mock('@shopify/app-bridge', () => ({
  createApp: jest.fn(() => ({
    dispatch: jest.fn(),
    subscribe: jest.fn(),
  })),
}));

jest.mock('@shopify/app-bridge/actions', () => ({
  Redirect: {
    create: jest.fn(() => ({
      dispatch: jest.fn(),
    })),
  },
}));

// Global test timeout
jest.setTimeout(10000);