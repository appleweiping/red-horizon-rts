/**
 * EVA-style battlefield announcer built on the browser's SpeechSynthesis.
 * Phrases are original; repeated cues are throttled so she never spams.
 */
export class Eva {
  enabled = true;
  private lastSpoken = new Map<string, number>();
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang.startsWith('en') && /female|zira|aria|jenny/i.test(v.name)) ??
          voices.find((v) => v.lang.startsWith('en')) ??
          null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  say(phrase: string, priority = false): void {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    const now = performance.now();
    const last = this.lastSpoken.get(phrase) ?? 0;
    if (now - last < 5000) return;
    this.lastSpoken.set(phrase, now);
    if (priority) speechSynthesis.cancel();
    else if (speechSynthesis.pending) return; // don't stack a backlog
    const u = new SpeechSynthesisUtterance(phrase);
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = 0.9;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  }
}

/** Canonical announcer lines (also shown in the message ticker). */
export const EVA_LINES = {
  constructionComplete: 'Construction complete.',
  unitReady: 'Unit ready.',
  insufficientFunds: 'Insufficient funds.',
  lowPower: 'Low power.',
  powerRestored: 'Power restored.',
  baseUnderAttack: 'Our base is under attack.',
  forcesUnderAttack: 'Our forces are under attack.',
  unitLost: 'Unit lost.',
  unitPromoted: 'Unit promoted.',
  buildingCaptured: 'Structure captured.',
  buildingLost: 'Structure lost.',
  nukeWarning: 'Warning: ballistic missile launch detected.',
  stormWarning: 'Warning: ion storm forming.',
  superweaponReady: (name: string) => `${name} ready.`,
  playerDefeated: 'Enemy commander eliminated.',
  defeat: 'Command network severed. We have lost.',
  victory: 'All hostile forces eliminated. Victory.',
  radarOnline: 'Radar systems online.',
  radarOffline: 'Radar systems offline.',
} as const;
