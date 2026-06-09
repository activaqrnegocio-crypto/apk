import { Plugin, PluginMethod, JSObject } from '@capacitor/core';

/**
 * Plugin nativo para leer pending navigation desde archivo JSON.
 * Este plugin es implementado en Android (PendingNavPlugin.java).
 */
export interface PendingNavResult {
  url?: string;
  tag?: string;
}

export class PendingNavPlugin extends Plugin {
  /**
   * Lee y elimina el pending navigation desde el archivo JSON.
   * El archivo es escrito por MainActivity cuando se toca una notificación.
   */
  @PluginMethod
  async getAndClearPendingNav(): Promise<PendingNavResult> {
    const call = this.getInstance();
    // This will call the native Android method
    const result = await (call as any).getAndClearPendingNav();
    return result as PendingNavResult;
  }
}