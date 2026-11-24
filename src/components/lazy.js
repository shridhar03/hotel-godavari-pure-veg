/**
 * Run `mount` once when `el` comes within ~1 viewport of the screen.
 * Used to code-split and lazily start the heavier 3D scenes.
 */
export function lazyMount(el, mount, rootMargin = '600px 0px') {
  let done = false;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting || done) return;
      done = true;
      io.disconnect();
      Promise.resolve(mount()).catch((err) => console.warn('[lazyMount]', err));
    },
    { rootMargin },
  );
  io.observe(el);
}
