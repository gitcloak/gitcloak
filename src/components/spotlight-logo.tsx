'use client'

import { useEffect, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'

/**
 * The GitCloak lockup — the `ShieldCheck` medallion plus the wordmark — resting
 * as a faint outline until a light at the pointer reveals the lit copy.
 *
 * The mark is drawn twice, identically sized, stacked in the same box: the
 * outline is the resting/accessible copy, and the lit copy on top is masked by
 * a radial gradient centred on the pointer. The gradient does the work — as the
 * pointer moves away its circle stops covering the mark, so the logo fades back
 * to the outline without any per-frame React state. When the pointer leaves the
 * window the lit layer fades out outright.
 *
 * There is no SVG asset: the shape is the one already used in the header. Both
 * copies render the same `GitCloakMark` so they can never drift apart.
 *
 * Devices without a hovering pointer, and visitors who ask for reduced motion,
 * get the fully lit mark held still — there is nothing to follow and animating
 * it would fight the preference.
 */

/** Radius (px) of the light that reveals the lit copy. */
const SPOTLIGHT_RADIUS = 160

const SPOTLIGHT_MASK = `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at var(--spot-x, 50%) var(--spot-y, 50%), rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.75) 40%, transparent 70%)`

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

    const setMask = (value: string) => {
      lit.style.setProperty('mask-image', value)
      lit.style.setProperty('-webkit-mask-image', value)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      root.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
      root.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
      root.style.setProperty('--spot-opacity', '1')
      root.setAttribute('data-spotlight', 'active')
    }

    const onPointerLeave = () => {
      // The light leaves with the pointer; the CSS transition does the fade.
      root.style.setProperty('--spot-opacity', '0')
      root.setAttribute('data-spotlight', 'idle')
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
        setMask('none')
        root.style.setProperty('--spot-opacity', '1')
        root.setAttribute('data-spotlight', 'static')
        return
      }

      setMask(SPOTLIGHT_MASK)
      root.style.setProperty('--spot-opacity', '0')
      root.setAttribute('data-spotlight', 'idle')
    }

    apply()
    reduceMotion.addEventListener('change', apply)
    finePointer.addEventListener('change', apply)

    return () => {
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
