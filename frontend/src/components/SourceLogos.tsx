import hhLogo from '../../../assets/HeadHunter_logo.png';
import rabotaLogo from '../../../assets/Logo_blue@3x.png';
import superjobLogo from '../../../assets/SuperJob_Light.png';
import remoteOkLogo from '../../../assets/remote-ok-icon-filled-256.webp';
import wwrLogo from '../../../assets/wwr-logo-freelogovectors.net_.webp';

export function SourceLogos() {
  const items: Array<{ src: string; alt: string; heightClass: string }> = [
    { src: hhLogo, alt: 'HH.ru', heightClass: 'h-7 sm:h-8' },
    { src: rabotaLogo, alt: 'Rabota.ru', heightClass: 'h-7 sm:h-8' },
    { src: superjobLogo, alt: 'SuperJob', heightClass: 'h-7 sm:h-8' },
    { src: remoteOkLogo, alt: 'RemoteOK', heightClass: 'h-8 sm:h-9' },
    { src: wwrLogo, alt: 'We Work Remotely', heightClass: 'h-14 sm:h-16' },
  ];

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((it) => (
          <div
            key={it.alt}
            className="inline-flex items-center justify-center rounded-md border border-input/60 bg-muted/40 px-2 py-1"
          >
            <img
              src={it.src}
              alt={it.alt}
              title={it.alt}
              loading="lazy"
              className={`${it.heightClass} w-auto object-contain opacity-90 transition hover:opacity-100`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
