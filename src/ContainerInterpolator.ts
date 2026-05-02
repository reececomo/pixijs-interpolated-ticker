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
   * Maximum interpolatable change in `position.x` or `position.y`.
   *
   * @default 100
   */
  maxPositionDelta?: number;

  /**
   * Maximum interpolatable change in `pivot.x` or `pivot.y`.
   *
   * @default 100
   */
  maxPivotDelta?: number;

  /**
   * Maximum interpolatable change in `scale.x` or `scale.y`.
   *
   * @default 1
   */
  maxScaleDelta?: number;

  /**
   * Maximum interpolatable change in `skew.x` or `skew.y`.
   *
   * @default Math.PI/2
   */
  maxSkewDelta?: number;

  /**
   * Maximum interpolatable change in `rotation`.
   *
   * @default Math.PI/2
   */
  maxRotationDelta?: number;

  /**
   * Initial container capacity to allocate memory for.
   *
   * Capacity will double in size on-demand until `maxCapacity`
   * is reached.
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
 * - flags
 */
const CONTAINER_HEADERS = 1;

/**
 * - position.x
 * - position.y
 * - scale.x
 * - scale.y
 * - rotation
 * - skew.x
 * - skew.y
 * - pivot.x
 * - pivot.y
 */
const CONTAINER_PROPS_FULL = 9;
const BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

const DEFAULT_MAX_POSITION_DELTA = 100;
const DEFAULT_MAX_PIVOT_DELTA = 100;
const DEFAULT_MAX_SCALE_DELTA = 1;
const DEFAULT_MAX_SKEW_DELTA = Math.PI/2;
const DEFAULT_MAX_ROTATION_DELTA = Math.PI/2;
const DEFAULT_INITIAL_CAPACITY = 256;
const DEFAULT_MAX_CAPACITY = 4096;

const enum kFlag
{
  CHANGED_POSITION = 1,
  CHANGED_SCALE = 2,
  CHANGED_ROTATION = 4,
  CHANGED_SKEW = 8,
  CHANGED_PIVOT = 16,
}

const enum kOffset
{
  FLAGS,

  POSX_0,
  POSX_1,

  POSY_0,
  POSY_1,

  SCALEX_0,
  SCALEX_1,

  SCALEY_0,
  SCALEY_1,

  ROT_0,
  ROT_1,

  SKEWX_0,
  SKEWX_1,

  SKEWY_0,
  SKEWY_1,

  PIVOTX_0,
  PIVOTX_1,

  PIVOTY_0,
  PIVOTY_1,
}

/**
 * Utility that manages transform state for a tree of
 * PIXI Containers and can apply interpolation.
 *
 * @example
 * // adapted from https://gafferongames.com/post/fix_your_timestep/
 * // triggers a fixed interval "update()" function
 * const dt = 16.67;
 * let currentTime = performance.now();
 * let accumulator = 0.0;
 *
 * function frame( newTime: number )
 * {
 *     requestAnimationFrame( frame ); // queue request immediately
 *
 *     const frameTime = Math.min( newTime - currentTime, 250 );
 *     currentTime = newTime;
 *
 *     accumulator += frameTime;
 *
 *     while ( accumulator >= dt )
 *     {
 *         interpolator.capture( app.stage );
 *         update( dt );
 *         accumulator -= dt;
 *     }
 *
 *     interpolator.lerp( accumulator / dt );
 *
 *     app.renderer.render( app.stage );
 *
 *     interpolator.unlerp();
 * }
 *
 * // start loop
 * requestAnimationFrame( frame );
 */
export class ContainerInterpolator
{
  /**
   * Captures the known state of containers. Only containers
   * captured in this call will be interpolated.
   *
   * This should be called before each `update()`.
   */
  public readonly capture: (target: Container) => void;

  /**
   * Set containers state to a linearly interpolated value between
   * previous captured state (`0`) and the current state (`1`).
   *
   * This should be called before render.
   *
   * @param t - Blend value (0, 1)
   */
  public readonly lerp: (t: number) => void;

  /**
   * Restore containers to real values.
   *
   * This should be called after `render()`.
   */
  public readonly unlerp: () => void;

  // ----- Properties: -----
  private _$exhaustedCapacity = false;

  // ----- Methods: -----
  public constructor(cfg: ContainerInterpolatorOptions = {})
  {
    const maxPositionDelta = cfg.maxPositionDelta ?? DEFAULT_MAX_POSITION_DELTA;
    const maxPivotDelta = cfg.maxPivotDelta ?? DEFAULT_MAX_PIVOT_DELTA;
    const maxScaleDelta = cfg.maxScaleDelta ?? DEFAULT_MAX_SCALE_DELTA;
    const maxSkewDelta = cfg.maxSkewDelta ?? DEFAULT_MAX_SKEW_DELTA;
    const maxRotationDelta = cfg.maxRotationDelta ?? DEFAULT_MAX_ROTATION_DELTA;
    const maxCapacity = cfg.maxCapacity ?? DEFAULT_MAX_CAPACITY;

    let capacity = Math.min(cfg.capacity ?? DEFAULT_INITIAL_CAPACITY, maxCapacity);

    // setup buffers
    const containerElements = CONTAINER_HEADERS + CONTAINER_PROPS_FULL * 2;
    const bytesPerContainer = containerElements * BYTES_PER_ELEMENT;
    const initialBytes = capacity * bytesPerContainer;
    const initialBuffer = new ArrayBuffer(initialBytes);

    // refs:
    let containers = new Array(maxCapacity),
      values = new Float32Array(initialBuffer),
      count = 0,
      prevCount = 0;

    const _$resizeBuffer = (newCapacity: number): void =>
    {
      newCapacity = Math.min(newCapacity, maxCapacity);

      const newBytes = newCapacity * bytesPerContainer;
      const newBuffer = new ArrayBuffer(newBytes);
      const newValues = new Float32Array(newBuffer);

      newValues.set(values);

      capacity = newCapacity;
      values = newValues;
    };


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
        const i = count;

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

        count += 1;

        // capture local transform
        containers[i] = container;

        const j = i * containerElements;

        values[j + kOffset.POSX_0] = container.position._x;
        values[j + kOffset.POSY_0] = container.position._y;
        values[j + kOffset.SCALEX_0] = container.scale._x;
        values[j + kOffset.SCALEY_0] = container.scale._y;
        values[j + kOffset.ROT_0] = container.rotation;
        values[j + kOffset.SKEWX_0] = container.skew._x;
        values[j + kOffset.SKEWY_0] = container.skew._y;
        values[j + kOffset.PIVOTX_0] = container.pivot._x;
        values[j + kOffset.PIVOTY_0] = container.pivot._y;
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

    // Methods:
    this.capture = (target: Container): void =>
    {
      // reset counter
      count = 0;

      captureContainers(target, 0);

      // release tail pointers
      for (let j = count; j < prevCount; j++)
      {
        containers[j] = (undefined as any);
      }

      // save for next run
      prevCount = count;
    };

    // lerp refs:
    let container: Container;
    let changeMask: number;
    let deltaPosX: number;
    let deltaPosY: number;
    let deltaRot: number;
    let deltaScaleX: number;
    let deltaScaleY: number;
    let deltaSkewX: number;
    let deltaSkewY: number;
    let deltaPivotX: number;
    let deltaPivotY: number;

    this.lerp = (t: number): void =>
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
        const j = i * containerElements;
        deltaPosX = (values[j + kOffset.POSX_1] = container.position._x) - values[j + kOffset.POSX_0]!;
        deltaPosY = (values[j + kOffset.POSY_1] = container.position._y) - values[j + kOffset.POSY_0]!;
        deltaScaleX = (values[j + kOffset.SCALEX_1] = container.scale._x) - values[j + kOffset.SCALEX_0]!;
        deltaScaleY = (values[j + kOffset.SCALEY_1] = container.scale._y) - values[j + kOffset.SCALEY_0]!;
        deltaRot = (values[j + kOffset.ROT_1] = container.rotation) - values[j + kOffset.ROT_0]!;
        deltaSkewX = (values[j + kOffset.SKEWX_1] = container.skew._x) - values[j + kOffset.SKEWX_0]!;
        deltaSkewY = (values[j + kOffset.SKEWY_1] = container.skew._y) - values[j + kOffset.SKEWY_0]!;
        deltaPivotX = (values[j + kOffset.PIVOTX_1] = container.pivot._x) - values[j + kOffset.PIVOTX_0]!;
        deltaPivotY = (values[j + kOffset.PIVOTY_1] = container.pivot._y) - values[j + kOffset.PIVOTY_0]!;

        // apply interpolation (otherwise remain in t=1 state):
        changeMask = 0;

        if (
          (deltaPosX !== 0 || deltaPosY !== 0)
          && Math.abs(deltaPosX) <= maxPositionDelta
          && Math.abs(deltaPosY) <= maxPositionDelta
        )
        {
          container.position.set(
            values[j + kOffset.POSX_0]! + deltaPosX * t,
            values[j + kOffset.POSY_0]! + deltaPosY * t
          );

          changeMask |= kFlag.CHANGED_POSITION;
        }

        if (
          (deltaScaleX !== 0 || deltaScaleY !== 0)
          && Math.abs(deltaScaleX) <= maxScaleDelta
          && Math.abs(deltaScaleY) <= maxScaleDelta
        )
        {
          container.scale.set(
            values[j + kOffset.SCALEX_0]! + deltaScaleX * t,
            values[j + kOffset.SCALEY_0]! + deltaScaleY * t
          );

          changeMask |= kFlag.CHANGED_SCALE;
        }

        if (
          deltaRot !== 0
          && Math.abs(deltaRot) <= maxRotationDelta
        )
        {
          container.rotation = values[j + kOffset.ROT_0]! + deltaRot * t;

          changeMask |= kFlag.CHANGED_ROTATION;
        }

        if (
          (deltaSkewY !== 0 || deltaSkewX !== 0)
          && Math.abs(deltaSkewY) <= maxSkewDelta
          && Math.abs(deltaSkewX) <= maxSkewDelta
        )
        {
          container.skew.set(
            values[j + kOffset.SKEWX_0]! + deltaSkewX * t,
            values[j + kOffset.SKEWY_0]! + deltaSkewY * t
          );

          changeMask |= kFlag.CHANGED_SKEW;
        }

        if (
          (deltaPivotX !== 0 || deltaPivotY !== 0)
          && Math.abs(deltaPivotX) <= maxPivotDelta
          && Math.abs(deltaPivotY) <= maxPivotDelta
        )
        {
          container.pivot.set(
            values[j + kOffset.PIVOTX_0]! + deltaPivotX * t,
            values[j + kOffset.PIVOTY_0]! + deltaPivotY * t
          );

          changeMask |= kFlag.CHANGED_PIVOT;
        }

        values[j + kOffset.FLAGS] = changeMask;
      }
    };

    this.unlerp = (): void =>
    {
      let container: Container;

      for (let i = 0; i < count; i++)
      {
        container = containers[i]!;

        if (container === undefined || container.destroyed)
        {
          continue; // skip: bad reference
        }

        // reset local transform
        const j = i * containerElements;

        changeMask = values[j + kOffset.FLAGS]!;

        if (changeMask === 0)
        {
          // skip: no changes
          continue;
        }

        if (changeMask & kFlag.CHANGED_POSITION)
        {
          container.position.set(
            values[j + kOffset.POSX_1]!,
            values[j + kOffset.POSY_1]!
          );
        }

        if (changeMask & kFlag.CHANGED_SCALE)
        {
          container.scale.set(
            values[j + kOffset.SCALEX_1]!,
            values[j + kOffset.SCALEY_1]!
          );
        }

        if (changeMask & kFlag.CHANGED_ROTATION)
        {
          container.rotation = values[j + kOffset.ROT_1]!;
        }

        if (changeMask & kFlag.CHANGED_SKEW)
        {
          container.skew.set(
            values[j + kOffset.SKEWX_1]!,
            values[j + kOffset.SKEWY_1]!
          );
        }

        if (changeMask & kFlag.CHANGED_PIVOT)
        {
          container.pivot.set(
            values[j + kOffset.PIVOTX_1]!,
            values[j + kOffset.PIVOTY_1]!
          );
        }
      }
    };
  }
}
