import { useState } from 'react';
import Abas, { abaId, type Aba } from '../../../components/ui/Abas/Abas';
import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import type { RecursoCadastro } from '../../../lib/api/cadastros';
import PainelCadastro from './PainelCadastro';
import styles from './AdminCadastro.module.css';

type TipoCadastro = 'grupos' | 'classificacoes';
type TipoItem = 'modulos' | 'componentes';

const ABAS: Aba<TipoItem>[] = [
  { id: 'modulos', rotulo: 'Módulos' },
  { id: 'componentes', rotulo: 'Componentes' },
];

interface Config {
  titulo: string;
  ajuda: string;
  /** Recurso da API da aba de módulos; o de componentes entra aqui quando existirem componentes */
  modulos: RecursoCadastro;
  /** "grupos" / "classificações", nas frases */
  nomePlural: string;
}

const CONFIG: Record<TipoCadastro, Config> = {
  grupos: {
    titulo: 'Grupos',
    ajuda: 'Agrupam o catálogo por assunto (ex.: Cozinha, Quarto). Todo módulo pertence a um grupo. Módulos e componentes têm listas separadas, uma em cada aba.',
    modulos: 'grupos-modulo',
    nomePlural: 'grupos',
  },
  classificacoes: {
    titulo: 'Classificações',
    ajuda: 'Classificam o catálogo por natureza (ex.: Estrutural, Decorativo). Todo módulo tem uma classificação. Módulos e componentes têm listas separadas, uma em cada aba.',
    modulos: 'classificacoes-modulo',
    nomePlural: 'classificações',
  },
};

// Tela de cadastro de grupos ou de classificações da empresa (duas telas, uma por `tipo`), com uma
// aba por tipo de item: as listas de módulo e de componente são distintas (um grupo de módulo não
// aparece nos componentes). A aba de componentes entra quando existirem componentes no sistema
export default function AdminCadastro({ tipo }: { tipo: TipoCadastro }) {
  const config = CONFIG[tipo];
  const [aba, setAba] = useState<TipoItem>('modulos');

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>{config.titulo}</h1>
        <Ajuda texto={config.ajuda} rotulo="Sobre esta tela" />
      </header>

      <Abas abas={ABAS} valor={aba} onChange={setAba} rotulo="Tipo de item" />

      <div role="tabpanel" aria-labelledby={abaId(aba)} className={styles.conteudo}>
        {aba === 'modulos' ? (
          <PainelCadastro recurso={config.modulos} />
        ) : (
          <p className={styles.emBreve}>
            Ainda não há componentes no sistema. Quando houver, os {config.nomePlural} deles serão cadastrados aqui, separados dos de módulos.
          </p>
        )}
      </div>
    </section>
  );
}
