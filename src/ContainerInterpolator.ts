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
   * Maximum interpolatable change in skew.
   *
   * @default Math.PI/2
   */
  maxDeltaSkew?: number;

  /**
   * Initial container memory capacity.
   *
   * Once reached, the memory buffers double in size until they
   * reach `maxCapacity`.
   *
   * @default 256
   */
  capacity?: number;

  /**
   * Maximum containers that can be interpolated.
   *
   * @default 4096
   */
  maxCapacity?: number;
}

/**
 * - position.x
 * - position.y
 * - scale.x
 * - scale.y
 * - skew.x
 * - skew.y
 * - rotation
 */
const ELEMENTS = 7;

/**
 * Float32Array.BYTES_PER_ELEMENT
 */
const BYTES_PER_ELEMENT = 4;

const DEFAULT_MAX_TRANSLATE_DELTA = 100;
const DEFAULT_MAX_SCALE_DELTA = 1;
const DEFAULT_MAX_SKEW_DELTA = Math.PI/2;
const DEFAULT_MAX_ROTATE_DELTA = Math.PI/2;
const DEFAULT_INITIAL_CAPACITY = 256;
const DEFAULT_MAX_CAPACITY = 4096;

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
  /**
   * Declares the previous state of containers. Only containers
   * captured here will be interpolated.
   *
   * This should be called before each `update()`.
   */
  public readonly capture: (target: Container) => void;

  /**
   * Set containers state to a linearly interpolated value between
   * previous captured state (`0`) and the current state (`1`).
   *
   * This should be called before each `render()`.
   *
   * @param t blend value clamped to (0, 1)
   */
  public readonly blend: (t: number) => void;

  /**
   * Restore containers to current true values.
   *
   * This should be called after each `render()`.
   */
  public readonly unblend: () => void;

  // ----- Properties: -----
  private _$exhaustedCapacity = false;

  // ----- Methods: -----
  public constructor(cfg: ContainerInterpolatorOptions = {})
  {
    const maxTranslateDelta = cfg.maxDeltaPosition ?? DEFAULT_MAX_TRANSLATE_DELTA;
    const maxScaleDelta = cfg.maxDeltaScale ?? DEFAULT_MAX_SCALE_DELTA;
    const maxSkewDelta = cfg.maxDeltaSkew ?? DEFAULT_MAX_SKEW_DELTA;
    const maxRotateDelta = cfg.maxDeltaRotation ?? DEFAULT_MAX_ROTATE_DELTA;
    const maxCapacity = cfg.maxCapacity ?? DEFAULT_MAX_CAPACITY;

    let capacity = Math.min(cfg.capacity ?? DEFAULT_INITIAL_CAPACITY, maxCapacity);

    // setup buffers
    const propertyBytes = capacity * BYTES_PER_ELEMENT;
    const totalBytes = propertyBytes * ELEMENTS * 2;
    const buffer = new ArrayBuffer(totalBytes);

    let bufferIndex = 0;

    const _$alloc = (): Float32Array =>
    {
      const byteOffset = propertyBytes * bufferIndex++;

      return new Float32Array(buffer, byteOffset, capacity);
    };

    // refs:
    let containers = new Array(capacity),
      count = 0,
      prevCount = 0,
      // position.x
      x0 = _$alloc(),
      x1 = _$alloc(),
      // position.y
      y0 = _$alloc(),
      y1 = _$alloc(),
      // scale.x
      xScale0 = _$alloc(),
      xScale1 = _$alloc(),
      // scale.y
      yScale0 = _$alloc(),
      yScale1 = _$alloc(),
      // skew.x
      xSkew0 = _$alloc(),
      xSkew1 = _$alloc(),
      // skew.y
      ySkew0 = _$alloc(),
      ySkew1 = _$alloc(),
      // rotation
      r0 = _$alloc(),
      r1 = _$alloc();

    const _$resizeBuffer = (newCapacity: number): void =>
    {
      newCapacity = Math.min(newCapacity, maxCapacity);

      const propertyBytes = newCapacity * BYTES_PER_ELEMENT;
      const totalBytes = propertyBytes * ELEMENTS * 2;
      const buffer = new ArrayBuffer(totalBytes);

      let bufferIndex = 0;

      const _$allocCopy = (previousView: Float32Array): Float32Array =>
      {
        const byteOffset = propertyBytes * bufferIndex++;
        const array = new Float32Array(buffer, byteOffset, newCapacity);

        array.set(previousView);

        return array;
      };

      // update state
      capacity = newCapacity;
      // position.x
      x0 = _$allocCopy(x0);
      x1 = _$allocCopy(x1);
      // position.y
      y0 = _$allocCopy(y0);
      y1 = _$allocCopy(y1);
      // scale.x
      xScale0 = _$allocCopy(xScale0);
      xScale1 = _$allocCopy(xScale1);
      // scale.y
      yScale0 = _$allocCopy(yScale0);
      yScale1 = _$allocCopy(yScale1);
      // skew.x
      xSkew0 = _$allocCopy(xSkew0);
      xSkew1 = _$allocCopy(xSkew1);
      // skew.y
      ySkew0 = _$allocCopy(ySkew0);
      ySkew1 = _$allocCopy(ySkew1);
      // rotation
      r0 = _$allocCopy(r0);
      r1 = _$allocCopy(r1);
    };

    // Methods:
    this.capture = (target: Container): void =>
    {
      // reset counter
      count = 0;

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
          const i = count++;

          // auto-resize buffer
          if (i >= capacity)
          {
            // ran out of allocations, end abruptly
            if (capacity >= maxCapacity)
            {
              if (!this._$exhaustedCapacity)
              {
                console.error(
                  "[ContainerInterpolator] exhausted maximum capacity:",
                  maxCapacity
                );

                this._$exhaustedCapacity = true;
              }

              // early exit: skip the rest of the capture phase
              return;
            }

            _$resizeBuffer(capacity * 2);
          }

          // save container ref
          containers[i] = container;

          // capture properties
          x0[i] = container.position._x;
          y0[i] = container.position._y;
          xScale0[i] = container.scale._x;
          yScale0[i] = container.scale._y;
          xSkew0[i] = container.skew._x;
          ySkew0[i] = container.skew._y;
          r0[i] = container.rotation;
        }

        if (hasInterpolatedChildren)
        {
          const children = container.children as Container[];

          for (let i = 0; i < children.length; i++)
          {
            captureContainers(children[i]!, depth+1);
          }
        }
      };

      captureContainers(target, 0);

      // release tail pointers
      for (let j = count; j < prevCount; j++)
      {
        containers[j] = (undefined as any);
      }

      // save for next run
      prevCount = count;
    };

    // blend refs:
    let container: Container;
    let dx: number;
    let dy: number;
    let dr: number;
    let dScaleX: number;
    let dScaleY: number;
    let dSkewX: number;
    let dSkewY: number;

    this.blend = (t: number): void =>
    {
      // clamp
      t = Math.min(1, Math.max(0, t));

      for (let i = 0; i < count; i++)
      {
        container = containers[i]!;

        if (container === undefined || container.destroyed)
        {
          // skip: bad reference
          continue;
        }

        // capture end values and calculate the total delta
        dx = (x1[i] = container.position._x) - x0[i]!;
        dy = (y1[i] = container.position._y) - y0[i]!;
        dScaleX = (xScale1[i] = container.scale._x) - xScale0[i]!;
        dScaleY = (yScale1[i] = container.scale._y) - yScale0[i]!;
        dSkewX = (xSkew1[i] = container.skew._x) - xSkew0[i]!;
        dSkewY = (ySkew1[i] = container.skew._y) - ySkew0[i]!;
        dr = (r1[i] = container.rotation) - r0[i]!;

        if (Math.abs(dx) <= maxTranslateDelta && Math.abs(dy) <= maxTranslateDelta)
        {
          container.position.set(x0[i]! + dx * t, y0[i]! + dy * t);
        }

        if (Math.abs(dScaleX) <= maxScaleDelta && Math.abs(dScaleY) <= maxScaleDelta)
        {
          container.scale.set(xScale0[i]! + dScaleX * t, yScale0[i]! + dScaleY * t);
        }

        if (Math.abs(dSkewX) <= maxSkewDelta && Math.abs(dSkewY) <= maxSkewDelta)
        {
          container.skew.set(xSkew0[i]! + dSkewX * t, ySkew0[i]! + dSkewY * t);
        }

        if (Math.abs(dr) <= maxRotateDelta)
        {
          container.rotation = r0[i]! + dr * t;
        }
      }
    };

    this.unblend = (): void =>
    {
      let container: Container;

      for (let i = 0; i < count; i++)
      {
        container = containers[i]!;

        if (container === undefined || container.destroyed)
        {
          continue; // skip: bad reference
        }

        // clear
        container.position.set(x1[i]!, y1[i]!);
        container.scale.set(xScale1[i]!, yScale1[i]!);
        container.skew.set(xSkew1[i]!, ySkew1[i]!);
        container.rotation = r1[i]!;
      }
    };
  }
}
