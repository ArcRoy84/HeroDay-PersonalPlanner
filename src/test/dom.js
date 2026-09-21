// Minimal DOM driver for component tests.
//
// A hand-rolled version of the few helpers this project needs, rather than a
// testing library dependency: mount, click, type, and wait for async state.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Tells React that state updates in this environment are wrapped in act().
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted = [];

/** Renders `element` into a fresh container attached to the document. */
export async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  mounted.push({ root, container });
  return container;
}

/** Unmounts everything mounted so far. Call from afterEach. */
export async function unmountAll() {
  while (mounted.length) {
    const { root, container } = mounted.pop();
    await act(async () => { root.unmount(); });
    container.remove();
  }
}

export async function click(element) {
  if (!element) throw new Error('click(): element not found');
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

/**
 * Sets a controlled input's value the way a user typing would. React tracks the
 * last value it rendered, so assigning `element.value` directly is swallowed;
 * going through the native setter and dispatching an event is not.
 */
export async function type(element, value) {
  if (!element) throw new Error('type(): element not found');
  const proto = {
    TEXTAREA: HTMLTextAreaElement.prototype,
    SELECT: HTMLSelectElement.prototype,
  }[element.tagName] ?? HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

/** Submits the form containing `element`. */
export async function submit(form) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/**
 * Polls until `check()` returns something truthy, letting IndexedDB and React
 * settle between attempts. Throws with `message` if it never does.
 */
export async function waitFor(check, message = 'condition', timeout = 3000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
  }
  throw new Error(`Timed out waiting for ${message}${lastError ? ` (${lastError.message})` : ''}`);
}

/**
 * Like `waitFor`, for a check that is itself async — typically a database read.
 * (Passing an async function to `waitFor` would be truthy immediately, because a
 * Promise is truthy, and so would never actually wait.)
 */
export async function waitForAsync(check, message = 'condition', timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
  }
  throw new Error(`Timed out waiting for ${message}`);
}

/** First element of `selector` whose text includes `text`. */
export function byText(root, selector, text) {
  return [...root.querySelectorAll(selector)].find(el => el.textContent.includes(text)) ?? null;
}
