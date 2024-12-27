<br>
<h1 align="center">
  PixiJS Interpolated Ticker
  <br>
  <br>
  <img src="./hero.png" width=50% />
<br>
<br>
</h1>
<br>

<p align="center">
  ⚡ Unlimited render FPS &ndash; high-performance keyframe interpolation for PixiJS
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
<td>🤏 Tiny (&lt;2kB)</td>
<td>🍃 No dependencies, tree-shakeable</td>
</tr>
</tbody>
</table>

## Sample Usage

```ts
function update() {
  spriteA.x += 10
  spriteB.rotation -= Math.PI * 0.125
}

const loop = new InterpolatedTicker({ app, update })

// run @ 24Hz:
loop.updateIntervalMs = 1000 / 24
loop.start()
```

## Getting Started

### 💿 Install

```sh
npm i pixijs-interpolated-ticker
```

### Overview

- The **update()** function records **keyframes**
- The ticker renders frames to the framebuffer using interpolated values for `x`, `y`, `scale`, `rotation`, and `alpha`

## Advanced Configuration

### Ticker Options

*Configuring your interpolation ticker.*

```ts
const mainLoop = new InterpolationTicker({
  app: myApplication,

  // the update loop function, used as keyframes
  update: () => {},

  // enable/disable frame interpolation (default = true)
  interpolation: true,

  // how frequently to trigger update loop (default = 1000/60)
  updateIntervalMs: 1000/30,

  // set a maximum render FPS, -1 is unlimited (default = -1)
  maxRenderFPS: 60,

  // maximum change in alpha to animate (default = 0.5):
  autoLimitAlpha: 0.1,

  // maximum change in x or y to animate (default = 100):
  autoLimitPosition: 250,

  // maximum change in rotation to animate (default = Math.PI / 4):
  autoLimitRotation: Math.PI,

  // maximum change in scale to animate (default = 1.0):
  autoLimitScale: 1.5,

  // hook triggered at the start of a render, immediately
  // following any update frames that have been processed.
  // containers' values are their latest keyframe values.
  preRender: ( deltaTimeMs ) => {},

  // hook triggered during a render, immediately before
  // writing to the framebuffer. containers' values are
  // their interpolated values.
  onRender: ( deltaTimeMs ) => {},

  // hook triggered at the end of a render. containers'
  // values are their latest keyframe values.
  postRender: ( deltaTimeMs ) => {},

  // hook triggered at the start of each evaluation cycle, before
  // any update or render frames are processed.
  evalStart: ( startTime ) => {},

  // hook triggered at the end of each evaluation cycle, after all
  // update and render frames have been processed.
  evalEnd = ( startTime ) => {},

  // initial number of containers to reserve memory in the internal
  // buffer for. note: the internal buffer will resize automatically
  // when it is full. (default = 500):
  initialCapacity: 2500,
})
```

and other additional non-constructor values:

```ts
const mainLoop = new InterpolatedTicker({ app })

// run the update loop at 125% speed:
mainLoop.speed = 1.25

// restrict render skips - if rendering is interrupted for any
// reason - e.g. the window loses focus - then this will
// limit the maximum number of "catch-up" frames (default = 10):
mainLoop.maxUpdatesPerRender = 10

// set custom opt-in or opt-out logic for container interpolation.
// when `container.interpolation` is not set yet, this function is
// evaluated once to hydrate that property.
//
// you could set this to () => false to opt-out by default, and then
// manually set container.interpolation = true in the containers you
// want to interpolate.
//
// (default: () => true)
mainLoop.getDefaultInterpolation = ( container ): boolean => {
  return !(container instanceof Mesh)
}
```

### Container Options

*Configuring individual containers.*

Containers are granted _optional_ properties to make it easy to configure advanced interpolation.

Interpolation is opt-out for stage containers, and disabling interpolation for a container will also disable it for all descendants.

| Property | Description |
| :----- | :------ |
| `interpolation` | Whether interpolation is explicitly enabled or disabled for this container. The default behavior for all containers is `true`. |
| `interpolatedChildren` | An array of child containers to include in interpolation. When not set, `children` is used. |
| `interpolationWraparound` | If set, position will smoothly wraparound the given ranges. |

```ts
// disable interpolation for a container
// (and all of its descendants):
const sprite = new Sprite()
sprite.interpolation = false

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
parent.interpolatedChildren = [ childB ]
```

## Credits

PixiJS InterpolatedTicker is a spiritual successor to [kittykatattack/smoothie](https://github.com/kittykatattack/smoothie).
