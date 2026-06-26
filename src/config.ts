export const SITE_NAME = 'SS3K';
export const SITE_DESCRIPTION = 'offensive-security notes, write-ups & tooling';
export const SITE_URL = 'https://0xss3k.github.io';

export const MANIFESTO = '\t\t\tOffensive security and continuous learning.';

export const ABOUT = {
  intro: 'Hi :^)\n\nI\'m Bruno, from Chile. I\'m a self-taught offensive security specialist: I like to figure out how things break, and I haven\'t stopped since.\n\nI\'ve reported vulnerabilities to public and private organizations, I participate in CTFs, and I spend a lot of time racking my brain over machines and labs. Almost everything I know comes from trying, failing, and trying again.\n\nThis blog is my open notebook: notes, reports, and the occasional tool I write up along the way.\n\nI\'ll help you with ur OSINT by sharing my other social media accounts below.',

  links: [
    { label: 'linkedin',  href: 'https://www.linkedin.com/in/ss3k' },
    { label: 'github',    href: 'https://github.com/0xSS3K' },
    { label: 'instagram', href: 'https://www.instagram.com/_ss3k_/' },
  ],
};

export const FOOTER_SIGN_OFF = '❋ Hombre soy, nada de lo humano me es ajeno. ❋';
export const NAV_ORNAMENT = '❋';

// ─── certs ──────────────────────────────────────────────────────────────────
// Editable metadata per certification. The KEY must equal the cert's folder
// slug under notas/ (e.g. notas/cpts/ → key "cpts"). To add a new cert: drop
// its notes under notas/<slug>/ and add an entry here. A cert with notes but
// no entry here still renders, falling back to an upper-cased slug as its name.
export interface CertMeta {
  name: string;          // short display name, e.g. "CPTS"
  full?: string;         // expanded title
  issuer?: string;       // awarding body
  description?: string;  // one-line blurb for the /certs landing cards
}

export const CERTS: Record<string, CertMeta> = {
  cpts: {
    name: 'CPTS',
    full: 'Certified Penetration Testing Specialist',
    issuer: 'Hack The Box',
    description: 'Notas, metodología y write-ups del recorrido CPTS: recon, web, AD, post-explotación y reporte.',
  },
};
