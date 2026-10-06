// Hand-drawn style line icons (48x48). Each has a soft offset "shadow" copy of its outline
// underneath, echoing the sticker-like icons on the reference site.
const STROKE = 'fill="#fff" stroke="#333" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

function icon(shape, details = "") {
  return `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <g transform="translate(2 3)" fill="#00000033" stroke="none">${shape}</g>
      <g ${STROKE}>${shape}</g>
      <g fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${details}</g>
    </svg>`;
}

export const icons = {
  about: icon(
    `<path d="M24 6C13 6 5 13 5 22c0 5 2.5 9 6.5 11.5L9 41l9-5c2 .5 4 .8 6 .8 11 0 19-7 19-15.5S35 6 24 6z"/>`,
    `<circle cx="24" cy="14.5" r="1.6" fill="#333"/><path d="M21.5 20h3v10M21 30h6"/>`
  ),
  tips: icon(
    `<path d="M24 6C13 6 5 13 5 22c0 5 2.5 9 6.5 11.5L9 41l9-5c2 .5 4 .8 6 .8 11 0 19-7 19-15.5S35 6 24 6z"/>`,
    `<path d="M19.5 16.5c0-3 2-5 4.5-5s4.5 1.8 4.5 4.3c0 3.7-4.5 4-4.5 7.7"/><circle cx="24" cy="29" r="1.6" fill="#333"/>`
  ),
  skills: icon(
    `<path d="M31 6a9 9 0 0 0-8.5 12L7 33.5a4 4 0 0 0 5.6 5.6L28 23.5A9 9 0 0 0 40 14l-5.5 5.5-5-1-1-5L34 8a9 9 0 0 0-3-2z"/>`,
    `<circle cx="10.5" cy="36" r="1" fill="#333"/>`
  ),
  projects: icon(
    `<path d="M4 13c0-1.5 1-2.5 2.5-2.5h11l4 4H41c1.5 0 2.5 1 2.5 2.5v20c0 1.5-1 2.5-2.5 2.5H6.5C5 39.5 4 38.5 4 37z"/>`,
    `<path d="M4 20.5h39.5"/>`
  ),
  resume: icon(
    `<path d="M10 4h20l9 9v29c0 1-1 2-2 2H10c-1 0-2-1-2-2V6c0-1 1-2 2-2z"/>`,
    `<path d="M30 4v9h9M14 20h18M14 26h18M14 32h12"/>`
  ),
  contact: icon(
    `<rect x="4" y="11" width="40" height="28" rx="2.5"/>`,
    `<path d="M5 13l19 14 19-14M5 37l14-12M43 37L29 25"/>`
  ),
};
