'use client'

import { useEffect, useRef } from 'react'

/**
 * The drifting particle field behind the landing page.
 *
 * A handful of faint dots wander slowly across the viewport. The cursor does
 * not attract them — it *shoves* them: every particle inside `PUSH_RADIUS` of
 * the pointer picks up a little outward velocity, which then decays so the
 * particle settles back onto its own drift. Everything stays deliberately dim
 * (`--gc-accent` at ~20–40% alpha) so the headline and the call to action keep
 * the reader's attention.
 *
 * The canvas is decorative and inert: it is `aria-hidden` and
 * `pointer-events-none`, so it can never swallow a click meant for a link.
 * Under `prefers-reduced-motion: reduce` it paints a single still frame and
 * never starts the animation loop.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** Push velocity added by the cursor; decays every frame (settle back). */
  ox: number
  oy: number
  radius: number
  alpha: number
}

const PARTICLE_COUNT = 48
/** How close (px) the pointer must come before it shoves a particle. */
const PUSH_RADIUS = 130
/** Push velocity gained per frame at the centre of the pointer's reach. */
const PUSH_ACCEL = 0.12
/** Ceiling on the push velocity (px/frame) so a flick cannot fling a particle. */
const PUSH_MAX = 2.2
/** Push velocity kept per frame — the rest is the particle settling back. */
const PUSH_SETTLE = 0.93

function readToken(canvas: HTMLCanvasElement, token: string, fallback: string) {
  const value = getComputedStyle(canvas).getPropertyValue(token).trim()
  return value || fallback
}

export function LandingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    let width = 1
    let height = 1
    let frames = 0
    let frameId = 0
    let running = false
    // Particles are painted with the accent token so the field follows the
    // light/dark theme; the observer below re-reads it when `dark` toggles.
    let color = readToken(canvas, '--gc-accent', '#0969da')

    const particles: Particle[] = []
    const pointer = { x: -1e5, y: -1e5, active: false }

    const seed = () => {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          ox: 0,
          oy: 0,
          radius: 1 + Math.random() * 1.4,
          alpha: 0.18 + Math.random() * 0.22,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = color
      for (const particle of particles) {
        ctx.globalAlpha = particle.alpha
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const step = () => {
      for (const particle of particles) {
        if (pointer.active) {
          const dx = particle.x - pointer.x
          const dy = particle.y - pointer.y
          const distance = Math.hypot(dx, dy)
          if (distance > 0.001 && distance < PUSH_RADIUS) {
            const force = (1 - distance / PUSH_RADIUS) * PUSH_ACCEL
            particle.ox += (dx / distance) * force
            particle.oy += (dy / distance) * force
            const speed = Math.hypot(particle.ox, particle.oy)
            if (speed > PUSH_MAX) {
              particle.ox = (particle.ox / speed) * PUSH_MAX
              particle.oy = (particle.oy / speed) * PUSH_MAX
            }
          }
        }
        particle.ox *= PUSH_SETTLE
        particle.oy *= PUSH_SETTLE
        particle.x += particle.vx + particle.ox
        particle.y += particle.vy + particle.oy
        // Wrap around the edges so the field never thins out.
        if (particle.x < -12) particle.x = width + 12
        else if (particle.x > width + 12) particle.x = -12
        if (particle.y < -12) particle.y = height + 12
        else if (particle.y > height + 12) particle.y = -12
      }
      draw()
      frames += 1
    }

    const loop = () => {
      step()
      frameId = window.requestAnimationFrame(loop)
    }

    const start = () => {
      if (running) return
      running = true
      frameId = window.requestAnimationFrame(loop)
    }

    const stop = () => {
      running = false
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = 0
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (particles.length === 0) seed()
      draw()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = true
    }

    const releasePointer = () => {
      pointer.active = false
    }

    const onPointerOut = (event: PointerEvent) => {
      // `pointerout` bubbles, so a null `relatedTarget` is the pointer leaving
      // the window — not merely moving between two elements on the page.
      if (event.relatedTarget === null) releasePointer()
    }

    const applyMotionPreference = () => {
      if (motionQuery.matches) {
        // Reduced motion: one still frame, no loop, no cursor interaction.
        stop()
        pointer.active = false
        draw()
      } else {
        start()
      }
    }

    const themeObserver = new MutationObserver(() => {
      color = readToken(canvas, '--gc-accent', color)
      if (!running) draw()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerout', onPointerOut)
    window.addEventListener('blur', releasePointer)
    motionQuery.addEventListener('change', applyMotionPreference)

    resize()
    applyMotionPreference()

    // Test hook (see src/types/global.d.ts): the e2e suite reads the drift and
    // the cursor's push through this instead of sampling canvas pixels.
    window.__landingBackground = {
      frames: () => frames,
      offsets: () => particles.map((p) => Math.hypot(p.ox, p.oy)),
      maxOffset: () =>
        particles.reduce((max, p) => Math.max(max, Math.hypot(p.ox, p.oy)), 0),
      pointerActive: () => pointer.active,
      color: () => color,
    }

    return () => {
      stop()
      themeObserver.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('blur', releasePointer)
      motionQuery.removeEventListener('change', applyMotionPreference)
      delete window.__landingBackground
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-testid="landing-background"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  )
}
