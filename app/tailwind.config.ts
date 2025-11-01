import type { Config } from 'tailwindcss';

/**
 * Material 3 Design System - Token-Driven Tailwind Configuration
 * 
 * This configuration provides a complete set of semantic design tokens
 * following Material Design 3 principles. All color usage should be
 * through semantic tokens, never hardcoded color names.
 * 
 * Token Categories:
 * - Primary: Main brand actions and emphasis
 * - Secondary: Supporting actions and less prominent UI
 * - Tertiary: Contrasting accents and special UI
 * - Error/Warning/Success/Info: Semantic status colors
 * - Surface: Background and container colors with elevation
 * - Outline: Borders and dividers
 * - State: Interactive state layers (hover, focus, pressed, disabled)
 */

const config: Config = {
  content: [
    './index.html',
    './src/renderer/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Color Scheme - Intel Blue Brand
        primary: {
          DEFAULT: '#0068B5',
          50: '#E8F2FF',
          100: '#D0E5FF',
          200: '#A1CBFF',
          300: '#72B0FF',
          400: '#3C96FF',
          500: '#0068B5',
          600: '#00589A',
          700: '#004178',
          800: '#00305A',
          900: '#001F3D',
          // Container colors
          container: '#D0E5FF',
          'on-container': '#001F3D',
        },
        
        // Secondary Color Scheme - Intel Gray Supporting elements
        secondary: {
          DEFAULT: '#39424E',
          50: '#F2F6FA',
          100: '#E2E8F0',
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#39424E',
          600: '#30363F',
          700: '#252B33',
          800: '#1B2026',
          900: '#12161B',
          container: '#E2E8F0',
          'on-container': '#12161B',
        },
        
        // Tertiary Color Scheme - Intel Cyan Accents
        tertiary: {
          DEFAULT: '#00A6D6',
          50: '#E6FBFF',
          100: '#C4F3FF',
          200: '#88E5FF',
          300: '#4BD4F5',
          400: '#18BFE6',
          500: '#00A6D6',
          600: '#0089B3',
          700: '#006B8C',
          800: '#004D66',
          900: '#003342',
          container: '#C4F3FF',
          'on-container': '#003342',
        },
        
        // Semantic Status Colors - Error states
        error: {
          DEFAULT: '#B3261E',
          50: '#FCEEEE',
          100: '#F9DEDC',
          200: '#F2B8B5',
          300: '#EC928E',
          400: '#E46962',
          500: '#B3261E',
          600: '#8C1D18',
          700: '#681410',
          800: '#410E0B',
          900: '#370B0A',
          container: '#F9DEDC',
          'on-container': '#370B0A',
        },
        
        // Warning states
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          container: '#FEF3C7',
          'on-container': '#78350F',
        },
        
        // Success states
        success: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          container: '#D1FAE5',
          'on-container': '#064E3B',
        },
        
        // Info states
        info: {
          DEFAULT: '#3B82F6',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          container: '#DBEAFE',
          'on-container': '#1E3A8A',
        },
        
        // Surface colors - Intel-inspired backgrounds and containers
        surface: {
          DEFAULT: '#F8FBFF',
          variant: '#DCE6F2',
          dim: '#CBD4E0',
          bright: '#FFFFFF',
          1: '#F1F7FF',
          2: '#E6F0FB',
          3: '#DCE8F7',
          4: '#D2E0F2',
          5: '#C8D8ED',
          tint: '#E8F2FF',
        },
        
        // Outline colors - Borders and dividers
        outline: {
          DEFAULT: '#CBD5E1',
          variant: '#94A3B8',
        },
        
        // State layer colors for interactive elements
        state: {
          hover: {
            primary: 'rgba(0, 104, 181, 0.08)',
            secondary: 'rgba(57, 66, 78, 0.08)',
            error: 'rgba(179, 38, 30, 0.08)',
          },
          focus: {
            primary: 'rgba(0, 104, 181, 0.12)',
            secondary: 'rgba(57, 66, 78, 0.12)',
            error: 'rgba(179, 38, 30, 0.12)',
          },
          pressed: {
            primary: 'rgba(0, 104, 181, 0.16)',
            secondary: 'rgba(57, 66, 78, 0.16)',
            error: 'rgba(179, 38, 30, 0.16)',
          },
          dragged: {
            primary: 'rgba(0, 104, 181, 0.16)',
          },
          disabled: {
            content: 'rgba(0, 0, 0, 0.38)',
            container: 'rgba(0, 0, 0, 0.12)',
          },
        },
        
        // Status indicator colors (for badges, status dots, etc.)
        status: {
          proposed: '#3B82F6',
          'in-progress': '#F59E0B',
          doing: '#F59E0B',
          done: '#10B981',
          blocked: '#B3261E',
          'needs-review': '#F97316',
          todo: '#64748B',
        },
      },
      
      // Material 3 Elevation shadows
      boxShadow: {
        'elevation-0': 'none',
        'elevation-1': '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'elevation-2': '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'elevation-3': '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'elevation-4': '0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.3)',
        'elevation-5': '0 8px 12px 6px rgba(0, 0, 0, 0.15), 0 4px 4px 0 rgba(0, 0, 0, 0.3)',
      },
      
      // Material 3 Border Radius
      borderRadius: {
        'm3-none': '0px',
        'm3-xs': '4px',
        'm3-sm': '8px',
        'm3-md': '12px',
        'm3-lg': '16px',
        'm3-xl': '28px',
        'm3-full': '9999px',
      },
      
      // Typography scale
      fontSize: {
        'display-lg': ['57px', { lineHeight: '64px', fontWeight: '400' }],
        'display-md': ['45px', { lineHeight: '52px', fontWeight: '400' }],
        'display-sm': ['36px', { lineHeight: '44px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', fontWeight: '400' }],
        'headline-sm': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '500' }],
        'title-md': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'title-sm': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '16px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};

export default config;
