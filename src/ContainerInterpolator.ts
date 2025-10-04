import type { Container } from "pixi.js";


export interface ContainerInterpolatorOptions
{
  /**
   * Maximum interpolatable change in position x/y.
   *
   * @default 100
   */
  maxDeltaPosition?: number;

  /**
   * Maximum interpolatable change in scale.
   *
   * @default 1
   */
  maxDeltaScale?: number;

  /**
   * Maximum interpolatable change in rotation.
   *
   * @default Math.PI/2
   */
  maxDeltaRotation?: number;

  /**
   * Maximum interpolatable change in alpha.
   *
   * @default 0.5
   */
  maxDeltaAlpha?: number;

  /**
   * Initial number of containers to preallocate interpolation memory for.
   *
   * @default 256
   */
  capacity?: number;

  /**
   * Maximum number of containers to allocate interpolation memory for.
   *
   * @default 4096
   */
  maxCapacity?: number;
}

const BUFFERS = 2; // start, end
const PROPERTIES = 6; // x, y, scale.x, scale.y, rotation, alpha

export class ContainerInterpolator
{
  // state:
  private readonly _maxCapacity: number;
  private readonly _maxDeltaPosition: number;
  private readonly _maxDeltaScale: number;
  private readonly _maxDeltaRotation: number;
  private readonly _maxDeltaAlpha: number;

  // state:
  private _containers: Container[];
  private _capacity: number;
  private _count = 0;
  private _prevCount = 0;

  // buffers (struct of arrays):
  private _buffer: ArrayBuffer;
  private _startX: Float32Array;
  private _startY: Float32Array;
  private _startRotation: Float32Array;
  private _startScaleX: Float32Array;
  private _startScaleY: Float32Array;
  private _startAlpha: Float32Array;
  private _endX: Float32Array;
  private _endY: Float32Array;
  private _endRotation: Float32Array;
  private _endScaleX: Float32Array;
  private _endScaleY: Float32Array;
  private _endAlpha: Float32Array;

  public constructor({
    capacity          = 256,
    maxCapacity       = 4096,
    maxDeltaPosition  = 100,
    maxDeltaScale     = 1,
    maxDeltaRotation  = Math.PI/2,
    maxDeltaAlpha     = 1/2,
  }: ContainerInterpolatorOptions = {})
  {
    this._maxCapacity = maxCapacity;
    this._maxDeltaAlpha = maxDeltaAlpha;
    this._maxDeltaPosition = maxDeltaPosition;
    this._maxDeltaRotation = maxDeltaRotation;
    this._maxDeltaScale = maxDeltaScale;

    this._capacity = capacity;
    this._containers = new Array(this._capacity);

    const propertyBytes = this._capacity * Float32Array.BYTES_PER_ELEMENT;
    const totalBytes = propertyBytes * BUFFERS * PROPERTIES;

    this._buffer = new ArrayBuffer(totalBytes);

    let bufferIndex = 0;

    const allocate = (): Float32Array =>
    {
      const byteOffset = propertyBytes * bufferIndex++;

      return new Float32Array(this._buffer, byteOffset, this._capacity);
    };

    this._startX          = allocate();
    this._startY          = allocate();
    this._startRotation   = allocate();
    this._startScaleX     = allocate();
    this._startScaleY     = allocate();
    this._startAlpha      = allocate();
    this._endX            = allocate();
    this._endY            = allocate();
    this._endRotation     = allocate();
    this._endScaleX       = allocate();
    this._endScaleY       = allocate();
    this._endAlpha        = allocate();
  }

  // ----- Methods: -----

  /**
   * Capture the previous state for some tree of containers.
   *
   * Only containers captured here will be included.
   */
  public capture(target: Container): void
  {
    // refs
    const containers    = this._containers;
    const startX        = this._startX;
    const startY        = this._startY;
    const startRotation = this._startRotation;
    const startScaleX   = this._startScaleX;
    const startScaleY   = this._startScaleY;
    const startAlpha    = this._startAlpha;

    // reset counter
    this._count = 0;

    // capture containers subtree
    const captureContainers = (container: Container, depth: number): void =>
    {
      if (container.destroyed)
      {
        // skip container and children
        return;
      }

      const isInterpolated =
        container.isInterpolated ?? container.visible;

      const hasInterpolatedChildren =
        container.hasInterpolatedChildren ?? isInterpolated;

      if (isInterpolated)
      {
        // on first touch, set interpolation to true
        container.isInterpolated ??= true;

        // reserve a container index
        const i = this._count++;

        // auto-resize buffer
        if (i >= this._capacity)
        {
          if (this._capacity >= this._maxCapacity)
          {
            // ran out of allocations, end abruptly
            console.error("[ContainerInterpolator] exceeded buffer capacity:", i);

            return;
          }

          this._resizeCapacity(this._capacity * 2);
        }

        // save container ref
        containers[i] = container;

        // capture properties
        startX[i]        = container.position._x;
        startY[i]        = container.position._y;
        startScaleX[i]   = container.scale._x;
        startScaleY[i]   = container.scale._y;
        startRotation[i] = container.rotation;
        startAlpha[i]    = container.alpha;
      }

      if (hasInterpolatedChildren)
      {
        const children = container.children as Container[];

        for (let i = 0; i < children.length; i++)
        {
          captureContainers(children[i]!, depth + 1);
        }
      }
    };

    captureContainers(target, 0);

    // release tail pointers
    for (let j = this._count; j < this._prevCount; j++)
    {
      this._containers[j] = undefined;
    }

    // save for next run
    this._prevCount = this._count;
  }

  /**
   * Apply blended frame state between previous and current.
   *
   * @param t blended value clamped to (0, 1)
   */
  public blend(t: number): void
  {
    // clamp
    t = Math.min(1, Math.max(0, t));

    // refs:
    const maxDeltaPosition  = this._maxDeltaPosition;
    const maxDeltaScale     = this._maxDeltaScale;
    const maxDeltaAlpha     = this._maxDeltaAlpha;
    const maxDeltaRotation  = this._maxDeltaRotation;
    const containers        = this._containers;

    const startX          = this._startX;
    const startY          = this._startY;
    const startRotation   = this._startRotation;
    const startScaleX     = this._startScaleX;
    const startScaleY     = this._startScaleY;
    const startAlpha      = this._startAlpha;

    const endX        = this._endX;
    const endY        = this._endY;
    const endRotation = this._endRotation;
    const endScaleX   = this._endScaleX;
    const endScaleY   = this._endScaleY;
    const endAlpha    = this._endAlpha;

    let container: Container;
    let deltaX: number;
    let deltaY: number;
    let deltaRotation: number;
    let deltaScaleX: number;
    let deltaScaleY: number;
    let deltaAlpha: number;

    for (let i = 0; i < this._count; i++)
    {
      container = containers[i]!;

      if (container === undefined || container.destroyed)
      {
        // skip: bad reference
        continue;
      }

      // capture end values and calculate the total delta
      deltaX        = (endX[i] = container.position._x)     - startX[i]!;
      deltaY        = (endY[i] = container.position._y)     - startY[i]!;
      deltaScaleX   = (endScaleX[i] = container.scale._x)   - startScaleX[i]!;
      deltaScaleY   = (endScaleY[i] = container.scale._y)   - startScaleY[i]!;
      deltaRotation = (endRotation[i] = container.rotation) - startRotation[i]!;
      deltaAlpha    = (endAlpha[i] = container.alpha)       - startAlpha[i]!;

      // position
      if (
        (deltaX !== 0 || deltaY !== 0)
        && Math.abs(deltaX) <= maxDeltaPosition
        && Math.abs(deltaY) <= maxDeltaPosition
      )
      {
        container.position.set(startX[i]! + deltaX * t,
                               startY[i]! + deltaY * t);
      }

      // scale
      if (
        (deltaScaleX !== 0 || deltaScaleY !== 0)
        && Math.abs(deltaScaleX) <= maxDeltaScale
        && Math.abs(deltaScaleY) <= maxDeltaScale
      )
      {
        container.scale.set(startScaleX[i]! + deltaScaleX * t,
                            startScaleY[i]! + deltaScaleY * t);
      }

      if (deltaRotation !== 0 && Math.abs(deltaRotation) <= maxDeltaRotation)
      {
        container.rotation = startRotation[i]! + deltaRotation * t;
      }

      if (deltaAlpha !== 0 && Math.abs(deltaAlpha) <= maxDeltaAlpha)
      {
        container.alpha = startAlpha[i]! + deltaAlpha * t;
      }
    }
  }

  /**
   * Restore state to current values.
   */
  public unblend(): void
  {
    const containers  = this._containers;
    const endX        = this._endX;
    const endY        = this._endY;
    const endRotation = this._endRotation;
    const endScaleX   = this._endScaleX;
    const endScaleY   = this._endScaleY;
    const endAlpha    = this._endAlpha;

    let container: Container;
    let deltaX: number;
    let deltaY: number;
    let deltaRotation: number;
    let deltaScaleX: number;
    let deltaScaleY: number;
    let deltaAlpha: number;

    for (let i = 0; i < this._count; i++)
    {
      container = containers[i]!;

      if (container === undefined || container.destroyed)
      {
        continue; // skip: bad reference
      }

      // update transform for changed values
      deltaX        = container.position._x - endX[i]!;
      deltaY        = container.position._y - endY[i]!;
      deltaScaleX   = container.scale._x    - endScaleX[i]!;
      deltaScaleY   = container.scale._y    - endScaleY[i]!;
      deltaRotation = container.rotation    - endRotation[i]!;
      deltaAlpha    = container.alpha       - endAlpha[i]!;

      if (deltaX !== 0 || deltaY !== 0)
      {
        container.position.set(endX[i]!, endY[i]);
      }

      if (deltaScaleX !== 0 || deltaScaleY !== 0)
      {
        container.scale.set(endScaleX[i]!, endScaleY[i]!);
      }

      if (deltaRotation !== 0)
      {
        container.rotation = endRotation[i]!;
      }

      if (deltaAlpha !== 0)
      {
        container.alpha = endAlpha[i]!;
      }
    }
  }

  private _resizeCapacity(capacity: number): void
  {
    capacity = Math.min(capacity, this._maxCapacity);

    const propertyBytes = capacity * Float32Array.BYTES_PER_ELEMENT;
    const totalBytes = propertyBytes * BUFFERS * PROPERTIES;
    const buffer = new ArrayBuffer(totalBytes);

    let bufferIndex = 0;

    const allocateFrom = (previousArray: Float32Array): Float32Array =>
    {
      const byteOffset = propertyBytes * bufferIndex++;
      const array = new Float32Array(buffer, byteOffset, capacity);

      array.set(previousArray);

      return array;
    };

    this._startX          = allocateFrom(this._startX);
    this._startY          = allocateFrom(this._startY);
    this._startRotation   = allocateFrom(this._startRotation);
    this._startScaleX     = allocateFrom(this._startScaleX);
    this._startScaleY     = allocateFrom(this._startScaleY);
    this._startAlpha      = allocateFrom(this._startAlpha);
    this._endX            = allocateFrom(this._endX);
    this._endY            = allocateFrom(this._endY);
    this._endRotation     = allocateFrom(this._endRotation);
    this._endScaleX       = allocateFrom(this._endScaleX);
    this._endScaleY       = allocateFrom(this._endScaleY);
    this._endAlpha        = allocateFrom(this._endAlpha);

    this._buffer = buffer;
    this._capacity = capacity;
  }
}
