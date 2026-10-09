import { useRef, useState, type ComponentType } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useCriarProjeto } from '../../../lib/hooks/useProjetos';
import type { NovoProjetoDados } from '../../../lib/projetos/projetos';
import EtapaInformacoes from './etapas/EtapaInformacoes';
import EtapaPontoPartida from './etapas/EtapaPontoPartida';
import styles from './NovoProjeto.module.css';

const ETAPAS: {
  titulo: string;
  /** Campos validados antes de avançar */
  campos: FieldPath<NovoProjetoDados>[];
  Componente: ComponentType;
}[] = [
  { titulo: 'Informações do projeto', campos: ['nome', 'descricao'], Componente: EtapaInformacoes },
  { titulo: 'Escolha seu ponto de partida', campos: ['pontoPartida'], Componente: EtapaPontoPartida },
];

export default function NovoProjeto() {
  const [etapa, setEtapa] = useState(0);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const criarProjeto = useCriarProjeto();

  const form = useForm<NovoProjetoDados>({
    mode: 'onTouched',
    defaultValues: {
      nome: '',
      descricao: '',
      pontoPartida: 'modulos',
    },
  });

  const { titulo, campos, Componente } = ETAPAS[etapa];
  const ultima = etapa === ETAPAS.length - 1;

  function irPara(proxima: number) {
    setEtapa(proxima);
    // Leva o foco ao título da etapa para leitores de tela anunciarem a troca
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  async function avancar() {
    if (await form.trigger(campos)) irPara(etapa + 1);
  }

  const criar = form.handleSubmit((dados) => {
    criarProjeto.mutate(dados, { onSuccess: (projeto) => navigate(`/projetos/${projeto.id}`) });
  });

  return (
    <FormProvider {...form}>
      <form
        className={styles.painel}
        noValidate
        onSubmit={
          ultima
            ? criar
            : (e) => {
                e.preventDefault();
                void avancar();
              }
        }
      >
        <header className={styles.topo}>
          <Link to="/" className={styles.fechar} aria-label="Cancelar e voltar ao início">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Link>
          <h1 className={styles.tituloPagina}>Criar novo projeto</h1>
        </header>

        <h2 ref={tituloRef} tabIndex={-1} className={styles.tituloEtapa}>
          {titulo}
        </h2>
        <div
          className={styles.progresso}
          role="progressbar"
          aria-label={`Etapa ${etapa + 1} de ${ETAPAS.length}`}
          aria-valuemin={1}
          aria-valuemax={ETAPAS.length}
          aria-valuenow={etapa + 1}
        >
          {ETAPAS.map((e, i) => (
            <span key={e.titulo} className={i <= etapa ? styles.segmentoAtivo : styles.segmento} />
          ))}
        </div>

        <div className={styles.conteudo}>
          <Componente />
        </div>

        {criarProjeto.isError && (
          <p className={styles.erroEnvio} role="alert">
            Não foi possível criar o projeto: {criarProjeto.error.message}
          </p>
        )}

        <footer className={styles.rodape}>
          {etapa > 0 ? (
            <button type="button" className={styles.botaoSecundario} onClick={() => irPara(etapa - 1)}>
              ← Voltar
            </button>
          ) : (
            <Link to="/" className={styles.botaoSecundario}>
              Cancelar
            </Link>
          )}
          <button type="submit" className={styles.botaoPrimario} disabled={criarProjeto.isPending}>
            {!ultima ? 'Próxima etapa →' : criarProjeto.isPending ? 'Salvando…' : 'Criar projeto'}
          </button>
        </footer>
      </form>
    </FormProvider>
  );
}
