// fake-indexeddb gives the tests a real IndexedDB implementation in Node, so
// migration behaviour is exercised against the same API the browser uses
// rather than a hand-written mock.
import 'fake-indexeddb/auto';
