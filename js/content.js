// All site text lives here. Each entry becomes a desktop icon + window.
// To add an app: add an entry with a unique id, an icon name from icons.js, and a render() that returns HTML.

export const profile = {
  name: "Dillon Woods",
  tagline: "computer engineering student @ the university of kansas",
  // Split so spam bots scanning the page source don't find a ready-made address.
  email: ["dillonw1128", "gmail.com"].join("@"),
  linkedin: "https://www.linkedin.com/in/dillon-woods-ce/",
  github: "https://github.com/CardBoardy",
};

const skills = [
  { group: "Languages", items: ["Python", "C / C++", "JavaScript", "HTML & CSS"] },
  { group: "Hardware & Embedded", items: ["Raspberry Pi", "Arduino", "UART & I2C", "Servo & motor control", "Embedded Linux", "Wireless networking", "Computer repair & diagnostics"] },
  { group: "Tools", items: ["Git & GitHub", "Fusion 360", "3D printing", "Pygame", "Gemini API"] },
  { group: "Leadership", items: ["Teaching & mentoring", "Leading teams", "Building under deadlines"] },
];

const projects = [
  {
    name: "Decryption Dungeon",
    award: "🏆 1st Place · LexisNexis Chicago Regional Hackathon",
    image: "assets/projects/decryption-dungeon.jpg",
    description: "A story-driven game that teaches kids cybersecurity: help a wizard by cracking real ciphers hidden in his spellbook.",
    highlights: [
      "Built the game engine from scratch in Pygame, with layered rendering, a typewriter dialogue system, and cinematic page-flip transitions.",
      "Caesar and null cipher puzzles with randomized messages, so every playthrough is different.",
      "Lessons on passwords, encryption, and social engineering are woven into the story.",
    ],
    tech: ["Python", "Pygame", "Cryptography", "Game design"],
    links: [
      { type: "video", url: "https://www.youtube.com/watch?v=VqNpzwEF1ZA" },
      { type: "code", url: "https://github.com/CardBoardy/Decryption-Dungeon" },
    ],
  },
  {
    name: "Disco-Bot",
    award: "🥈 Runner-Up · HackKU",
    image: "assets/projects/disco-bot.jpg",
    description: "A conversational dancing robot built in a weekend: talk to it, and it answers with AI-generated speech and dance moves.",
    highlights: [
      "Laptop handles voice + Google Gemini AI in Python, then sends commands over WiFi to a Flask server on a Raspberry Pi 5.",
      "The Pi drives an Arduino over UART, which runs the servos through a PCA9685 board on I2C, with separate servo and logic power.",
      "Designed and 3D-printed the whole body in Fusion 360.",
    ],
    tech: ["Python", "C/C++", "Flask", "Raspberry Pi 5", "Arduino", "Gemini API", "I2C", "UART", "Fusion 360"],
    links: [
      { type: "video", url: "https://www.youtube.com/watch?v=VQj63EU3lR4" },
      { type: "code", url: "https://github.com/CardBoardy/DiscoBot" },
    ],
  },
  {
    name: "3D Digital Portfolio",
    description: "This site! A three.js landing page with a spinning, draggable PC that zooms into a Windows XP–style desktop built from scratch in vanilla JS.",
    tech: ["JavaScript", "three.js", "HTML", "CSS"],
    links: [{ type: "code", url: "https://github.com/CardBoardy/DigitalPortfolio" }],
  },
];

const experience = [
  {
    role: "Supplemental Instruction Leader – EECS 168",
    org: "The University of Kansas",
    dates: "Aug 2026 – Present",
    place: "Lawrence, KS",
    bullets: [
      "Selected by faculty for outstanding academic performance in EECS 168.",
      "Plan and lead two weekly study sessions where students review material, compare notes, and work through problems together.",
      "Build students' problem-solving and exam-prep skills through active engagement rather than direct instruction.",
    ],
  },
  {
    role: "Head of Technology Repair",
    org: "Evanston Township High School",
    dates: "Jun 2024 – Aug 2024",
    place: "Evanston, IL",
    bullets: [
      "Lead technician over a team of 10–15, handling advanced hardware troubleshooting.",
      "Diagnosed and repaired complex hardware and software issues across a wide range of computers.",
      "Trained and onboarded new hires; created a more reliable setup process that cut configuration mistakes and turnaround time.",
    ],
  },
  {
    role: "Summer Camp Counselor",
    org: "Goodsports! Youth Camp",
    dates: "Jun 2021 – Aug 2023",
    place: "Evanston, IL",
    bullets: [
      "Co-managed a group of 20+ kids, keeping camp organized, safe, and fun.",
      "Taught foundational sports skills with a focus on teamwork and sportsmanship.",
    ],
  },
];

const education = [
  { school: "The University of Kansas", detail: "Bachelor of Science, Computer Engineering", dates: "2025 – 2029" },
  { school: "Evanston Township High School", detail: "", dates: "2021 – 2025" },
];

// Big, obvious project buttons: red "Watch demo" (play icon) and dark "View code" (</> icon).
const LINK_BUTTONS = {
  video: { label: "Watch demo", icon: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>` },
  code: { label: "View code", icon: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4L1.5 8l4 4M10.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
};
const linkButton = ({ type, url }) =>
  `<a class="link-button ${type}" href="${url}" target="_blank" rel="noopener">${LINK_BUTTONS[type].icon}${LINK_BUTTONS[type].label}</a>`;

// Third-party assets used on the site, shown in the Credits window (Start menu → Credits).
const credits = [
  {
    work: "Hand-painted Low Poly Computer",
    workUrl: "https://sketchfab.com/3d-models/hand-painted-low-poly-computer-c4e5d67781ca4bba960673f67a7cef30",
    author: "NoodleBaguette",
    authorUrl: "https://sketchfab.com/NoodleBaguette",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    note: "The 3D computer on the landing page. Used unmodified.",
  },
  {
    work: "Windows XP Wallpaper (pixel art)",
    workUrl: "https://www.reddit.com/r/PixelArt/comments/che0as/oc_windows_xp_wallpaper/",
    author: "u/okkoinu",
    authorUrl: "https://www.reddit.com/user/okkoinu/",
    note: "The desktop wallpaper, a pixel-art take on the classic \"Bliss\".",
  },
  {
    work: "Lexend & Roboto Mono fonts",
    workUrl: "https://fonts.google.com/",
    author: "via Google Fonts",
    license: "SIL Open Font License",
    licenseUrl: "https://openfontlicense.org/",
  },
];

const tags = (items) => `<ul class="tags">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const link = (url, label) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

export const apps = [
  {
    id: "about",
    title: "About Me",
    icon: "about",
    size: { width: 540, height: 480 },
    render: () => `
      <h2>hi! i'm <span class="accent">dillon</span></h2>
      <p class="lead">${profile.tagline}</p>
      <p>
        I grew up in Evanston, just outside Chicago, and these days I split my time between there and
        Lawrence, Kansas, where I'm studying computer engineering at KU.
      </p>
      <p>
        I love to program, and Python is the language I always reach for. But my favorite part of
        engineering is the moment code leaves the screen. The first time a motor spins or a light turns
        on because of something I wrote never gets old. Figuring out how to make hardware and software
        work together is what I could happily spend all day doing.
      </p>
      <p>
        I like the hardware side on its own too. There's something really satisfying about opening up a
        broken computer, figuring out what's wrong, and bringing it back to life.
      </p>
      <p>Take a look around! My projects are the best way to see what I'm into.</p>
    `,
  },
  {
    id: "skills",
    title: "Skills",
    icon: "skills",
    size: { width: 480, height: 400 },
    render: () => skills.map((s) => `<h3>${s.group}</h3>${tags(s.items)}`).join(""),
  },
  {
    id: "projects",
    title: "Projects",
    icon: "projects",
    size: { width: 640, height: 540 },
    render: () => projects.map((p) => `
      <article class="card project">
        ${p.image ? `<img class="project-image" src="${p.image}" alt="${p.name} screenshot" loading="lazy" />` : ""}
        ${p.award ? `<p class="award">${p.award}</p>` : ""}
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="links">${p.links.map(linkButton).join("")}</div>
        ${p.highlights ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
        ${tags(p.tech)}
      </article>
    `).join(""),
  },
  {
    id: "resume",
    title: "Resume",
    icon: "resume",
    size: { width: 600, height: 480 },
    render: () => `
      <h2>Experience</h2>
      ${experience.map((e) => `
        <article class="entry">
          <h3>${e.role}</h3>
          <p class="meta">${e.org} · ${e.place} · ${e.dates}</p>
          <ul>${e.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
        </article>
      `).join("")}
      <h2>Education</h2>
      ${education.map((e) => `
        <article class="entry">
          <h3>${e.school}</h3>
          <p class="meta">${[e.detail, e.dates].filter(Boolean).join(" · ")}</p>
        </article>
      `).join("")}
      <p class="links">${link(profile.linkedin, "Full profile on LinkedIn")}</p>
    `,
  },
  {
    id: "contact",
    title: "Contact",
    icon: "contact",
    size: { width: 420, height: 380 },
    render: () => `
      <h2>say hi!</h2>
      <p>The best way to reach me is email. I'm also on LinkedIn and GitHub.</p>
      <ul class="contact-list">
        <li><span>Email</span>${link(`mailto:${profile.email}`, profile.email)}</li>
        <li><span>LinkedIn</span>${link(profile.linkedin, "dillon-woods-ce")}</li>
        <li><span>GitHub</span>${link(profile.github, "CardBoardy")}</li>
      </ul>
    `,
  },
  {
    id: "credits",
    title: "Credits",
    icon: "credits",
    showOnDesktop: false, // opened from the Start menu instead
    size: { width: 480, height: 460 },
    render: () => `
      <h2>credits</h2>
      <p>This site uses a few great things made by other people:</p>
      ${credits.map((c) => `
        <article class="entry">
          <h3>${link(c.workUrl, c.work)}</h3>
          <p class="meta">
            ${c.authorUrl ? `by ${link(c.authorUrl, c.author)}` : c.author}
            ${c.license ? `· ${link(c.licenseUrl, c.license)}` : ""}
          </p>
          ${c.note ? `<p>${c.note}</p>` : ""}
        </article>
      `).join("")}
      <p class="muted">
        © ${new Date().getFullYear()} ${profile.name}. The desktop is a fan-made homage to Windows XP and isn't affiliated with or endorsed by
        Microsoft. Windows and the original "Bliss" photo by Charles O'Rear belong to Microsoft.
      </p>
    `,
  },
  {
    id: "tips",
    title: "Tips",
    icon: "tips",
    size: { width: 440, height: 480 },
    position: { left: 710, top: 70 }, // beside About Me, which opens with it
    render: () => `
      <h2>welcome to my <span class="accent">desktop!</span></h2>
      <p>This works like a real computer, so poke around and learn all you can:</p>
      <ul>
        <li>Click the <strong>icons</strong> on the left to open apps like Projects and Resume.</li>
        <li>Open the <strong>start</strong> menu (bottom left) for quick links, or <strong>Log Off</strong> to go back to the 3D PC.</li>
        <li>Drag windows by their title bar, <strong>resize</strong> them from the bottom-right corner, hit ▢ to make them full-screen, or ⮽ to close them.</li>
        <li>Use the <strong>taskbar</strong> to switch between windows or minimize them.</li>
      </ul>
      <p class="muted">You can reopen this anytime from the Tips icon.</p>
    `,
  },
];