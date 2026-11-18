// Tipos de textura do catálogo (espelho, metálica...). A lista é a mesma de CategoriasDeTextura na
// API: ao acrescentar um tipo, inclua nos dois lugares (não precisa de migração)

export type CategoriaTextura = 'geral' | 'madeira' | 'metalica' | 'espelho' | 'vidro' | 'pedra' | 'tecido';

export const CATEGORIAS_DE_TEXTURA: { id: CategoriaTextura; rotulo: string }[] = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'madeira', rotulo: 'Madeira' },
  { id: 'metalica', rotulo: 'Metálica' },
  { id: 'espelho', rotulo: 'Espelho' },
  { id: 'vidro', rotulo: 'Vidro' },
  { id: 'pedra', rotulo: 'Pedra' },
  { id: 'tecido', rotulo: 'Tecido' },
];

export const ROTULO_CATEGORIA_TEXTURA: Record<CategoriaTextura, string> = Object.fromEntries(
  CATEGORIAS_DE_TEXTURA.map((c) => [c.id, c.rotulo]),
) as Record<CategoriaTextura, string>;
