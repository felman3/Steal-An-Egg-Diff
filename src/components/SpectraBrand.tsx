export function SpectraBrand({ className = '' }: { className?: string }) {
  return (
    <div className={`spectra-brand ${className}`} data-testid="spectra-brand">
      <img
        className="spectra-brand-logo"
        src={`${import.meta.env.BASE_URL}spectra-logo.png`}
        width={1309}
        height={1202}
        alt=""
        fetchPriority="high"
      />
      <span className="spectra-brand-type">
        <span className="spectra-wordmark">SPECTR<span>A</span></span>
        <span className="spectra-tagline">Insight Beyond Numbers</span>
      </span>
    </div>
  );
}
