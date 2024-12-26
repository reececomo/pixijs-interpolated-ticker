import { Application, Container } from "pixi.js";


const _BUFFER_PROPERTIES =
  6 // properties: x, y, scale.x, scale.y, rotation, alpha
  * 2; // buffers: "_prev<*>", "_shadow<*>"

export type InterpolatedContainer = Container & {
  /**
   * The internal index number for interpolated containers.
   * @protected
   */
  _interpIdx?: number;

  /**
   * (Optional) Whether interpolation is enabled for a node and its descendants.
   *
   * Set `getDefaultInterpolation( container )` on `InterpolatedTicker` to set the
   * default behavior.
   *
   * The default for most nodes is true.
   */
  interpolation?: boolean;

  /**
   * (Optional) An array of child containers to include in interpolation.
   * When not set, all `children` are used.
   *
   * Default: `undefined`
   */
  interpolatedChildren?: Container[];

  /**
   * (Optional) Set positional wraparound for a container.
   *
   * Default: `undefined`
   */
  interpolationWraparound?: {
    /** Range to wraparound. @example 200 would be -100 to 100. */
    xRange: number;
    /** Range to wraparound. @example 200 would be -100 to 100. */
    yRange: number;
  };
};

/**
 * A fixed timestep ticker class that runs an update loop and interpolates the
 * position, scale, rotation and alpha of containers.
 */
export class InterpolatedTicker
{
  // ----- Event hooks: -----

  /**
   * The update loop to trigger on each fixed timestep.
   * Container values set here are interpolated on render frames.
   */
  public update?: ( ft: number ) => void;

  /**
   * Triggered at the start of each cycle, prior to
   * any update or render frames being processed.
   */
  public evalStart?: ( start: number ) => void;

  /**
   * Triggered at the end of each cycle, after any
   * update or render frames have been processed.
   */
  public evalEnd?: ( start: number ) => void;

  /**
   * Triggered before a render frame.
   *
   * Container values are their true values.
   */
  public beforeRender?: ( dt: number ) => void;

  /**
   * Triggered during a render frame (prior to writing
   * the framebuffer).
   *
   * Container values are their interpolated values.
   */
  public onRender?: ( dt: number ) => void;

  /**
   * Triggered after a render frame (after writing the
   * framebuffer).
   *
   * Container values are their true values.
   */
  public afterRender?: ( dt: number ) => void;

  // ----- Properties: -----

  /** Limit maximum number of update() per render (i.e. rendering is slow). */
  public maxUpdatesPerRender = 10;

  /** Whether interpolation is currently enabled. */
  public interpolation = true;

  /** The maximum change in position values to interpolate (default: 100). */
  public autoLimitPosition = 100;

  /** The maximum change in scale values to interpolate (default: 1). */
  public autoLimitScale = 1;

  /** The maximum change in rotation values to interpolate (default: 45°). */
  public autoLimitRotation = Math.PI / 4;

  /** The maximum change in alpha values to interpolate (default: 0.5). */
  public autoLimitAlpha = 0.5;

  // ----- Internal: -----

  protected _app: Application;

  // ticker
  protected _targetUpdateIntervalMs: number;
  protected _updateIntervalMs: number;
  protected _previousTime: number = 0;
  protected _accumulator: number = 0;
  protected _started: boolean = false;
  protected _speed: number = 1.0;
  protected _maxRenderFPS: number = -1;
  protected _maxRenderIntervalMs: number = -1;

  // container indices
  protected _capacity: number;
  protected _idxContainers: Array<InterpolatedContainer | undefined>;
  protected _idxContainersCount: number = 0;
  protected _prevIdxContainersCount: number = 0;
  protected _maxIdx: number = 0;
  protected _releasedIdx: number[] = [];

  // -------------------------------------
  // Property buffers:
  // -------------------------------------
  //
  // - SoA (struct-of-arrays): each interpolated property is stored in its own
  //   float32 array for blazing-fast readwrites
  //
  // - during the interpolation step, the current non-interpolated values are
  //   temporarily written to a "shadow" buffer until the next step
  //

  protected _prevX: Float32Array;
  protected _prevY: Float32Array;
  protected _prevRotation: Float32Array;
  protected _prevScaleX: Float32Array;
  protected _prevScaleY: Float32Array;
  protected _prevAlpha: Float32Array;

  protected _shadowX: Float32Array;
  protected _shadowY: Float32Array;
  protected _shadowRotation: Float32Array;
  protected _shadowScaleX: Float32Array;
  protected _shadowScaleY: Float32Array;
  protected _shadowAlpha: Float32Array;

  protected _buffer: ArrayBuffer;

  public constructor(
    {
      app,
      update,
      evalStart,
      evalEnd,
      beforeRender,
      onRender,
      afterRender,
      autoLimitAlpha,
      autoLimitPosition,
      autoLimitRotation,
      autoLimitScale,
      interpolation = true,
      updateIntervalMs = 1_000 / 60,
      initialCapacity = 500,
    }: {
      app: Application;
      // optional config:
      interpolation?: boolean;
      updateIntervalMs?: number;
      initialCapacity?: number;
      update?: ( ft: number ) => void;
      evalStart?: ( start: number ) => void;
      evalEnd?: ( start: number ) => void;
      beforeRender?: ( dt: number ) => void;
      onRender?: ( dt: number ) => void;
      afterRender?: ( dt: number ) => void;
      autoLimitAlpha?: number;
      autoLimitPosition?: number;
      autoLimitRotation?: number;
      autoLimitScale?: number;
    }
  )
  {
    this._app = app;

    this.update = update;
    this.evalStart = evalStart;
    this.evalEnd = evalEnd;
    this.onRender = onRender;
    this.beforeRender = beforeRender;
    this.afterRender = afterRender;

    this._targetUpdateIntervalMs = updateIntervalMs;
    this._updateIntervalMs = updateIntervalMs;

    this.interpolation = interpolation;
    this.autoLimitAlpha = autoLimitAlpha;
    this.autoLimitPosition = autoLimitPosition;
    this.autoLimitRotation = autoLimitRotation;
    this.autoLimitScale = autoLimitScale;

    const capacity = initialCapacity;
    this._capacity = capacity;
    this._idxContainers = new Array( this._capacity );

    // buffers:
    const propBytes = Float32Array.BYTES_PER_ELEMENT * capacity;
    const memoryNeeded = _BUFFER_PROPERTIES * propBytes;

    this._buffer = new ArrayBuffer( memoryNeeded );

    let i = 0;
    const allocate = (): Float32Array =>
      new Float32Array( this._buffer, propBytes * i++, capacity );

    this._prevX = allocate();
    this._prevY = allocate();
    this._prevRotation = allocate();
    this._prevScaleX = allocate();
    this._prevScaleY = allocate();
    this._prevAlpha = allocate();

    this._shadowX = allocate();
    this._shadowY = allocate();
    this._shadowRotation = allocate();
    this._shadowScaleX = allocate();
    this._shadowScaleY = allocate();
    this._shadowAlpha = allocate();
  }

  public set speed( value: number )
  {
    this._speed = value;
    this._updateIntervalMs = this._targetUpdateIntervalMs / value;
  }

  public get speed(): number
  {
    return this._speed;
  }

  public get updateIntervalMs(): number
  {
    return this._targetUpdateIntervalMs;
  }

  public set updateIntervalMs( value: number )
  {
    this._targetUpdateIntervalMs = value;
    this._updateIntervalMs = value / this._speed;
  }

  public get maxRenderFPS(): number
  {
    return this._maxRenderFPS;
  }

  public set maxRenderFPS( value: number )
  {
    this._maxRenderFPS = value <= 0 ? -1 : value;
    this._maxRenderIntervalMs = value <= 0 ? -1 : 1000 / value;
  }

  public get started(): boolean
  {
    return this._started;
  }

  public start(): void
  {
    if ( this._started ) return;

    const loop = (): void =>
    {
      const start = performance.now();
      const renderDelta = start - this._previousTime;

      // limit renders if needed
      if ( renderDelta < this._maxRenderIntervalMs )
      {
        if ( this._started )
        {
          requestAnimationFrame( loop );
        }

        return;
      }

      this.evalStart?.( start );

      this._previousTime = start;

      this._accumulator = Math.min(
        this._accumulator + renderDelta,
        this._updateIntervalMs * this.maxUpdatesPerRender,
      );

      // -------------------------------------
      // Fixed timestep update:
      // -------------------------------------
      //

      while ( this._accumulator >= this._updateIntervalMs )
      {
        this._captureContainers();
        this.update?.( this._updateIntervalMs );
        this._accumulator -= this._updateIntervalMs;
      }

      // -------------------------------------
      // Render frame:
      // -------------------------------------
      //

      this.beforeRender?.( renderDelta );
      this._interpolateContainers( this._accumulator );
      this.onRender?.( renderDelta );
      this._app.renderer.render( this._app.stage );
      this._restoreContainers();
      this.afterRender?.( renderDelta );

      // end the loop
      this.evalEnd?.( start );

      if ( this._started )
      {
        requestAnimationFrame( loop );
      }
    };

    // kick off
    this._started = true;
    this._previousTime = performance.now();
    requestAnimationFrame( loop );
  }

  public stop(): void
  {
    this._started = false;
  }

  /**
   * Override this to opt-in containers from interpolation.
   */
  public getDefaultInterpolation( container: InterpolatedContainer ): boolean
  {
    return true;
  }

  // ----- protected methods: -----

  protected _resizeBuffer( newCapacity: number ): void
  {
    const propBytes = Float32Array.BYTES_PER_ELEMENT * newCapacity;
    const memoryNeeded = _BUFFER_PROPERTIES * propBytes;
    const newBuffer = new ArrayBuffer( memoryNeeded );
    let i = 0;

    const allocateAndCopy = ( oldArray: Float32Array ): Float32Array =>
    {
      const newArray = new Float32Array( newBuffer, propBytes * i++, newCapacity );

      newArray.set( oldArray );

      return newArray;
    };

    this._prevX = allocateAndCopy( this._prevX );
    this._prevY = allocateAndCopy( this._prevY );
    this._prevRotation = allocateAndCopy( this._prevRotation );
    this._prevScaleX = allocateAndCopy( this._prevScaleX );
    this._prevScaleY = allocateAndCopy( this._prevScaleY );
    this._prevAlpha = allocateAndCopy( this._prevAlpha );

    this._shadowX = allocateAndCopy( this._shadowX );
    this._shadowY = allocateAndCopy( this._shadowY );
    this._shadowRotation = allocateAndCopy( this._shadowRotation );
    this._shadowScaleX = allocateAndCopy( this._shadowScaleX );
    this._shadowScaleY = allocateAndCopy( this._shadowScaleY );
    this._shadowAlpha = allocateAndCopy( this._shadowAlpha );

    // update the buffer reference and capacity
    this._buffer = newBuffer;
    this._capacity = newCapacity;
  }

  protected _captureContainers(): void
  {
    this._idxContainersCount = 0;

    this._captureContainersTraverseSubtree( this._app.stage as InterpolatedContainer );

    // release tail pointers
    for ( let i = this._maxIdx; i < this._prevIdxContainersCount; i++ )
    {
      this._markReleased( this._idxContainers[i]);
      this._idxContainers[i] = undefined;
    }

    this._prevIdxContainersCount = this._maxIdx;
  }

  protected _captureContainersTraverseSubtree( container: InterpolatedContainer ): void
  {
    if ( container.destroyed ) return;
    if ( container.interpolation === false ) return;

    // check if an array is skippable
    if ( container.interpolation === undefined )
    {
      if ( ! this.getDefaultInterpolation(container) )
      {
        container.interpolation = false; // skip check next time

        return;
      }

      container.interpolation = true; // skip check next time
    }

    // resize on-demand
    if ( this._maxIdx + 1 >= this._capacity )
    {
      this._resizeBuffer( this._capacity * 2 );
    }

    const index = container._interpIdx // retain
      ?? this._releasedIdx.pop() // recycle
      ?? this._maxIdx++; // allocate

    // save index for typed arrays
    if ( container._interpIdx === undefined )
    {
      container._interpIdx = index;
    }

    // store current reference point
    this._prevX[index] = container.position._x;
    this._prevY[index] = container.position._y;
    this._prevScaleX[index] = container.scale._x;
    this._prevScaleY[index] = container.scale._y;
    this._prevRotation[index] = container.rotation;
    this._prevAlpha[index] = container.alpha;
    this._idxContainers[this._idxContainersCount++] = container;

    const children = container.interpolatedChildren ?? container.children;

    for ( let i = 0; i < children.length; i++ )
    {
      this._captureContainersTraverseSubtree( children[i] as InterpolatedContainer );
    }
  }

  protected _interpolateContainers( accumulated: number ): void
  {
    if ( !this.interpolation ) return;

    const rawFactor = accumulated / this._updateIntervalMs;
    const factor = rawFactor > 1 ? 1 : rawFactor < 0 ? 0 : rawFactor;

    for ( let i = 0; i < this._idxContainersCount; i++ )
    {
      if ( this._idxContainers[i] === undefined ) continue;

      if ( this._idxContainers[i]!.destroyed )
      {
        this._markReleased( this._idxContainers[i]);
        continue;
      }

      const container = this._idxContainers[i]!;
      const index = container._interpIdx!;
      const wrapConfig = container.interpolationWraparound;

      // -------------------------------------
      // Interpolate + capture shadow values:
      // -------------------------------------
      //
      // While updating the actual transforms, we jot down the
      // current raw values to temporary storage, to be restored
      // after app.renderer.render() is called.
      //

      // position
      let dx =
        ( this._shadowX[index] = container.position._x ) // 🔬 NOTE: assignment
        - this._prevX[index]!;

      let dy =
        ( this._shadowY[index] = container.position._y )  // 🔬 NOTE: assignment
        - this._prevY[index]!;

      if ( wrapConfig !== undefined )
      {
        const xrange = wrapConfig.xRange;
        const yrange = wrapConfig.yRange;

        dx = ( ( dx + xrange / 2 ) % xrange + xrange ) % xrange - xrange / 2;
        dy = ( ( dy + yrange / 2 ) % yrange + yrange ) % yrange - yrange / 2;
      }

      if (
        Math.abs( dx ) <= this.autoLimitPosition
        && Math.abs( dy ) <= this.autoLimitPosition
      )
      {
        container.position.set(
          this._prevX[index]! + factor * dx,
          this._prevY[index]! + factor * dy
        );
      }

      // scale
      const scaleDx = (
        ( this._shadowScaleX[index] = container.scale._x ) // 🔬 NOTE: assignment
        - this._prevScaleX[index]!
      );
      const scaleDy = (
        ( this._shadowScaleY[index] = container.scale._y ) // 🔬 NOTE: assignment
        - this._prevScaleY[index]!
      );

      if (
        Math.abs( scaleDx ) <= this.autoLimitScale
        && Math.abs( scaleDy ) <= this.autoLimitScale
      )
      {
        container.scale.set(
          this._prevScaleX[index]! + factor * scaleDx,
          this._prevScaleY[index]! + factor * scaleDy
        );
      }

      // rotation (wrap-around)
      let rotationDelta =
        ( this._shadowRotation[index] = container.rotation ) // 🔬 NOTE: assignment
        - this._prevRotation[index]!;

      if ( rotationDelta > Math.PI ) rotationDelta -= 2 * Math.PI;
      else if ( rotationDelta < -Math.PI ) rotationDelta += 2 * Math.PI;

      if ( Math.abs( rotationDelta ) <= this.autoLimitRotation )
      {
        container.rotation = this._prevRotation[index]! + factor * rotationDelta;
      }

      // alpha
      const alphaDelta = (
        ( this._shadowAlpha[index] = container.alpha ) // 🔬 NOTE: assignment
        - this._prevAlpha[index]!
      );

      if ( Math.abs( alphaDelta ) <= this.autoLimitAlpha )
      {
        container.alpha = this._prevAlpha[index]! + factor * alphaDelta;
      }
    }
  }

  protected _restoreContainers(): void
  {
    if ( !this.interpolation ) return;

    for ( let i = 0; i < this._idxContainersCount; i++ )
    {
      if ( this._idxContainers[i] === undefined ) continue;

      if ( this._idxContainers[i]!.destroyed )
      {
        this._markReleased( this._idxContainers[i]);
        continue;
      }

      const container = this._idxContainers[i]!;
      const index = container._interpIdx!;

      container.position.set( this._shadowX[index]!, this._shadowY[index]! ); // trigger transform update
      container.scale.set( this._shadowScaleX[index]!, this._shadowScaleY[index]! ); // trigger transform update
      container.rotation = this._shadowRotation[index]!;
      container.alpha = this._shadowAlpha[index]!;
    }
  }

  protected _markReleased( container: InterpolatedContainer | undefined ): void
  {
    if ( container?._interpIdx !== undefined )
    {
      this._releasedIdx.push( container._interpIdx );
      container._interpIdx = undefined;
    }
  }
}
