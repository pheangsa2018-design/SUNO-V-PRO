import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global circular reference guard to prevent "Converting circular structure to JSON"
// when loggers, devtools, or platform wrappers inspect DOM nodes (e.g. HTMLAudioElement with React fiber)
try {
  if (typeof Node !== 'undefined' && Node.prototype && !(Node.prototype as any).toJSON) {
    Object.defineProperty(Node.prototype, 'toJSON', {
      value: function () {
        return {
          nodeType: this.nodeType,
          nodeName: this.nodeName,
          id: this.id || undefined,
          className: typeof this.className === 'string' ? this.className : undefined
        };
      },
      configurable: true,
      writable: true
    });
  }
  if (typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype && !(HTMLAudioElement.prototype as any).toJSON) {
    Object.defineProperty(HTMLAudioElement.prototype, 'toJSON', {
      value: function () {
        return {
          tagName: 'AUDIO',
          id: this.id || undefined,
          src: this.src || undefined,
          currentTime: this.currentTime || 0,
          duration: this.duration || 0,
          paused: this.paused !== false
        };
      },
      configurable: true,
      writable: true
    });
  }
  if (typeof Event !== 'undefined' && Event.prototype && !(Event.prototype as any).toJSON) {
    Object.defineProperty(Event.prototype, 'toJSON', {
      value: function () {
        return {
          type: this.type,
          defaultPrevented: this.defaultPrevented,
          timeStamp: this.timeStamp
        };
      },
      configurable: true,
      writable: true
    });
  }
} catch {}

const originalStringify = JSON.stringify;
JSON.stringify = function (value: any, replacer?: any, space?: any) {
  try {
    return originalStringify.call(this, value, replacer, space);
  } catch (err: any) {
    if (err && typeof err.message === 'string' && (err.message.includes('circular') || err.message.includes('cyclic'))) {
      const seen = new WeakSet();
      try {
        return originalStringify.call(
          this,
          value,
          (key: string, val: any) => {
            if (typeof val === 'object' && val !== null) {
              if (
                val instanceof Node ||
                val instanceof Window ||
                'nodeType' in val ||
                (val.constructor && (val.constructor.name === 'HTMLAudioElement' || val.constructor.name === 'FiberNode'))
              ) {
                return undefined;
              }
              if (seen.has(val)) {
                return undefined;
              }
              seen.add(val);
            }
            if (typeof replacer === 'function') {
              return replacer(key, val);
            }
            return val;
          },
          space
        );
      } catch {
        return 'null';
      }
    }
    throw err;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
