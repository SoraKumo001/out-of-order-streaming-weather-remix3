import { type Handle, type RemixNode } from "@remix-run/ui";

const isServer = typeof window === "undefined";
const SSR_DATA_NAME = "__REMIX3_SSR__";
const SSR_DATA_GLOBAL_NAME = "__REMIX3_SSR_DATA__";

type SSRResult<T = unknown> = {
  state: "idle" | "loading" | "finished";
  value?: T;
};

type SSRState<T = unknown> = SSRResult<T> & {
  children: RemixNode;
  id: string;
  promise: Promise<T>;
};

export type SSRProps = {
  states: Record<string, SSRState>;
  nextId: number;
};

export function SSRProvider(handle: Handle<{ storage?: SSRProps; children: RemixNode }, SSRProps>) {
  return ({
    storage,
    children,
  }: {
    storage?: SSRProps;
    children: RemixNode;
  }) => {
    if (isServer) {
      handle.context.set(
        storage ?? {
          states: {},
          nextId: 0,
        }
      );
    } else {
      const globalData = (globalThis as Record<string, unknown>)[
        SSR_DATA_GLOBAL_NAME
      ];
      const node = document.getElementById(SSR_DATA_NAME);
      const states = JSON.parse(
        typeof globalData === "string" ? globalData : node?.innerText ?? "{}"
      );
      handle.context.set(
        storage ?? {
          nextId: 0,
          states: Object.fromEntries(
            Object.entries(states).map(([key, v]) => [
              key,
              {
                id: key,
                state: "finished",
                promise: Promise.resolve(v),
                value: v as any,
                children: undefined,
              },
            ])
          ),
        }
      );
    }
    return (
      <>
        {children}
      </>
    );
  };
}

export function SSRData(handle: Handle<{ value: unknown; state: "idle" | "loading" | "finished"; children: RemixNode }, SSRResult>) {
  return ({
    value,
    state,
    children,
  }: {
    value: unknown;
    state: "idle" | "loading" | "finished";
    children: RemixNode;
  }) => {
    handle.context.set({ value, state });
    return children;
  };
}

export function SSRFetch<T>(handle: Handle) {
  return ({
    name,
    action,
    children,
  }: {
    name: string;
    action: () => Promise<T>;
    children: RemixNode;
  }) => {
    const context = handle.context.get(SSRProvider);
    if (!context) return undefined;
    const frameName = `ssr:${name}`;
    if (!context.states[frameName]) {
      const promise = action();
      const state: SSRState<T> = {
        id: `ssr-${context.nextId++}`,
        promise,
        state: "loading",
        value: undefined,
        children,
      };
      context.states[frameName] = state;
      promise.then((v) => {
        context.states[frameName].state = "finished";
        context.states[frameName].value = v;
        if (!isServer) handle.update();
      });
    }
    if (isServer) {
      const state = context.states[frameName];
      return (
        <div
          data-ssr-frame={state.id}
          innerHTML={`<?start name="${state.id}"><div>Loading...</div><?end>`}
        />
      );
    } else {
      const state = context.states[frameName];
      return (
        <SSRData value={state.value} state={state.state}>
          {children}
        </SSRData>
      );
    }
  };
}

export const useSSR = <T,>(inst: Handle) => {
  return inst.context.get(SSRData) as SSRResult<T>;
};

export const resolveFrame = async (
  src: string,
  states: Record<string, SSRState>,
  render: (node: RemixNode) => Promise<string> | string
): Promise<string> => {
  if (src === "ssr-data:") {
    let length = 0;
    while (length !== Object.values(states).length) {
      await Promise.all(Object.values(states).map((v) => v.promise));
      length = Object.values(states).length;
    }
    const values: Record<string, unknown> = {};
    for (const [key, p] of Object.entries(states)) {
      values[key] = await p.promise;
    }
    const serializedData = JSON.stringify(values).replace(/</g, "\\u003c");
    return `<script type="application/json" id="${SSR_DATA_NAME}">${serializedData}</script>`;
  }
  const state = states[src];
  const children = state.children;
  const value = await state.promise;
  state.value = value;
  return render(
    <SSRData value={value} state={state.state}>
      {children}
    </SSRData>
  );
};
