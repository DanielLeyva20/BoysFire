import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { OperatorSession } from '../state/operator-session';

const OPS_PREFIX = '/api/ops/';
const HEADER = 'X-Operator-Key';

/** Agrega la clave del operador solo a las rutas de operación; el resto de la API es pública. */
export const operatorKeyInterceptor: HttpInterceptorFn = (request, next) => {
  const key = inject(OperatorSession).key();
  if (!key || !request.url.startsWith(OPS_PREFIX)) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { [HEADER]: key } }));
};
