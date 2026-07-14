import hhLogo from '../../../assets/HeadHunter_logo.png';
import rabotaLogo from '../../../assets/Logo_blue@3x.png';
import superjobLogo from '../../../assets/SuperJob_Light.png';
import remoteOkLogo from '../../../assets/remote-ok-icon-filled-256.webp';
import wwrLogo from '../../../assets/wwr-logo-freelogovectors.net_.webp';
import djinniLogo from '../../../assets/djinni.png';
import fourDayWeekLogo from '../../../assets/Four-Day-Week-Logo_Pink.png';

export function SourceLogos() {
  const items: Array<{ src: string; alt: string; heightClass: string }> = [
    { src: hhLogo, alt: 'HH.ru', heightClass: 'h-7 sm:h-8' },
    { src: rabotaLogo, alt: 'Rabota.ru', heightClass: 'h-7 sm:h-8' },
    { src: superjobLogo, alt: 'SuperJob', heightClass: 'h-7 sm:h-8' },
    { src: remoteOkLogo, alt: 'RemoteOK', heightClass: 'h-8 sm:h-9' },
    { src: wwrLogo, alt: 'We Work Remotely', heightClass: 'h-14 sm:h-16' },
    { src: djinniLogo, alt: 'Djinni', heightClass: 'h-7 sm:h-8' },
    { src: fourDayWeekLogo, alt: '4DayWeek', heightClass: 'h-7 sm:h-8' },
  ];

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        {items.map((it) => (
          <img
            key={it.alt}
            src={it.src}
            alt={it.alt}
            title={it.alt}
            loading="lazy"
            className={`${it.heightClass} w-auto object-contain opacity-80 transition hover:opacity-100`}
          />
        ))}
      </div>
    </div>
  );
}
