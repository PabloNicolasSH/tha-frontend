import { gsap } from 'gsap';

/**
 * Movimiento de Tha. Todos los valores salen de los tokens de brand/tokens.css:
 * entradas de 400 ms con ease-out y escalonado de 70 ms. Solo transform y opacidad.
 * Con prefers-reduced-motion no se anima nada y el contenido aparece directamente.
 */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Entrada escalonada de los elementos hijos. Si el script falla, el contenido ya es visible (animación "from"). */
export function rise(targets: gsap.TweenTarget, delay = 0): void {
  if (reduced()) return;
  gsap.from(targets, {
    y: 20,
    opacity: 0,
    duration: 0.5,
    ease: 'power3.out',
    stagger: 0.07,
    delay,
    clearProps: 'transform,opacity',
  });
}

/** Sacudida corta para un error de formulario (con cue estático: el mensaje de error sigue ahí). */
export function nudge(target: gsap.TweenTarget): void {
  if (reduced()) return;
  gsap.fromTo(target, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)', clearProps: 'transform' });
}
