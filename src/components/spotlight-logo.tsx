'use client'

import { useEffect, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'

/**
 * The GitCloak lockup — the `ShieldCheck` medallion plus the wordmark — resting
 * as a faint outline until a light at the pointer reveals the lit copy.
 *
 * The mark is drawn twice, identically sized, stacked in the same box: the
 * outline is the resting/accessible copy, and the lit copy on top is masked by
 * a light centred on the pointer. The light is a union of several overlapping
 * lobes whose centres orbit the pointer at different slow speeds, so its edge
 * is an irregular blob that keeps changing form instead of a rigid circle; its
 * gradient is spread across the whole lobe so the rim fades out softly. A
 * per-frame loop rebuilds the mask while the light is live, and the CSS
 * opacity transition still does the fade when the pointer leaves the window.
 *
 * There is no SVG asset: the shape is the one already used in the header. Both
 * copies render the same `GitCloakMark` so they can never drift apart.
 *
 * Devices without a hovering pointer, and visitors who ask for reduced motion,
 * get the fully lit mark held still — there is nothing to follow and animating
 * it would fight the preference.
 */

/** Radius (px) of the light's main lobe. */
const SPOTLIGHT_RADIUS = 200

interface Lobe {
  /** Lobe radius as a fraction of `SPOTLIGHT_RADIUS`. */
  scale: number
  /** Orbit radius of the lobe's centre, as a fraction of `SPOTLIGHT_RADIUS`. */
  orbit: number
  /** Starting angle (radians) of the orbit. */
  phase: number
  /** Orbit speed (radians per millisecond); the lobes differ so the shape never settles. */
  speed: number
}

/** The lobes that, unioned, make up the irregular light. */
const LOBES: Lobe[] = [
  { scale: 1, orbit: 0, phase: 0, speed: 0 },
  { scale: 0.7, orbit: 0.28, phase: 0.7, speed: 0.00018 },
  { scale: 0.56, orbit: 0.36, phase: 2.6, speed: -0.00014 },
]

/**
 * Alpha stops spread over the whole lobe: a solid core fades out across a wide,
 * soft rim rather than cutting off at the edge.
 */
const LOBE_STOPS =
  'rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.9) 32%, rgba(0, 0, 0, 0.55) 58%, rgba(0, 0, 0, 0.24) 80%, rgba(0, 0, 0, 0) 100%'

/** Trim a pixel value so whole numbers stay `12px`, not `12.00px`. */
const px = (value: number) => `${Number(value.toFixed(2))}px`

/** The mask for a light centred at (`x`, `y`) inside the logo box, at `time` (ms). */
function spotlightMask(x: number, y: number, time: number): string {
  return LOBES.map((lobe) => {
    const angle = lobe.phase + time * lobe.speed
    const cx = x + Math.cos(angle) * lobe.orbit * SPOTLIGHT_RADIUS
    const cy = y + Math.sin(angle) * lobe.orbit * SPOTLIGHT_RADIUS
    const radius = lobe.scale * SPOTLIGHT_RADIUS
    return `radial-gradient(circle ${px(radius)} at ${px(cx)} ${px(cy)}, ${LOBE_STOPS})`
  }).join(', ')
}

function GitCloakMark({ lit }: { lit: boolean }) {
  return (
    <>
      <span
        className={
          'flex size-12 shrink-0 items-center justify-center rounded-gc-lg border sm:size-14 ' +
          (lit
            ? 'border-transparent bg-gradient-to-br from-gc-brand to-gc-brand-alt text-white'
            : 'border-gc-border-strong text-gc-fg-subtle')
        }
      >
        <ShieldCheck className="size-6 sm:size-7" />
      </span>
      <span
        className={
          'text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl ' +
          (lit
            ? 'bg-gradient-to-br from-gc-brand to-gc-brand-alt bg-clip-text text-transparent'
            : '')
        }
        style={
          lit
            ? undefined
            : { WebkitTextStroke: '1px var(--gc-fg-subtle)', color: 'transparent' }
        }
      >
        GitCloak
      </span>
    </>
  )
}

export function SpotlightLogo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const litRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const lit = litRef.current
    if (!root || !lit) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    // A hovering pointer is the only thing that can drive the light.
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

    // The light's centre, in the logo box's coordinates, and the loop that
    // keeps the lobes orbiting it while the light is visible.
    let centreX = 0
    let centreY = 0
    let frameId = 0
    let animating = false

    const setMask = (value: string) => {
      lit.style.setProperty('mask-image', value)
      lit.style.setProperty('-webkit-mask-image', value)
    }

    const paint = (time: number) => setMask(spotlightMask(centreX, centreY, time))

    const loop = (time: number) => {
      paint(time)
      frameId = window.requestAnimationFrame(loop)
    }

    const startLight = () => {
      if (animating) return
      animating = true
      frameId = window.requestAnimationFrame(loop)
    }

    const stopLight = () => {
      animating = false
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = 0
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      centreX = event.clientX - rect.left
      centreY = event.clientY - rect.top
      root.style.setProperty('--spot-x', px(centreX))
      root.style.setProperty('--spot-y', px(centreY))
      root.style.setProperty('--spot-opacity', '1')
      root.setAttribute('data-spotlight', 'active')
      // Paint now so the light is already at the pointer the moment the lit
      // copy appears; the loop then keeps the form moving.
      paint(performance.now())
      startLight()
    }

    const onPointerLeave = () => {
      // The light leaves with the pointer; the CSS transition does the fade.
      root.style.setProperty('--spot-opacity', '0')
      root.setAttribute('data-spotlight', 'idle')
      stopLight()
    }

    const onPointerOut = (event: PointerEvent) => {
      // `pointerout` bubbles, so a null `relatedTarget` is the pointer leaving
      // the window — not merely moving between two elements on the page.
      if (event.relatedTarget === null) onPointerLeave()
    }

    const setListeners = (on: boolean) => {
      if (on) {
        window.addEventListener('pointermove', onPointerMove, { passive: true })
        document.addEventListener('pointerout', onPointerOut)
        window.addEventListener('blur', onPointerLeave)
      } else {
        window.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerout', onPointerOut)
        window.removeEventListener('blur', onPointerLeave)
      }
    }

    const apply = () => {
      const interactive = finePointer.matches && !reduceMotion.matches
      setListeners(interactive)

      if (!interactive) {
        // Nothing to follow: hold the mark lit and still.
        stopLight()
        setMask('none')
        root.style.setProperty('--spot-opacity', '1')
        root.setAttribute('data-spotlight', 'static')
        return
      }

      // Give the lit copy a mask up front (invisible until the pointer moves).
      paint(performance.now())
      root.style.setProperty('--spot-opacity', '0')
      root.setAttribute('data-spotlight', 'idle')
    }

    apply()
    reduceMotion.addEventListener('change', apply)
    finePointer.addEventListener('change', apply)

    return () => {
      stopLight()
      setListeners(false)
      reduceMotion.removeEventListener('change', apply)
      finePointer.removeEventListener('change', apply)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      data-testid="spotlight-logo"
      data-spotlight="idle"
      className="relative w-fit"
    >
      {/* Resting outline — also the copy assistive tech reads. */}
      <h1 className="flex items-center gap-3 sm:gap-4">
        <GitCloakMark lit={false} />
      </h1>
      {/* Lit copy, revealed only where the pointer's light covers it. */}
      <div
        ref={litRef}
        aria-hidden="true"
        data-testid="spotlight-logo-lit"
        className="pointer-events-none absolute inset-0 flex items-center gap-3 transition-opacity duration-500 ease-out sm:gap-4"
        style={{ opacity: 'var(--spot-opacity, 0)' }}
      >
        <GitCloakMark lit />
      </div>
    </div>
  )
}
