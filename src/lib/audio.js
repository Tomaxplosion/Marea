export function playTimerCompletionSound(audioContext) {
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => playTimerCompletionSound(audioContext)).catch(() => {});
    return;
  }
  if (audioContext.state !== 'running') return;

  [
    { frequency: 587.33, delay: 0 },
    { frequency: 783.99, delay: 0.16 }
  ].forEach(({ frequency, delay }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.075, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.82);
  });
}

export function playNoteKeySound(audioContext) {
  if (!audioContext || audioContext.state !== 'running') return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(195 + Math.random() * 35, now);
  oscillator.frequency.exponentialRampToValueAtTime(125, now + 0.06);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.065);
}
