// What the scenes are made of: the pace of a person, a finger that shows where it taps, and a
// scroll that glides. The browser has no mouse or finger in a video, so the page draws them.

/** Runs in every page: the ripple under each tap, and the gliding scroll. */
function inPage() {
  addEventListener(
    'pointerdown',
    (event) => {
      const ripple = document.createElement('div')
      Object.assign(ripple.style, {
        position: 'fixed',
        left: `${event.clientX - 22}px`,
        top: `${event.clientY - 22}px`,
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.9)',
        background: 'rgba(255,255,255,0.25)',
        pointerEvents: 'none',
        zIndex: '2147483647',
      })
      document.documentElement.append(ripple)
      ripple
        .animate(
          [
            { transform: 'scale(0.6)', opacity: 1 },
            { transform: 'scale(1.5)', opacity: 0 },
          ],
          {
            duration: 600,
            easing: 'ease-out',
          },
        )
        .finished.then(() => {
          ripple.remove()
        })
    },
    true,
  )

  const scrollerOf = (start, axis = 'y') => {
    let element = start
    while (element) {
      const style = getComputedStyle(element)
      const scrolls =
        axis === 'x'
          ? element.scrollWidth > element.clientWidth && /(auto|scroll)/.test(style.overflowX)
          : element.scrollHeight > element.clientHeight && /(auto|scroll)/.test(style.overflowY)
      if (scrolls) return element
      element = element.parentElement
    }
    return document.scrollingElement
  }

  window.showcase = {
    scrollerAt: (axis) =>
      scrollerOf(document.elementFromPoint(innerWidth / 2, innerHeight / 2), axis),
    scrollerOf,
    /** The mark that says "here comes a tap": a big pulsing yellow target, before the ripple. */
    aim: (x, y, duration) =>
      new Promise((done) => {
        const target = document.createElement('div')
        Object.assign(target.style, {
          position: 'fixed',
          left: `${x - 34}px`,
          top: `${y - 34}px`,
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          border: '5px solid #facc15',
          background: 'rgba(250,204,21,0.3)',
          boxShadow: '0 0 0 4px rgba(0,0,0,0.55), 0 0 24px 6px rgba(250,204,21,0.8)',
          pointerEvents: 'none',
          zIndex: '2147483647',
        })
        document.documentElement.append(target)
        const pulse = target.animate(
          [
            { transform: 'scale(1.35)' },
            { transform: 'scale(0.85)' },
            { transform: 'scale(1.35)' },
          ],
          { duration: 600, iterations: Infinity, easing: 'ease-in-out' },
        )
        setTimeout(() => {
          pulse.cancel()
          target.remove()
          done()
        }, duration)
      }),
    glide: (scroller, distance, duration, axis = 'y') =>
      new Promise((done) => {
        const property = axis === 'x' ? 'scrollLeft' : 'scrollTop'
        const from = scroller[property]
        const begin = performance.now()
        const step = (now) => {
          const progress = Math.min(1, (now - begin) / duration)
          const eased = progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2
          scroller[property] = from + distance * eased
          if (progress < 1) requestAnimationFrame(step)
          else done()
        }
        requestAnimationFrame(step)
      }),
  }
}

export const prepare = (context) => context.addInitScript(inPage)

export const beat = (page, ms = 800) => page.waitForTimeout(ms)

/** Scrolls what is under the middle of the screen, smoothly, down or sideways (`axis` 'x'). */
export function scroll(page, distance, ms = 900, axis = 'y') {
  return page.evaluate(
    ([distance, ms, axis]) =>
      window.showcase.glide(window.showcase.scrollerAt(axis), distance, ms, axis),
    [distance, ms, axis],
  )
}

/** Brings the element to the middle of its list, smoothly, unless it is already well in view. */
export function reveal(locator, ms = 700) {
  return locator.evaluate((element, ms) => {
    const scroller = window.showcase.scrollerOf(element.parentElement)
    const box = element.getBoundingClientRect()
    const area =
      scroller === document.scrollingElement
        ? { top: 0, height: innerHeight }
        : scroller.getBoundingClientRect()
    const offset = box.top + box.height / 2 - (area.top + area.height / 2)
    if (Math.abs(offset) < area.height * 0.3) return undefined
    return window.showcase.glide(scroller, offset, ms)
  }, ms)
}

/** Shows where the next tap or press will be, for a moment, so that the viewer sees it coming. */
function aim(page, point, ms = 800) {
  return page.evaluate(([x, y, ms]) => window.showcase.aim(x, y, ms), [point.x, point.y, ms])
}

/** A tap: the element comes into view, it is marked for a moment, and then it is pressed. */
export async function tap(page, locator, after = 800) {
  await reveal(locator)
  await aim(page, await centerOf(locator))
  await locator.click()
  await beat(page, after)
}

/** Types like a person: the field is tapped, and then the text comes letter by letter. */
export async function write(page, locator, text, after = 500) {
  await tap(page, locator, 200)
  await locator.pressSequentially(text, { delay: 90 })
  await beat(page, after)
}

/** For the fields that take the whole value at once, like the times. */
export async function fillIn(page, locator, text, after = 600) {
  await tap(page, locator, 200)
  await locator.fill(text)
  await beat(page, after)
}

/** Opens a menu of options and taps one of them. */
export async function choose(page, combobox, option) {
  await tap(page, combobox, 600)
  await tap(page, page.getByRole('option', { name: option, exact: true }), 800)
}

/** The play button over the middle of the screen, for the poster of the video. */
export function playButton(page, shown = true) {
  return page.evaluate((shown) => {
    document.getElementById('showcase-play')?.remove()
    if (!shown) return
    const button = document.createElement('div')
    button.id = 'showcase-play'
    Object.assign(button.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      width: '110px',
      height: '110px',
      boxSizing: 'border-box',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.7)',
      border: '5px solid white',
      zIndex: '2147483647',
    })
    const triangle = document.createElement('div')
    Object.assign(triangle.style, {
      position: 'absolute',
      left: '31px',
      top: '22px',
      borderStyle: 'solid',
      borderWidth: '28px 0 28px 46px',
      borderColor: 'transparent transparent transparent white',
    })
    button.append(triangle)
    document.documentElement.append(button)
  }, shown)
}

/** A finger on the screen, for the gestures that the mouse cannot make (the long press). */
export async function finger(page) {
  const client = await page.context().newCDPSession(page)
  const send = (type, point) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y }] : [],
    })
  return {
    /** Presses and holds at the point, as long as it takes for the long press to open a menu. */
    async hold(point, ms = 1000) {
      await aim(page, point)
      await send('touchStart', point)
      await page.waitForTimeout(ms)
      await send('touchEnd')
    },
    /** Lets go: the end of a drag that was left in the air (`drag` with `letGo` false). */
    release: () => send('touchEnd'),
    /** Presses, waits for the long press to pick the element up, and drags it to the point. */
    async drag(from, to, letGo = true) {
      await aim(page, from)
      await send('touchStart', from)
      await page.waitForTimeout(700)
      await send('touchMove', { x: from.x + 4, y: from.y + 10 })
      const steps = 24
      for (let step = 1; step <= steps; step++) {
        await send('touchMove', {
          x: from.x + 4 + ((to.x - from.x - 4) * step) / steps,
          y: from.y + 10 + ((to.y - from.y - 10) * step) / steps,
        })
        await page.waitForTimeout(35)
      }
      await page.waitForTimeout(400)
      if (letGo) await send('touchEnd')
    },
  }
}

export async function centerOf(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('This element is not on the screen')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
