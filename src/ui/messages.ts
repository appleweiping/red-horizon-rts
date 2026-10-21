/** Screen message ticker (top-left): stacked lines that fade out. */
export class Messages {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.className = 'messages';
  }

  push(text: string, color = '#d8e6c8', ttlMs = 6000): void {
    const line = document.createElement('div');
    line.className = 'message-line';
    line.textContent = text;
    line.style.color = color;
    this.el.appendChild(line);
    while (this.el.children.length > 6) this.el.removeChild(this.el.children[0]);
    setTimeout(() => {
      line.classList.add('fade');
      setTimeout(() => line.remove(), 900);
    }, ttlMs);
  }

  /** Big centered warning (superweapons). */
  warn(text: string): void {
    const w = document.createElement('div');
    w.className = 'message-warning';
    w.textContent = text;
    document.body.appendChild(w);
    setTimeout(() => {
      w.classList.add('fade');
      setTimeout(() => w.remove(), 900);
    }, 3500);
  }

  clear(): void {
    this.el.replaceChildren();
  }
}
