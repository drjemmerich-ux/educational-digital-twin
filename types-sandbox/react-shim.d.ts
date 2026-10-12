// Minimal React type shim used ONLY for offline type-checking in environments without
// @types/react (see tsconfig.sandbox.json). A normal install uses the real @types/react.
declare module 'react' {
  export type ReactNode = string | number | boolean | null | undefined | ReactElement | ReactNode[];
  export interface ReactElement {
    type: unknown;
    props: unknown;
    key: string | null;
  }
  export type CSSProperties = Record<string, string | number | undefined>;
  export interface SyntheticEvent<T = Element> {
    target: EventTarget & T;
    currentTarget: EventTarget & T;
    preventDefault(): void;
    stopPropagation(): void;
  }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }
  export interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => ReactElement;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function useState<S>(initial: S | (() => S)): [S, (v: S | ((prev: S) => S)) => void];
  export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function useRef<T>(initial: T | null): { current: T | null };
  export function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;
  export const Fragment: (props: { children?: ReactNode }) => ReactElement;
  export const StrictMode: (props: { children?: ReactNode }) => ReactElement;
}

interface ShimEvent {
  target: any;
  currentTarget: any;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  clientX: number;
  clientY: number;
  pointerId: number;
  preventDefault(): void;
  stopPropagation(): void;
}
interface ShimDomProps {
  onChange?: (e: ShimEvent) => void;
  onClick?: (e: ShimEvent) => void;
  onKeyDown?: (e: ShimEvent) => void;
  onMouseDown?: (e: ShimEvent) => void;
  onPointerDown?: (e: ShimEvent) => void;
  onPointerMove?: (e: ShimEvent) => void;
  onPointerUp?: (e: ShimEvent) => void;
  onError?: (e: ShimEvent) => void;
  [prop: string]: any;
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
  export namespace JSX {
    type Element = import('react').ReactElement;
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
    interface IntrinsicElements {
      [name: string]: ShimDomProps;
    }
  }
}

declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: unknown): void };
}

declare namespace JSX {
  type Element = import('react').ReactElement;
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicAttributes {
    key?: string | number | null;
  }
  interface IntrinsicElements {
    [name: string]: { [prop: string]: any };
  }
}
