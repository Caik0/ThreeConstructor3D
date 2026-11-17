const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// Ícones genéricos reaproveitados em várias listas (projetos, módulos, etc.)

export function IconeExcluir() {
  return (
    <svg {...svgProps}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </svg>
  );
}

export function IconeRenomear() {
  return (
    <svg {...svgProps}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Ícones do menu lateral (DashboardLayout)

export function IconeProjetos() {
  return (
    <svg {...svgProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function IconeModulos() {
  return (
    <svg {...svgProps}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

export function IconeOrcamentos() {
  return (
    <svg {...svgProps}>
      <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />
    </svg>
  );
}

export function IconeConfiguracoes() {
  return (
    <svg {...svgProps}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

export function IconeAjuda() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

export function IconeUsuarios() {
  return (
    <svg {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconeEmpresas() {
  return (
    <svg {...svgProps}>
      <path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4" />
    </svg>
  );
}

export function IconeSair() {
  return (
    <svg {...svgProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconeRecolher() {
  return (
    <svg {...svgProps}>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  );
}

export function IconeExpandir() {
  return (
    <svg {...svgProps}>
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
    </svg>
  );
}

export function IconeMenu() {
  return (
    <svg {...svgProps}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconeFechar() {
  return (
    <svg {...svgProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconeSeta() {
  return (
    <svg {...svgProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconePermissoes() {
  return (
    <svg {...svgProps}>
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconeGrupos() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconeClassificacoes() {
  return (
    <svg {...svgProps}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </svg>
  );
}
