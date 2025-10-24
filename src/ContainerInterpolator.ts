import type { Container } from "pixi.js";


interface PixiCompatibilityContainer
{
  /**
   * @internal
   */
  culled?: boolean | undefined;
}

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

const BUFFERS     = 2; // start, end
const PROPERTIES  = 6; // position.{x,y}, scale.{x,y}, rotation, alpha
const BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

/**
 * Utility that captures a tree of containers,
 * and then allows you to blend/unblend the state.
 *
 * @example
 * // adapted from https://gafferongames.com/post/fix_your_timestep/
 * const tickMs = 1_000 / 60;
 * function tick( tickMs ) {} // do world updates here
 *
 * let accumulatorMs = 0.0;
 * let then = performance.now();
 *
 * // start
 * requestAnimationFrame( frameHandler );
 *
 * function frameHandler( now )
 * {
 *     requestAnimationFrame( frameHandler ); // schedule immediately
 *
 *     accumulatorMs += Math.min( now - then, 40.0 );
 *     then = now;
 *
 *     while ( accumulatorMs >= tickMs )
 *     {
 *         // capture containers "previous" state
 *         containerInterpolator.capture( pixiApp.stage );
 *
 *         tick( tickMs );
 *         accumulatorMs -= tickMs;
 *     }
 *
 *     // apply blended container state
 *     containerInterpolator.blend( accumulatorMs / tickMs );
 *
 *     pixiApp.renderer.render( pixiApp.stage );
 *
 *     // clear container interpolation
 *     containerInterpolator.unblend();
 * }
 */
export class ContainerInterpolator
{
  // ----- Settings: -----
  /** @internal */ private readonly _$maxCapacity: number;
  /** @internal */ private readonly _$maxDeltaPosition: number;
  /** @internal */ private readonly _$maxDeltaScale: number;
  /** @internal */ private readonly _$maxDeltaRotation: number;
  /** @internal */ private readonly _$maxDeltaAlpha: number;

  // ----- Container state: -----
  /** @internal */ private _$containers: Container[];
  /** @internal */ private _$capacity: number;
  /** @internal */ private _$count = 0;
  /** @internal */ private _$prevCount = 0;

  // ----- Struct-of-arrays (SoA): -----
  /** @internal */ private _$startPositionX: Float32Array;
  /** @internal */ private _$startPositionY: Float32Array;
  /** @internal */ private _$startRotation: Float32Array;
  /** @internal */ private _$startScaleX: Float32Array;
  /** @internal */ private _$startScaleY: Float32Array;
  /** @internal */ private _$startAlpha: Float32Array;
  /** @internal */ private _$endX: Float32Array;
  /** @internal */ private _$endY: Float32Array;
  /** @internal */ private _$endRotation: Float32Array;
  /** @internal */ private _$endScaleX: Float32Array;
  /** @internal */ private _$endScaleY: Float32Array;
  /** @internal */ private _$endAlpha: Float32Array;

  public constructor(cfg: ContainerInterpolatorOptions = {})
  {
    const maxCapacity = cfg.maxCapacity ?? 4096;
    const capacity = Math.min(cfg.capacity ?? 256, maxCapacity);

    // setup buffers
    const propertyBytes = capacity * BYTES_PER_ELEMENT;
    const totalBytes = propertyBytes * BUFFERS * PROPERTIES;

    const buffer = new ArrayBuffer(totalBytes);

    let bufferIndex = 0;

    const _$alloc = (): Float32Array =>
    {
      const byteOffset = propertyBytes * bufferIndex++;

      return new Float32Array(buffer, byteOffset, capacity);
    };

    this._$maxCapacity      = maxCapacity;
    this._$maxDeltaAlpha    = cfg.maxDeltaAlpha    ?? 0.5;
    this._$maxDeltaPosition = cfg.maxDeltaPosition ?? 100;
    this._$maxDeltaRotation = cfg.maxDeltaRotation ?? Math.PI / 2;
    this._$maxDeltaScale    = cfg.maxDeltaScale    ?? 1.0;

    this._$containers     = new Array(capacity);
    this._$capacity       = capacity;

    this._$startPositionX = _$alloc();
    this._$startPositionY = _$alloc();
    this._$startRotation  = _$alloc();
    this._$startScaleX    = _$alloc();
    this._$startScaleY    = _$alloc();
    this._$startAlpha     = _$alloc();
    this._$endX           = _$alloc();
    this._$endY           = _$alloc();
    this._$endRotation    = _$alloc();
    this._$endScaleX      = _$alloc();
    this._$endScaleY      = _$alloc();
    this._$endAlpha       = _$alloc();
  }

  // ----- Methods: -----

  /**
   * Declares the previous state of containers. Only containers
   * captured here will be interpolated.
   *
   * This should be called before each `update()`.
   */
  public capture(target: Container): void
  {
    // refs
    const containers      = this._$containers;
    const startPositionX  = this._$startPositionX;
    const startPositionY  = this._$startPositionY;
    const startRotation   = this._$startRotation;
    const startScaleX     = this._$startScaleX;
    const startScaleY     = this._$startScaleY;
    const startAlpha      = this._$startAlpha;

    // reset counter
    this._$count = 0;

    // capture containers subtree
    const captureContainers = (container: Container, depth: number): void =>
    {
      if (container.destroyed)
      {
        // skip container and children
        return;
      }

      const isInterpolated =
        container.isInterpolated ?? (
          container.visible && !(container as PixiCompatibilityContainer).culled
        );

      const hasInterpolatedChildren =
        container.hasInterpolatedChildren ?? isInterpolated;

      if (isInterpolated)
      {
        // on first touch, set interpolation to true
        container.isInterpolated ??= true;

        // reserve a container index
        const i = this._$count++;

        // auto-resize buffer
        if (i >= this._$capacity)
        {
          if (this._$capacity >= this._$maxCapacity)
          {
            // ran out of allocations, end abruptly
            console.error("[ContainerInterpolator] exceeded buffer capacity:", i);

            return;
          }

          this._$resize(this._$capacity * 2);
        }

        // save container ref
        containers[i] = container;

        // capture properties
        startPositionX[i] = container.position._x;
        startPositionY[i] = container.position._y;
        startScaleX[i]    = container.scale._x;
        startScaleY[i]    = container.scale._y;
        startRotation[i]  = container.rotation;
        startAlpha[i]     = container.alpha;
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
    for (let j = this._$count; j < this._$prevCount; j++)
    {
      this._$containers[j] = undefined;
    }

    // save for next run
    this._$prevCount = this._$count;
  }

  /**
   * Set containers state to a blend between previous captured
   * state and the current state.
   *
   * This should be called before each `render()`.
   *
   * @param t blended value clamped to (0, 1)/
   */
  public blend(t: number): void
  {
    // clamp
    t = Math.min(1, Math.max(0, t));

    // refs:
    const maxDeltaPosition  = this._$maxDeltaPosition;
    const maxDeltaScale     = this._$maxDeltaScale;
    const maxDeltaAlpha     = this._$maxDeltaAlpha;
    const maxDeltaRotation  = this._$maxDeltaRotation;
    const containers        = this._$containers;

    const startPositionX  = this._$startPositionX;
    const startPositionY  = this._$startPositionY;
    const startRotation   = this._$startRotation;
    const startScaleX     = this._$startScaleX;
    const startScaleY     = this._$startScaleY;
    const startAlpha      = this._$startAlpha;

    const endX        = this._$endX;
    const endY        = this._$endY;
    const endRotation = this._$endRotation;
    const endScaleX   = this._$endScaleX;
    const endScaleY   = this._$endScaleY;
    const endAlpha    = this._$endAlpha;

    let container: Container;
    let deltaPositionX: number;
    let deltaPositionY: number;
    let deltaRotation: number;
    let deltaScaleX: number;
    let deltaScaleY: number;
    let deltaAlpha: number;

    for (let i = 0; i < this._$count; i++)
    {
      container = containers[i]!;

      if (container === undefined || container.destroyed)
      {
        // skip: bad reference
        continue;
      }

      // capture end values and calculate the total delta
      deltaPositionX  = (endX[i] = container.position._x)     - startPositionX[i]!;
      deltaPositionY  = (endY[i] = container.position._y)     - startPositionY[i]!;
      deltaScaleX     = (endScaleX[i] = container.scale._x)   - startScaleX[i]!;
      deltaScaleY     = (endScaleY[i] = container.scale._y)   - startScaleY[i]!;
      deltaRotation   = (endRotation[i] = container.rotation) - startRotation[i]!;
      deltaAlpha      = (endAlpha[i] = container.alpha)       - startAlpha[i]!;

      if (
        Math.abs(deltaPositionX) <= maxDeltaPosition
        && Math.abs(deltaPositionY) <= maxDeltaPosition
      )
      {
        container.position.set(startPositionX[i]! + deltaPositionX * t,
                               startPositionY[i]! + deltaPositionY * t);
      }

      if (
        Math.abs(deltaScaleX) <= maxDeltaScale
        && Math.abs(deltaScaleY) <= maxDeltaScale
      )
      {
        container.scale.set(startScaleX[i]! + deltaScaleX * t,
                            startScaleY[i]! + deltaScaleY * t);
      }

      // rotation
      if (
        Math.abs(deltaRotation) <= maxDeltaRotation
      )
      {
        container.rotation = startRotation[i]! + deltaRotation * t;
      }

      // alpha
      if (
        Math.abs(deltaAlpha) <= maxDeltaAlpha
      )
      {
        container.alpha = startAlpha[i]! + deltaAlpha * t;
      }
    }
  }

  /**
   * Restore containers to current true values.
   *
   * This should be called after each `render()`.
   */
  public unblend(): void
  {
    // refs:
    const containers    = this._$containers;
    const endPositionX  = this._$endX;
    const endPositionY  = this._$endY;
    const endRotation   = this._$endRotation;
    const endScaleX     = this._$endScaleX;
    const endScaleY     = this._$endScaleY;
    const endAlpha      = this._$endAlpha;

    let container: Container;

    for (let i = 0; i < this._$count; i++)
    {
      container = containers[i]!;

      if (container === undefined || container.destroyed)
      {
        continue; // skip: bad reference
      }

      // update transform for changed values
      container.position.set(endPositionX[i]!, endPositionY[i]!);
      container.scale.set(endScaleX[i]!, endScaleY[i]!);
      container.rotation = endRotation[i]!;
      container.alpha = endAlpha[i]!;
    }
  }

  // ----- Internal methods: -----

  /**
   * @internal
   */
  private _$resize(capacity: number): void
  {
    capacity = Math.min(capacity, this._$maxCapacity);

    const propertyBytes = capacity * BYTES_PER_ELEMENT;
    const totalBytes = propertyBytes * BUFFERS * PROPERTIES;
    const buffer = new ArrayBuffer(totalBytes);

    let bufferIndex = 0;

    const _$allocCopy = (previousArray: Float32Array): Float32Array =>
    {
      const byteOffset = propertyBytes * bufferIndex++;
      const array = new Float32Array(buffer, byteOffset, capacity);

      array.set(previousArray);

      return array;
    };

    this._$capacity       = capacity;
    this._$startPositionX = _$allocCopy(this._$startPositionX);
    this._$startPositionY = _$allocCopy(this._$startPositionY);
    this._$startRotation  = _$allocCopy(this._$startRotation);
    this._$startScaleX    = _$allocCopy(this._$startScaleX);
    this._$startScaleY    = _$allocCopy(this._$startScaleY);
    this._$startAlpha     = _$allocCopy(this._$startAlpha);
    this._$endX           = _$allocCopy(this._$endX);
    this._$endY           = _$allocCopy(this._$endY);
    this._$endRotation    = _$allocCopy(this._$endRotation);
    this._$endScaleX      = _$allocCopy(this._$endScaleX);
    this._$endScaleY      = _$allocCopy(this._$endScaleY);
    this._$endAlpha       = _$allocCopy(this._$endAlpha);
  }
}
