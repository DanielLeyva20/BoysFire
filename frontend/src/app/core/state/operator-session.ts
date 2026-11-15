import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'boysfire.operatorKey';

/**
 * Clave del operador de la sesión. Se guarda en sessionStorage: dura mientras la pestaña
 * esté abierta y no queda en el equipo al cerrarla.
 */
@Injectable({ providedIn: 'root' })
export class OperatorSession {
  private readonly storedKey = signal<string | null>(readStored());

  readonly key = this.storedKey.asReadonly();
  readonly signedIn = computed(() => this.storedKey() !== null);

  signIn(key: string): void {
    const clean = key.trim();
    this.storedKey.set(clean);
    try {
      sessionStorage.setItem(STORAGE_KEY, clean);
    } catch {
      // Sin almacenamiento (modo privado estricto): la clave vive solo en memoria.
    }
  }

  signOut(): void {
    this.storedKey.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nada que borrar.
    }
  }
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
