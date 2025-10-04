type Listener<M extends Record<string, unknown[]>, K extends keyof M> =
  (...args: [...M[K]]) => void;

export class Emits<M extends Record<string, any[]>>
{
  protected _listeners: { [K in keyof M]?: Listener<M, K>[] } = {};

  public on<K extends keyof M>(key: K, fn: Listener<M, K>): this
  {
    (this._listeners[key] ??= []).push(fn);
    return this;
  }

  public off<K extends keyof M>(key: K, fn: Listener<M, K>): this
  {
    this._listeners[key] = (this._listeners[key] ??= []).filter(l => l !== fn);
    return this;
  }

  public emit<K extends keyof M>(key: K, ...args: M[K]): void
  {
    for (const fn of (this._listeners[key] ??= [])) fn(...args);
  }
}
