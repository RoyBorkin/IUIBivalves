// ─────────────────────────────────────────────────────────────
//  Badges for the six marker floats, and the mission logo.
//  Each badge is a small SVG (viewBox 0 0 64 64) drawn in flat colours,
//  so it reads the same in the map labels, the panel, the slides and the satellite map.
// ─────────────────────────────────────────────────────────────

const eye = (x, y, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1B2F45" stroke-width="1.2"/><circle cx="${x + r * 0.25}" cy="${y}" r="${r * 0.45}" fill="#1B2F45"/>`;

const ART = {
  shark: `
    <path d="M9 22l8 11-8 10 4-10z" fill="#8E95A6" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 33c6-8 18-11 30-8 6 1 10 4 12 8-4 4-11 6-20 6-9 0-16-2-22-6z" fill="#9AA1B2" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17 35c8 3 22 4 37-1-3 3-10 5-18 5-8 0-14-2-19-4z" fill="#E9EBF1"/>
    <path d="M30 26l4-11 6 11z" fill="#8E95A6" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M33 37l-3 8 8-6z" fill="#8E95A6" stroke="#1B2F45" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M45 37l2 1.5 2-1.5 2 1.5" fill="none" stroke="#1B2F45" stroke-width="1.1" stroke-linecap="round"/>
    ${eye(47, 30, 2.4)}`,
  dolphin: `
    <path d="M10 27c3 3 4 5 4 8-3 2-6 3-8 3 3-2 4-5 4-11z" fill="#5A7FD8" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M13 34c4-9 17-13 29-10 5 1 8 3 10 6l6 2c-1 2-3 2-6 2-4 4-12 6-21 5-8-1-14-3-18-5z" fill="#5E84DC" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M18 37c7 3 17 4 26 1 3-1 6-2 8-3-4 4-12 6-20 5-6 0-11-1-14-3z" fill="#B7C8F2"/>
    <path d="M29 25c1-5 4-9 9-10-2 4-2 7-1 10z" fill="#4F72C8" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M34 38l-4 7 9-5z" fill="#4F72C8" stroke="#1B2F45" stroke-width="1.4" stroke-linejoin="round"/>
    ${eye(46, 30, 2.2)}`,
  clownfish: `
    <path d="M10 22c5 3 7 7 7 10s-2 7-7 10c1-4 1-7 1-10s0-6-1-10z" fill="#F27A1C" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <ellipse cx="34" cy="32" rx="19" ry="13" fill="#F57E1E" stroke="#1B2F45" stroke-width="1.6"/>
    <path d="M24 20.5c-2.6 7-2.6 15.5 0 23" fill="none" stroke="#fff" stroke-width="5"/>
    <path d="M24 20.5c-2.6 7-2.6 15.5 0 23" fill="none" stroke="#1B2F45" stroke-width="7" stroke-opacity=".0"/>
    <path d="M40 19.5c2.2 7 2.2 18 0 25" fill="none" stroke="#fff" stroke-width="5"/>
    <path d="M28 19.6c3-5 9-6 13-3" fill="#F57E1E" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M33 44c1 4 4 6 7 6-1-3-2-5-2-7z" fill="#F57E1E" stroke="#1B2F45" stroke-width="1.4" stroke-linejoin="round"/>
    ${eye(46, 29, 3.2)}
    <path d="M51 35c-1 1-2 1.5-3 1.5" fill="none" stroke="#1B2F45" stroke-width="1.2" stroke-linecap="round"/>`,
  octopus: `
    <path d="M18 38c-6 3-7 9-3 11M24 41c-3 4-3 10 1 12M32 42c0 5 1 9 4 11M40 41c3 4 4 9 1 12M46 38c5 3 7 8 4 11" fill="none" stroke="#1B2F45" stroke-width="6.4" stroke-linecap="round"/>
    <path d="M18 38c-6 3-7 9-3 11M24 41c-3 4-3 10 1 12M32 42c0 5 1 9 4 11M40 41c3 4 4 9 1 12M46 38c5 3 7 8 4 11" fill="none" stroke="#E64AAE" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M14 30c0-11 8-19 18-19s18 8 18 19c0 8-6 13-18 13s-18-5-18-13z" fill="#EA4FB3" stroke="#1B2F45" stroke-width="1.6"/>
    <circle cx="23" cy="20" r="2.2" fill="#F7A6D8"/><circle cx="40" cy="18" r="1.8" fill="#F7A6D8"/><circle cx="44" cy="25" r="1.4" fill="#F7A6D8"/>
    ${eye(26, 30, 3)}${eye(38, 30, 3)}
    <path d="M30 36c1.3 1 2.7 1 4 0" fill="none" stroke="#1B2F45" stroke-width="1.2" stroke-linecap="round"/>`,
  whale: `
    <path d="M17 33c-4-1-7-4-8-8 2-3 5-4 7-3 0 3 1 5 3 7z" fill="#2F60D2" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17 33c-2 4-5 6-9 6 0-3 2-6 5-7z" fill="#2F60D2" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M15 33c1-9 10-15 22-15 11 0 18 6 18 14 0 8-8 12-20 12-11 0-19-4-20-11z" fill="#3165D8" stroke="#1B2F45" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M28 36c8 2 17 2 26-2-1 6-8 9-19 9-3 0-5 0-7-1z" fill="#F4F7FB" stroke="#1B2F45" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M34 37.4v4.4M38.5 37.8v4.6M43 37.6v4.4M47.5 37v4" stroke="#1B2F45" stroke-width="1" stroke-linecap="round"/>
    <path d="M38 17c-1-3 0-5 2-6M38 17c1-3 3-4 5-4" fill="none" stroke="#7FB2F0" stroke-width="1.6" stroke-linecap="round"/>
    ${eye(45, 28, 2.6)}`,
  turtle: `
    <path d="M22 22c-6-6-12-6-14-3 2 4 8 6 14 7zM42 22c6-6 12-6 14-3-2 4-8 6-14 7zM23 42c-4 4-6 9-4 11 4-1 7-5 8-9zM41 42c4 4 6 9 4 11-4-1-7-5-8-9z" fill="#8C8A2E" stroke="#1B2F45" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="11.5" rx="5.6" ry="6" fill="#8C8A2E" stroke="#1B2F45" stroke-width="1.6"/>
    ${eye(29.4, 10.5, 1.6)}${eye(34.6, 10.5, 1.6)}
    <path d="M31 50l1 6 1-6z" fill="#8C8A2E" stroke="#1B2F45" stroke-width="1.2" stroke-linejoin="round"/>
    <ellipse cx="32" cy="33" rx="14" ry="17" fill="#2E7D4A" stroke="#1B2F45" stroke-width="1.6"/>
    <path d="M32 24l6 3.5v7L32 38l-6-3.5v-7z" fill="#3F9A5E" stroke="#9AD3A6" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M32 24v-7M38 27.5l6-4M38 34.5l6 4M32 38v8M26 34.5l-6 4M26 27.5l-6-4" stroke="#9AD3A6" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="32" cy="33" rx="14" ry="17" fill="none" stroke="#C9C26A" stroke-width="1.4" stroke-dasharray="3 2.4"/>`,
};

// soft badge backgrounds that match each float, and the glow colour of its light stick
export const BADGE_BG = { shark: '#E4E7EE', dolphin: '#DCE5FA', clownfish: '#FDE6D2', octopus: '#FBDDF0', whale: '#D9E3FA', turtle: '#DDEEDB' };

export function badgeSVG(kind, { size = 40, label = '', ring = null } = {}) {
  const art = ART[kind] || '';
  const bg = BADGE_BG[kind] || '#EEE';
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 64 64" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <circle cx="32" cy="32" r="30" fill="${bg}" stroke="${ring || '#1B2F45'}" stroke-width="${ring ? 3 : 1.6}"/>
    <g transform="translate(0 0)">${art}</g></svg>`;
}

// mission logo: a coral head with a bivalve's two siphons and the fluorescein jet
export function logoSVG({ size = 48, label = '' } = {}) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs><clipPath id="lgc"><circle cx="32" cy="32" r="30"/></clipPath></defs>
    <circle cx="32" cy="32" r="30" fill="#14304A"/>
    <g clip-path="url(#lgc)">
      <path d="M2 64V50c6-14 16-22 30-22s24 8 30 22v14z" fill="#F1E3DA"/>
      <g fill="#DCC1B4"><circle cx="14" cy="50" r="2.2"/><circle cx="21" cy="42" r="2.2"/><circle cx="43" cy="42" r="2.2"/><circle cx="50" cy="50" r="2.2"/><circle cx="25" cy="53" r="2"/><circle cx="40" cy="54" r="2"/><circle cx="32" cy="58" r="1.8"/><circle cx="11" cy="59" r="1.8"/><circle cx="53" cy="59" r="1.8"/></g>
      <path d="M28.6 40.6a2.4 2.4 0 1 1 3.2 1.4 2.4 2.4 0 1 1 3.2 2.6" fill="none" stroke="#3B2A22" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M35 43.2c3-8 8-14 17-17" fill="none" stroke="#C8F04B" stroke-width="3" stroke-linecap="round"/>
      <path d="M35 43.2c3-8 8-14 17-17" fill="none" stroke="#F4FFB0" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="52.5" cy="26" r="2.6" fill="#C8F04B"/>
      <path d="M12 20c3-2 5-2 8 0s5 2 8 0" fill="none" stroke="#6CB2CF" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
    </g>
  </svg>`;
}
