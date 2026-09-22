import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:             '#FAF7F2',
          surface:        '#F0EBE3',
          'surface-md':   '#EDE8E2',
          'surface-lg':   '#E5DED5',
          primary:        '#3A8A7A',
          'primary-dark': '#2d7066',
          'primary-muted':'#EAF2F0',
          accent:         '#E8748A',
          gold:           '#D4A017',
          navy:           '#1E3A6E',
          fern:           '#497250',
          conifer:        '#BCD85E',
          divider:        '#C4B8AE',
          field:          '#D9CFC3',
        },
      },
      fontFamily: {
        display:  ['var(--font-bebas)', 'sans-serif'],
        numbers:  ['var(--font-anton)', 'sans-serif'],
        script:   ['var(--font-fraunces)', 'serif'],
        fraunces: ['var(--font-fraunces)', 'serif'],
        sans:     ['var(--font-dm-sans)', 'DM Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        sm:   '12px',
        md:   '16px',
        lg:   '20px',
        xl:   '24px',
        '2xl':'28px',
        '3xl':'32px',
        full: '9999px',
      },
      letterSpacing: {
        widest: '0.25em',
      },
    },
  },
  plugins: [],
}

export default config
