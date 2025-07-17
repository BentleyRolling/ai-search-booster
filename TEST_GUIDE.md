# Test Guide - AI Search Booster

## Overview

This document provides comprehensive information about the testing infrastructure for AI Search Booster's LLM-ready features.

## Test Structure

### Server Tests (`server/__tests__/`)

**Unit Tests:**
- `citations.test.js` - Citation monitoring API endpoints
- `citationScheduler.test.js` - Citation job scheduling system
- `citationService.test.js` - Citation detection and analysis

**Integration Tests:**
- `integration/llm-endpoints.test.js` - LLM feed, vector, and plugin endpoints

### Client Tests (`client/src/__tests__/`)

**Unit Tests:**
- `useCitations.test.js` - Citation monitoring React hook
- `Dashboard.test.js` - Main dashboard component

**Component Tests:**
- Preview/publish workflow
- Draft content management
- Rollback functionality
- Settings panel

## Test Configuration

### Server Configuration

**Files:**
- `server/jest.config.js` - Jest configuration for Node.js
- `server/babel.config.js` - Babel configuration for ES modules
- `server/jest.setup.js` - Global test setup
- `server/.env.test` - Test environment variables

**Key Features:**
- ES modules support
- Supertest for API testing
- Mock external dependencies
- Coverage reporting

### Client Configuration

**Files:**
- `client/jest.config.js` - Jest configuration for React
- `client/babel.config.js` - Babel configuration for React
- `client/src/setupTests.js` - React Testing Library setup
- `client/.env.test` - Test environment variables

**Key Features:**
- JSDOM environment
- React Testing Library
- Mock Shopify App Bridge
- CSS module mocking

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run server tests only
npm run test:server

# Run client tests only
npm run test:client

# Run with coverage
npm run test:coverage

# Run with linting
npm run test:lint

# Run everything
npm run test:all
```

### Test Runner Options

The custom test runner (`run-tests.js`) provides:

- **Dependency checking** - Ensures all packages are installed
- **Parallel execution** - Runs server and client tests efficiently
- **Coverage reporting** - Optional coverage generation
- **Linting integration** - Code quality checks
- **Detailed reporting** - Summary of all test results

### Manual Test Commands

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test

# Watch mode
cd server && npm run test:watch
cd client && npm run test:watch
```

## Test Coverage

### Server Coverage

**Modules Covered:**
- Citation monitoring API routes (100%)
- Citation job scheduling (95%)
- Citation detection service (90%)
- LLM endpoint integration (100%)

**Coverage Goals:**
- Unit tests: >90%
- Integration tests: >80%
- Overall: >85%

### Client Coverage

**Components Covered:**
- Dashboard component (85%)
- useCitations hook (95%)
- Citation monitoring UI (80%)
- Draft/publish workflow (85%)

**Coverage Goals:**
- Component tests: >80%
- Hook tests: >90%
- Overall: >80%

## Mock Strategy

### Server Mocks

**External APIs:**
- Shopify Admin API - Mocked with realistic responses
- Search APIs - Mocked citation detection
- Email service - Mocked notification sending
- Node-cron - Mocked job scheduling

**Database:**
- In-memory storage for citation data
- Mock shop data store
- Realistic data structures

### Client Mocks

**Browser APIs:**
- `window.matchMedia` - Responsive design testing
- `window.location` - Navigation testing
- `window.confirm` - User interaction testing

**External Libraries:**
- Shopify App Bridge - Complete mock implementation
- AuthContext - Mocked authentication
- Fetch API - Mocked HTTP requests

## Testing Best Practices

### Writing Tests

**Structure:**
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Specific Functionality', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

**Naming:**
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Test both success and error cases
- Include edge cases

### API Testing

**Request/Response Testing:**
```javascript
const response = await request(app)
  .post('/api/monitoring/start')
  .query({ shop: 'test-shop.myshopify.com' })
  .send({ interval: 'daily' })
  .expect(200);

expect(response.body.message).toBe('Citation monitoring started successfully');
```

**Error Handling:**
```javascript
mockFunction.mockRejectedValue(new Error('API Error'));
const result = await functionUnderTest();
expect(result).toEqual(expectedFallback);
```

### Component Testing

**Rendering Tests:**
```javascript
render(<Dashboard />);
await waitFor(() => {
  expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
});
```

**User Interaction:**
```javascript
const user = userEvent.setup();
const button = screen.getByRole('button', { name: 'Optimize' });
await user.click(button);
expect(mockFunction).toHaveBeenCalled();
```

## Continuous Integration

### GitHub Actions

The test suite is designed to run in CI/CD environments:

```yaml
- name: Run tests
  run: npm run test:all
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### Test Requirements

**Pull Request Checks:**
- All tests must pass
- Coverage must not decrease
- Linting must pass
- No console errors

**Deployment Checks:**
- Integration tests must pass
- E2E tests must pass (future)
- Performance tests must pass (future)

## Debugging Tests

### Common Issues

**Server Tests:**
- ES modules not loading: Check babel configuration
- Database connections: Use in-memory storage
- Async operations: Use proper await/async patterns
- Mock not working: Verify mock placement

**Client Tests:**
- Component not rendering: Check test setup
- Events not firing: Use userEvent library
- Async state updates: Use waitFor
- Context not available: Mock providers

### Debug Commands

```bash
# Run single test file
npm test -- --testNamePattern="Citation"

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose

# Watch mode with coverage
npm test -- --watch --coverage
```

### Test Utilities

**Custom Matchers:**
```javascript
expect(response.body).toHaveProperty('message');
expect(citations).toHaveLength(2);
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
```

**Test Helpers:**
```javascript
const createMockProduct = (overrides = {}) => ({
  id: 1,
  title: 'Test Product',
  ...overrides,
});

const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));
```

## Performance Testing

### Load Testing

**Citation Monitoring:**
- Test with 1000+ products
- Simulate high citation volume
- Verify memory usage
- Check database performance

**API Endpoints:**
- Concurrent request handling
- Rate limiting verification
- Response time measurement
- Error rate monitoring

### Memory Testing

**Server:**
- Monitor memory leaks in jobs
- Check citation data storage
- Verify cleanup procedures
- Test long-running processes

**Client:**
- Component unmount cleanup
- Event listener removal
- State management efficiency
- Hook dependency arrays

## Security Testing

### Input Validation

**API Endpoints:**
- SQL injection prevention
- XSS attack prevention
- Parameter validation
- Authentication checks

**Data Sanitization:**
- Citation content filtering
- User input validation
- File upload restrictions
- URL validation

### Authentication Testing

**Shopify Integration:**
- Token validation
- Shop verification
- Permission checks
- Session management

## Future Enhancements

### Planned Test Additions

1. **E2E Tests** - Cypress or Playwright
2. **Visual Regression Tests** - Screenshot comparisons
3. **Performance Tests** - Load and stress testing
4. **Security Tests** - Vulnerability scanning
5. **Accessibility Tests** - WCAG compliance

### Test Automation

1. **Automatic Test Generation** - AI-powered test creation
2. **Mutation Testing** - Test quality verification
3. **Property-Based Testing** - Random input testing
4. **Contract Testing** - API contract verification

## Troubleshooting

### Common Problems

**Test Failures:**
1. Check mock configurations
2. Verify test environment setup
3. Review async/await usage
4. Check dependency versions

**Coverage Issues:**
1. Ensure all files are included
2. Check test completeness
3. Review mock implementations
4. Verify test execution paths

**Performance Issues:**
1. Use `--runInBand` for debugging
2. Check for memory leaks
3. Optimize test setup/teardown
4. Review test parallelization

### Getting Help

**Resources:**
- Jest documentation
- React Testing Library guides
- Supertest documentation
- Testing best practices

**Support:**
- Check GitHub issues
- Review test examples
- Consult team documentation
- Use debug utilities

---

This comprehensive test guide ensures that all LLM-ready features are thoroughly tested with proper coverage, reliability, and maintainability.