import { useState } from 'react';
import ModuloMiniatura from '../../../components/three/ModuloMiniatura/ModuloMiniatura';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import Card from '../../../components/ui/Card/Card';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import VoltarLink from '../../../components/ui/VoltarLink/VoltarLink';
import { IconeExcluir, IconeRenomear } from '../../../components/ui/icones/Icones';
import type { Modulo } from '../../../lib/api/modulos';
import { useImportacaoAutomatica } from '../../../lib/hooks/useImportacaoAutomatica';
import { useExcluirModulo, useModulos, useRenomearModulo } from '../../../lib/hooks/useModulos';
import { TAMANHO_NOME_ELEMENTO, descreverElementoModulo } from '../../../lib/projetos/projetos';
import ImportarModelo3d from './ImportarModelo3d';
import styles from './ModulosList.module.css';

const NOME_TIPO: Record<string, string> = { peca: 'Peça', grupo: 'Grupo' };

export default function ModulosList() {
  const consulta = useModulos();
  const importandoAutomaticamente = useImportacaoAutomatica();
  const excluir = useExcluirModulo();
  const renomear = useRenomearModulo();
  const [aExcluir, setAExcluir] = useState<Modulo | null>(null);
  const [renomeando, setRenomeando] = useState<Modulo | null>(null);
  const [nome, setNome] = useState('');

  function confirmarExclusao() {
    if (!aExcluir) return;
    excluir.mutate(aExcluir.id, { onSuccess: () => setAExcluir(null) });
  }

  function confirmarRenomeacao() {
    if (!renomeando || !nome.trim()) return;
    renomear.mutate({ id: renomeando.id, nome: nome.trim() }, { onSuccess: () => setRenomeando(null) });
  }

  return (
    <section className={styles.page}>
      <VoltarLink to="/projetos" className={styles.voltar}>
        Projetos
      </VoltarLink>
      <header className={styles.header}>
        <h1>Módulos</h1>
        <ImportarModelo3d className={styles.importar} />
      </header>
      <p className={styles.ajuda}>
        Peças e grupos salvos à parte de um projeto, prontos para importar em outros. Para salvar um novo, abra
        um projeto, selecione uma peça ou grupo na estrutura e use “Salvar como módulo”, ou importe um arquivo
        .glb diretamente aqui.
      </p>

      {importandoAutomaticamente && (
        <p className={styles.ajuda} role="status">
          Importando módulos novos encontrados na pasta do servidor…
        </p>
      )}

      {consulta.isPending ? (
        <p>Carregando módulos…</p>
      ) : consulta.isError ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar os módulos"
          erro={consulta.error.message}
          onTentarDeNovo={() => consulta.refetch()}
        />
      ) : consulta.data.length === 0 ? (
        <p>Nenhum módulo salvo ainda.</p>
      ) : (
        <div className={styles.lista}>
          {consulta.data.map((modulo) => (
            <div key={modulo.id} className={styles.item}>
              <Card
                to={`/modulos/${modulo.id}`}
                media={
                  <div className={styles.miniatura}>
                    <ModuloMiniatura elemento={modulo.elemento} />
                  </div>
                }
                title={modulo.nome}
                badge={NOME_TIPO[modulo.tipo]}
                description={descreverElementoModulo(modulo.elemento)}
              >
                <span className={styles.data}>
                  Salvo em{' '}
                  {new Date(modulo.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </Card>
              <div className={styles.acoes}>
                <BotaoIcone
                  icone={<IconeRenomear />}
                  rotulo={`Renomear módulo ${modulo.nome}`}
                  onClick={() => {
                    renomear.reset();
                    setNome(modulo.nome);
                    setRenomeando(modulo);
                  }}
                />
                <BotaoIcone
                  icone={<IconeExcluir />}
                  rotulo={`Excluir módulo ${modulo.nome}`}
                  onClick={() => {
                    excluir.reset();
                    setAExcluir(modulo);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <DialogoConfirmacao
        aberto={renomeando !== null}
        titulo="Renomear módulo"
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={renomear.isPending}
        erro={renomear.isError ? renomear.error.message : null}
        onConfirmar={confirmarRenomeacao}
        onCancelar={() => setRenomeando(null)}
      >
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome do módulo</span>
          <input
            className={styles.input}
            value={nome}
            maxLength={TAMANHO_NOME_ELEMENTO}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmarRenomeacao();
            }}
          />
        </label>
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={aExcluir !== null}
        titulo={`Excluir “${aExcluir?.nome ?? ''}”?`}
        textoConfirmar="Excluir módulo"
        textoConfirmando="Excluindo…"
        confirmando={excluir.isPending}
        erro={excluir.isError ? `Não foi possível excluir: ${excluir.error.message}` : null}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setAExcluir(null)}
      >
        Isso não afeta os projetos onde este módulo já foi importado — só remove ele desta lista.
      </DialogoConfirmacao>
    </section>
  );
}
