import { Signal, linkedSignal } from '@angular/core';

interface LoadingValue<T> {
  value: Signal<T>;
  isLoading: Signal<boolean>;
}

/**
 * Valor de un recurso que no parpadea: mientras llega una respuesta nueva conserva la
 * anterior, en lugar de vaciarse. Así la pantalla cambia de un estado completo a otro.
 */
export function settled<T>(resource: LoadingValue<T>): Signal<T> {
  return linkedSignal<{ value: T; loading: boolean }, T>({
    source: () => ({ value: resource.value(), loading: resource.isLoading() }),
    computation: (current, previous) => (current.loading && previous ? previous.value : current.value),
  });
}
