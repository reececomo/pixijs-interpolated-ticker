<br>
<h1 align="center">
  🎥 PixiJS Interpolated Ticker
  <br>
  <img src="./hero.png" width=50% />
</h1>

<p align="center">
  ⚡️ Unlimited render FPS, fixed-interval updates &ndash; seamless, high-performance frame interpolator plugin for PixiJS
</p>

<br>

<p>
  <a href="https://www.npmjs.com/package/pixijs-interpolated-ticker"><img src="https://img.shields.io/npm/v/pixijs-interpolated-ticker.svg" alt="NPM version"></a>
  <a href="https://github.com/reececomo/pixijs-interpolated-ticker/blob/main/LICENSE"><img src="https://badgen.net/npm/license/pixijs-interpolated-ticker" alt="License"></a>
  <a href="https://bundlephobia.com/package/pixijs-interpolated-ticker"><img src="https://badgen.net/bundlephobia/minzip/pixijs-interpolated-ticker@latest" alt="Minzipped"></a>
  <a href="https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml"><img src="https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://www.npmjs.com/package/pixijs-interpolated-ticker"><img src="https://img.shields.io/npm/dm/pixijs-interpolated-ticker.svg" alt="Downloads per month"></a>
</p>

<table>
<tbody>
<tr>
<td>🔮 Simple, drop-in API</td>
<td>✨ Supports PixiJS v6, v7, v8+</td>
</tr>
<tr>
<td>✅ Plugin compatible</td>
<td>💪 Configurable, with sensible defaults</td>
</tr>
<tr>
<td>🤏 &lt;2Kb minzipped</td>
<td>🍃 No dependencies, tree-shakeable</td>
</tr>
</tbody>
</table>

## Sample Usage

*Create and configure an update loop.*

```ts
// define an update loop (default: 60Hz)
const myLoop = new InterpolatedTicker({ app })

myLoop.update = () => {
  // changes made here will be rendered at the
  // current refresh rate is (e.g. 30Hz, 144Hz)
}

myLoop.start()
```

## Getting Started

### 💿 Installation

```sh
# npm
npm install pixijs-interpolated-ticker -D

# yarn
yarn add pixijs-interpolated-ticker --dev
```

### Concepts

InterpolatedTicker separates the update loop into a fixed-interval **update** frame, and a variable-interval **render** frame.

The **update** and **render** loops are independent, and can run at different speeds - i.e. a 30Hz update loop could be rendered at 144 FPS, just as a 128Hz update loop could be rendered at 30 FPS.

During an **update** frame, the InterpolatedTicker hydrates its internal buffer with the true `x`, `y`, `scale`, `rotation`, and `alpha` for stage containers. Then during each **render** frame, those stage containers are rendered to the framebuffer with interpolated values.

> [!IMPORTANT]
> **Interpolation:** The rendered values are always slightly _behind_ the true current value, by up to one frame.

## Configuration

### Ticker Options

*Configuring your interpolation ticker.*

```ts
const ticker = new InterpolationTicker({
  app: myApplication,

  // how often to trigger update loop (default: 1000/60)
  updateIntervalMs: 1000 / 30,

  // initial # of containers to pre-allocate memory for (default: 500)
  initialCapacity: 10000, 
})

// set the target frequency of the update loop
ticker.updateIntervalMs = 8.3334

// modify the frequency of the update loop (relative to updateIntervalMs)
ticker.speed = 1.5

// listen to render frames
ticker.onRender = ( deltaTimeMs ) => {
  // called during rendering
}

// limit the render frequency (default: -1)
ticker.maxRenderFPS = 60

// limit render skips - if rendering is interuppted for any
// reason (e.g. window loses focus) then settings this will
// limit the number of "catch-up" frames.
ticker.maxUpdatesPerRender = 10;

// set the default logic for opt-in/opt-out containers
ticker.getDefaultInterpolation = ( container ): boolean => {
  return !(container instanceof ParticleContainer);
}
```

> [!TIP]
> The internal buffer automatically resizes as-needed, and is pretty fast even for large scenes. You may optionally set the  `initialCapacity` manually too.

### Container Options

Containers are extended with a few optional properties to make it easy to configure interpolation.

Interpolation is opt-out for stage items, and disabling interpolation for a container will also disable it for all descendants.

| Property | Description |
| :----- | :------ |
| `interpolation` | Whether interpolation is explicitly enabled or disabled for this container. The default behavior for all containers is `true`. |
| `interpolatedChildren` | An array of child containers to include in interpolation. When not set, `children` is used. |
| `interpolationWraparound` | If set, position will smoothly wraparound the given ranges. |

```ts
// disable interpolation for a container
// (and all of its descendants):
const sprite = new Sprite()
sprite.interpolation = false;

// allow a container's position to wraparound smoothly:
const background = new Sprite()
background.interpolationWraparound = {
  xRange: 1000,
  yRange: 2000
}

// explicitly set which children may be interpolated
const parent = new Container()
const childA = new Container()
const childB = new Container()
parent.addChild( childA, childB )
parent.interpolatedChildren = [ childB ];
```

## Credits

PixiJS InterpolatedTicker is a spiritual successor to [kittykatattack/smoothie](https://github.com/kittykatattack/smoothie).
