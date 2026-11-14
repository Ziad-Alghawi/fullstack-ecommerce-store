import '@testing-library/jest-dom';

// jsdom doesn't scroll, and says so on every call. Config tests run in Node, without a window
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
