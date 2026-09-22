// The mark on every MarutiBit sound switch. It used to be three bars rising
// and falling on a loop, which reads as a meter - as if something were
// playing right now. Only AVENUE plays anything continuously, and AVENUE does
// not use this switch: the other eight make a noise when you touch them and
// are silent the rest of the time, so a meter was telling the truth roughly
// never. A speaker says the same thing a switch needs to say, and says it
// standing still. The waves are there when the sound is on and gone when it
// is off, which is the one thing about it that should change.
export function SoundMark() {
  return (
    <svg className="bitSoundMark" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path className="bitSoundCone" d="M1.5 4.5h2L6.2 2.2v7.6L3.5 7.5h-2z" />
      <path className="bitSoundWave" d="M8 4.4a2.5 2.5 0 0 1 0 3.2" />
      <path className="bitSoundWave" d="M9.7 3a4.6 4.6 0 0 1 0 6" />
    </svg>
  );
}
