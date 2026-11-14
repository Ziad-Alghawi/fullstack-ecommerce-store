import '@testing-library/jest-dom';

// jsdom doesn't scroll or know the system's theme. Config tests run in Node, without a window
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  });
}
