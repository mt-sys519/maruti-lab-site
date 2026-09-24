/* eslint-disable @next/next/no-img-element -- a fixed small label, served as is */

// A RETRO cartridge. The label is the square illustration as it was drawn (1:1, after the
// Game Boy labels) and is never cropped: the cartridge is built around it, the grip above
// and the arrow below. Without a label it is a blank one, still to come.
export function RetroCart({ label, alt, soon }: { label?: string; alt?: string; soon?: string }) {
  return (
    <div className={label ? "rtCart" : "rtCart rtCartBlank"}>
      <div className="rtCartBody">
        <div className="rtCartGrip" />
      </div>
      <div className="rtCartLabel">
        {label ? (
          <img src={label} alt={alt ?? ""} width={600} height={600} />
        ) : (
          <>
            <span className="rtCartQ">?</span>
            <span className="rtCartSoon">{soon}</span>
          </>
        )}
      </div>
      <span className="rtCartArrow" aria-hidden="true">
        ▼
      </span>
    </div>
  );
}
