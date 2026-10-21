import type { SimEvent } from './types';

/**
 * Simulation event sink. The sim pushes events each tick; consumers (renderer,
 * audio, announcer, AI) drain them after stepping. Kept as a plain queue rather than
 * subscriptions so the sim stays deterministic and side-effect free.
 */
export class EventQueue {
  private events: SimEvent[] = [];

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Returns all pending events and clears the queue. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
