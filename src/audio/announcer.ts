/**
 * Battlefield announcer built on the browser's SpeechSynthesis.
 * Repeated cues are throttled so it never spams.
 */
export class Announcer {
  enabled = true;
  private lastSpoken = new Map<string, number>();
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => v.lang.startsWith('en')) ?? null;
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

/** Announcer lines (the important ones are also shown in the message ticker). */
export const VOICE_LINES = {
  matchStart: 'Command link up.',
  constructionComplete: 'Structure ready for placement.',
  unitReady: 'Unit standing by.',
  insufficientFunds: 'Not enough credits.',
  lowPower: 'Power grid overloaded.',
  powerRestored: 'Power grid stable.',
  baseUnderAttack: 'Hostiles at the base.',
  forcesUnderAttack: 'Our units are taking fire.',
  unitLost: 'We lost a unit.',
  unitPromoted: 'Veteran rank earned.',
  buildingCaptured: 'Structure taken.',
  buildingLost: 'We lost a structure.',
  nukeWarning: 'Missile launch detected. Brace.',
  stormWarning: 'Ion storm building.',
  superweaponReady: (name: string) => `${name} charged.`,
  playerDefeated: 'An enemy commander is out.',
  defeat: 'Our last base has fallen.',
  victory: 'The field is ours.',
  radarOnline: 'Radar up.',
  radarOffline: 'Radar down.',
} as const;
