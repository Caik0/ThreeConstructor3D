import { useState } from 'react';
import { Link } from 'react-router-dom';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import Card from '../../../components/ui/Card/Card';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import { IconeExcluir } from '../../../components/ui/icones/Icones';
import VoltarLink from '../../../components/ui/VoltarLink/VoltarLink';
import { useExcluirProjeto, useProjetos } from '../../../lib/hooks/useProjetos';
import type { ProjetoResumo } from '../../../lib/projetos/projetos';
import ImportarProjetoGlb from './ImportarProjetoGlb';
import styles from './ProjetosList.module.css';

const plural = (total: number) => `${total} ${total === 1 ? 'peça' : 'peças'}`;

export default function ProjetosList() {
  const consulta = useProjetos();
  const excluir = useExcluirProjeto();
  const [aExcluir, setAExcluir] = useState<ProjetoResumo | null>(null);

  function confirmarExclusao() {
    if (!aExcluir) return;
    excluir.mutate(aExcluir.id, { onSuccess: () => setAExcluir(null) });
  }

  return (
    <section className={styles.page}>
            <VoltarLink to="/" className={styles.voltar}>
              Inicio
            </VoltarLink>
      <header className={styles.header}>
        <h1>Projetos</h1>
        <div className={styles.acoesHeader}>
          <Link to="/modulos" className={styles.modulos}>
            Biblioteca de módulos
          </Link>
          <ImportarProjetoGlb className={styles.importar} />
          <Link to="/projetos/novo" className={styles.novo}>
            + Novo projeto
          </Link>
        </div>
      </header>

      {consulta.isPending ? (
        <p>Carregando projetos…</p>
      ) : consulta.isError ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar os projetos"
          erro={consulta.error.message}
          onTentarDeNovo={() => consulta.refetch()}
        />
      ) : consulta.data.length === 0 ? (
        <p>
          Nenhum projeto ainda. <Link to="/projetos/novo">Crie o primeiro</Link>.
        </p>
      ) : (
        <div className={styles.lista}>
          {consulta.data.map((projeto) => (
            <div key={projeto.id} className={styles.item}>
              <Card
                to={`/projetos/${projeto.id}`}
                title={projeto.nome}
                badge={plural(projeto.totalPecas)}
                description={projeto.descricao ?? undefined}
              >
                <span className={styles.data}>
                  Atualizado em {new Date(projeto.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </Card>
              <BotaoIcone
                icone={<IconeExcluir />}
                rotulo={`Excluir projeto ${projeto.nome}`}
                className={styles.excluir}
                onClick={() => {
                  excluir.reset();
                  setAExcluir(projeto);
                }}
              />
            </div>
          ))}
        </div>
      )}

      <DialogoConfirmacao
        aberto={aExcluir !== null}
        titulo={`Excluir “${aExcluir?.nome ?? ''}”?`}
        textoConfirmar="Excluir projeto"
        textoConfirmando="Excluindo…"
        confirmando={excluir.isPending}
        erro={excluir.isError ? `Não foi possível excluir: ${excluir.error.message}` : null}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setAExcluir(null)}
      >
        O projeto e tudo o que há nele ({plural(aExcluir?.totalPecas ?? 0)} e seus grupos) serão apagados.
        Isso não pode ser desfeito.
      </DialogoConfirmacao>
    </section>
  );
}
