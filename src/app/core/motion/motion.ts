import { gsap } from 'gsap';

/**
 * Movimiento de Tha. Todos los valores salen de los tokens de brand/tokens.css:
 * entradas de 400 ms con ease-out y escalonado de 70 ms. Solo transform y opacidad.
 * Con prefers-reduced-motion (o si no se puede saber, p. ej. en los tests) no se anima nada
 * y el contenido aparece o desaparece directamente.
 */
const reduced = () => typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** Aparición de un diálogo o aviso: sube unos píxeles y se hace visible (--dur-slow, ease-out). */
export function enter(target: gsap.TweenTarget, from: { y?: number; scale?: number } = {}): void {
  if (reduced()) return;
  gsap.fromTo(
    target,
    { opacity: 0, y: from.y ?? 16, scale: from.scale ?? 0.97 },
    { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' },
  );
}

/**
 * Salida más suave que la entrada (--dur-base). Devuelve una promesa que se cumple al terminar.
 * Lleva un plazo máximo de seguridad: si el navegador pausa las animaciones (pestaña en segundo plano),
 * el elemento no se queda atascado en pantalla.
 */
export function leave(target: gsap.TweenTarget): Promise<void> {
  if (reduced()) return Promise.resolve();
  return new Promise((resolve) => {
    const safety = setTimeout(resolve, 500);
    gsap.to(target, {
      opacity: 0,
      y: 8,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        clearTimeout(safety);
        resolve();
      },
    });
  });
}
