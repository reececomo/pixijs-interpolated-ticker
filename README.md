<h1 align="center">
  ⚡ pixijs-interpolated-ticker
  <br>
  <br>
  <img src="./hero.png" width=50% />
<br>
</h1>
<br>

<p align="center">
  🏃 Independent render FPS &ndash; update ticker in PixiJS
</p>
<br>

<p>
  <a href="https://www.npmjs.com/package/pixijs-interpolated-ticker"><img src="https://img.shields.io/npm/v/pixijs-interpolated-ticker.svg" alt="NPM version"></a>
  <a href="https://github.com/reececomo/pixijs-interpolated-ticker/blob/main/LICENSE"><img src="https://badgen.net/npm/license/pixijs-interpolated-ticker" alt="License"></a>
  <a href="https://bundlephobia.com/package/pixijs-interpolated-ticker"><img src="https://badgen.net/bundlephobia/minzip/pixijs-interpolated-ticker@latest" alt="Minzipped"></a>
  <a href="https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml"><img src="https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://www.npmjs.com/package/pixijs-interpolated-ticker"><img src="https://img.shields.io/npm/dm/pixijs-interpolated-ticker.svg" alt="Downloads"></a>
</p>

<table>
<tbody>
<tr>
<td>🔮 Simple, drop-in API</td>
<td>✨ Supports PixiJS 8, 7 and 6+</td>
</tr>
<tr>
<td>✅ Plugin compatible</td>
<td>💪 Configurable, with sensible defaults</td>
</tr>
<tr>
<td>🤏 Tiny (&lt;2kB)</td>
<td>🍃 No dependencies, tree-shakeable</td>
</tr>
</tbody>
</table>

## Usage

```ts
const ticker = new InterpolatedTicker({ renderer, stage });
const mySprite = new Sprite({ texture: Assets.get("cat") });

ticker.start({
    // triggered at a fixed interval
    update: (fixedDeltaMS: number)
    {
        mySprite.x += 5;
        mySprite.angle += 0.1;
    }
});
```

## 💿 Install

```sh
npm i pixijs-interpolated-ticker
```

## Configuration

```ts
const ticker = new InterpolatedTicker({ renderer, stage });
const mySprite = new Sprite({ texture: "cat" });

ticker.start({
    update: (fixedDeltaMS: number)
    {
        // triggered at a fixed interval
        //   fixedDeltaMS never changes
    },

    render: (renderDeltaMS: number, progress: number)
    {
        // triggered at display refresh rate
        //   e.g. drawing additional particle effects, etc.
    },

    renderPrepare: (renderDeltaMS: number)
    {
        // triggered at display refresh rate
        //   prior to container interpolation
    },
});

// increasing the speed affects the rate at which update(fixedDeltaMS) is
// executed, but does not affect the value of fixedDeltaMS.
ticker.speed = 2;

// limit render FPS
ticker.renderFPS = 30;

ticker.on("fps", (fps) =>
{
    // render FPS updated
});

ticker.on("devicefps", (fps) =>
{
    // device FPS updated (independent of actual renders)
});
```

### Ticker Options

```ts
new InterpolatedTicker(options: {
    /**
     * PixiJS renderer.
     */
    renderer: Renderer;

    /**
     * Stage root view.
     */
    stage: Container;

    /**
     * Fixed timestep interval in milliseconds.
     *
     * @default 16.666666666666668
     */
    fixedDeltaMS?: number;

    /**
     * Whether container interpolation is enabled.
     *
     * When enabled, container values (position, scale, rotation, alpha) are
     * rendered at interpolated positions.
     *
     * @default true
     */
    interpolation?: boolean;

    /**
     * Container interpolation options (when enabled).
     *
     * @default undefined
     */
    interpolationOptions?: {
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
    },

    /**
     * The display refresh rate to target (in frames per second). Actual render
     * rate will vary on different displays.
     *
     * A value of `0` means unlimited refresh rate.
     *
     * @default 0
     */
    renderFPS?: number;
    
    /**
     * When `renderFPS` set, this is the maximum tolerance in milliseconds for
     * limiting the render frame interval.
     *
     * @default 7.0
     */
    renderIntervalToleranceMS?: number;

    /**
     * Maximum frame time in milliseconds that fixed updates may accrue for
     * before frame time stops accruing. Scaled by `speed`.
     *
     * @default fixedDeltaMS*3
     */
    maxFrameTimeMS?: number;

    /**
     * The minimum interval in milliseconds that fluctuations in FPS are reported.
     *
     * Listen for "fps" and "devicefps" events.
     *
     * @default 1000
     */
    fpsIntervalMS?: number;

    /**
     * The rounding level for FPS detection (e.g. 0.01).
     *
     * @default 1
     */
    fpsPrecision?: number;
})
```

### Container Options

*Configuring individual containers.*

| Property | Description |
| :----- | :------ |
| `isInterpolated` | Set `false` to disable interpolation on this container. Defaults to `this.visible`. |
| `hasInterpolatedChildren` | Set `false` to disable interpolation on this container's descendants. Defaults to `this.isInterpolated`. |

```ts
const container = new Container();

// skip interpolation on this container and its children
container.isInterpolated = false;

// actually ...lets allow children to be interpolated anyway
container.hasInterpolatedChildren = true;
```

## Credit

PixiJS InterpolatedTicker is an implementation of the ideas laid out in
[Gafferongames' Fix Your Timestep article](https://gafferongames.com/post/fix_your_timestep/),
and is a spiritual successor to [kittykatattack/smoothie](https://github.com/kittykatattack/smoothie).
