/**
 * AnimatedRouteGraphic - Decorative SVG flight-path animation shown to
 * unauthenticated users on the home page. Purely visual, no interactivity.
 */
"use client";

export default function AnimatedRouteGraphic() {
  return (
    <section className="glass bg-warmSurface rounded-2xl overflow-hidden">
      <style>{`
        @keyframes naviaDrawPath {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes naviaFlowDash {
          from { stroke-dashoffset: 0.12; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes naviaPulseRing {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes naviaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .navia-path-draw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }
        .navia-p1 { animation: naviaDrawPath 1.4s ease-out 0.3s forwards; }
        .navia-p2 { animation: naviaDrawPath 1.6s ease-out 1.5s forwards; }
        .navia-p3 { animation: naviaDrawPath 1.8s ease-out 2.9s forwards; }

        .navia-flow {
          stroke-dasharray: 0.05 0.07;
          stroke-dashoffset: 0.05;
          opacity: 0;
        }
        .navia-f1 { animation: naviaFlowDash 1s linear 1.7s infinite, naviaFadeIn 0.3s ease-out 1.7s forwards; }
        .navia-f2 { animation: naviaFlowDash 1s linear 3.1s infinite, naviaFadeIn 0.3s ease-out 3.1s forwards; }
        .navia-f3 { animation: naviaFlowDash 1s linear 4.7s infinite, naviaFadeIn 0.3s ease-out 4.7s forwards; }

        .navia-ring {
          fill: none;
          stroke: rgb(75,134,180);
          stroke-width: 1.5px;
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
        }
        .navia-r1 { animation: naviaPulseRing 2s ease-out 0.3s infinite; }
        .navia-r2 { animation: naviaPulseRing 2s ease-out 1.5s infinite; }
        .navia-r3 { animation: naviaPulseRing 2s ease-out 2.9s infinite; }
        .navia-r4 { animation: naviaPulseRing 2s ease-out 4.7s infinite; }

        .navia-dot  { opacity: 0; }
        .navia-d1   { animation: naviaFadeIn 0.4s ease-out 0.3s  forwards; }
        .navia-d2   { animation: naviaFadeIn 0.4s ease-out 1.5s  forwards; }
        .navia-d3   { animation: naviaFadeIn 0.4s ease-out 2.9s  forwards; }
        .navia-d4   { animation: naviaFadeIn 0.4s ease-out 4.7s  forwards; }

        .navia-label {
          opacity: 0;
          font-family: system-ui, sans-serif;
        }
        .navia-l1 { animation: naviaFadeIn 0.4s ease-out 0.5s forwards; }
        .navia-l2 { animation: naviaFadeIn 0.4s ease-out 1.7s forwards; }
        .navia-l3 { animation: naviaFadeIn 0.4s ease-out 3.1s forwards; }
        .navia-l4 { animation: naviaFadeIn 0.4s ease-out 4.9s forwards; }

        .navia-flight-label {
          opacity: 0;
          font-family: system-ui, sans-serif;
        }
        .navia-fl1 { animation: naviaFadeIn 0.4s ease-out 1.7s forwards; }
        .navia-fl2 { animation: naviaFadeIn 0.4s ease-out 3.1s forwards; }
        .navia-fl3 { animation: naviaFadeIn 0.4s ease-out 4.7s forwards; }

        .navia-plane { opacity: 0; animation: naviaFadeIn 0.4s ease-out 0.3s forwards; }

        .navia-grid-line { opacity: 0; animation: naviaFadeIn 1s ease-out 0.1s forwards; }
      `}</style>

      <div className="px-8 pt-8 pb-3">
        <svg viewBox="0 0 760 172" className="w-full h-48" fill="none">
          <defs>
            <pattern id="naviaGrid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="rgb(75,134,180)" fillOpacity="0.1" />
            </pattern>
            <path id="naviaFullRoute" d="M 75,135 C 112,52 183,52 218,118 C 263,28 348,28 393,80 C 474,8 590,8 658,108" />
          </defs>

          <rect width="760" height="172" fill="url(#naviaGrid)" />

          <line x1="0" y1="22"  x2="760" y2="22"  stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <line x1="0" y1="72"  x2="760" y2="72"  stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <line x1="0" y1="122" x2="760" y2="122" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />

          <path d="M 130,0 C 132,57 132,115 130,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 298,0 C 300,57 301,115 298,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 478,0 C 479,57 480,115 478,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 632,0 C 633,57 633,115 632,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />

          <circle cx="75"  cy="135" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d1" />
          <circle cx="218" cy="118" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d2" />
          <circle cx="393" cy="80"  r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d3" />
          <circle cx="658" cy="108" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d4" />

          <path d="M 75,135 C 112,52 183,52 218,118"  stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />
          <path d="M 218,118 C 263,28 348,28 393,80"  stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />
          <path d="M 393,80 C 474,8 590,8 658,108"    stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />

          <path pathLength="1" d="M 75,135 C 112,52 183,52 218,118" stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p1" />
          <path pathLength="1" d="M 218,118 C 263,28 348,28 393,80" stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p2" />
          <path pathLength="1" d="M 393,80 C 474,8 590,8 658,108"   stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p3" />

          <path pathLength="1" d="M 75,135 C 112,52 183,52 218,118" stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f1" />
          <path pathLength="1" d="M 218,118 C 263,28 348,28 393,80" stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f2" />
          <path pathLength="1" d="M 393,80 C 474,8 590,8 658,108"   stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f3" />

          <text x="147" y="56"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl1">5h 30m</text>
          <text x="306" y="36"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl2">7h</text>
          <text x="534" y="22"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl3">11h 30m</text>

          <circle cx="75"  cy="135" r="8" className="navia-ring navia-r1" />
          <circle cx="218" cy="118" r="8" className="navia-ring navia-r2" />
          <circle cx="393" cy="80"  r="8" className="navia-ring navia-r3" />
          <circle cx="658" cy="108" r="8" className="navia-ring navia-r4" />

          <circle cx="75"  cy="135" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d1" />
          <circle cx="218" cy="118" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d2" />
          <circle cx="393" cy="80"  r="5" fill="rgb(75,134,180)" className="navia-dot navia-d3" />
          <circle cx="658" cy="108" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d4" />

          <text x="75"  y="157" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l1">San Francisco</text>
          <text x="218" y="138" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l2">New York</text>
          <text x="393" y="100" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l3">London</text>
          <text x="658" y="128" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l4">Tokyo</text>

          <g className="navia-plane">
            <animateMotion dur="18s" repeatCount="indefinite" begin="0.3s" rotate="auto">
              <mpath href="#naviaFullRoute" />
            </animateMotion>
            <g transform="rotate(90)">
              <path d="M0,-7 L4.5,5 L0,2.5 L-4.5,5 Z" fill="rgb(43,65,98)" fillOpacity="0.55" />
              <ellipse rx="1.8" ry="3" cy="-2" fill="rgb(43,65,98)" fillOpacity="0.3" />
            </g>
          </g>
        </svg>
      </div>

      <p className="text-center text-xs text-black/30 pb-6 tracking-wide">
        Your journey, mapped in Navia.
      </p>
    </section>
  );
}
