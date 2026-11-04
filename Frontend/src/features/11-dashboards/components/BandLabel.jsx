/**
 * A performance band, always as a colour dot with its name, so the colour never carries the meaning alone.
 */
const BandLabel = ({ band, className = '' }) => {
  if (!band) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-foreground ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: band.color }} aria-hidden="true" />
      {band.name}
    </span>
  );
};

export default BandLabel;
