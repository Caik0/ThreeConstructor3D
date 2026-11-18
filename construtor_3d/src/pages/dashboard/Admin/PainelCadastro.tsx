import { useState } from 'react';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import CampoBusca from '../../../components/ui/CampoBusca/CampoBusca';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import { IconeExcluir, IconeRenomear } from '../../../components/ui/icones/Icones';
import TabelaPaginada from '../../../components/ui/TabelaPaginada/TabelaPaginada';
import type { ItemCadastro, RecursoCadastro } from '../../../lib/api/cadastros';
import { correspondeBusca } from '../../../lib/busca/busca';
import { useCadastro, useCriarCadastro, useExcluirCadastro, useRenomearCadastro } from '../../../lib/hooks/useCadastros';
import { usePaginacao } from '../../../lib/hooks/usePaginacao';
import styles from './PainelCadastro.module.css';

interface Textos {
  titulo: string;
  /** "grupo" / "classificação" — usado nas frases */
  singular: string;
  /** "Novo grupo" / "Nova classificação" */
  novo: string;
}

const TEXTOS: Record<RecursoCadastro, Textos> = {
  'grupos-modulo': {
    titulo: 'Grupos',
    singular: 'grupo de módulos',
    novo: 'Novo grupo de módulos',
  },
  'classificacoes-modulo': {
    titulo: 'Classificações',
    singular: 'classificação de módulos',
    novo: 'Nova classificação de módulos',
  },
};

const TAMANHO_NOME = 60;

// Lista de um cadastro simples da empresa (grupos ou classificações de um tipo de item): todos têm
// exatamente a mesma forma (um nome, um item padrão que não se exclui, e a contagem de usos), então
// é um painel só, configurado por `recurso`. Fica dentro de AdminCadastro, uma aba por tipo de item
export default function PainelCadastro({ recurso }: { recurso: RecursoCadastro }) {
  const textos = TEXTOS[recurso];
  const consulta = useCadastro(recurso);
  const criar = useCriarCadastro(recurso);
  const renomear = useRenomearCadastro(recurso);
  const excluir = useExcluirCadastro(recurso);
  const [busca, setBusca] = useState('');
  // `null` = fechado; `{ id: null }` = novo; com id = renomeando
  const [editando, setEditando] = useState<{ id: number | null } | null>(null);
  const [nome, setNome] = useState('');
  const [aExcluir, setAExcluir] = useState<ItemCadastro | null>(null);

  const visiveis = (consulta.data ?? []).filter((i) => correspondeBusca(busca, i.nome));
  const paginacao = usePaginacao(visiveis, busca);
  const salvando = criar.isPending || renomear.isPending;
  const erroSalvar = criar.isError ? criar.error.message : renomear.isError ? renomear.error.message : null;

  function abrir(item?: ItemCadastro) {
    criar.reset();
    renomear.reset();
    setNome(item?.nome ?? '');
    setEditando({ id: item?.id ?? null });
  }

  function confirmar() {
    if (!editando || !nome.trim()) return;
    const aoSalvar = { onSuccess: () => setEditando(null) };
    if (editando.id === null) criar.mutate(nome.trim(), aoSalvar);
    else renomear.mutate({ id: editando.id, nome: nome.trim() }, aoSalvar);
  }

  return (
    <section className={styles.painel}>
      <header className={styles.header}>
        <button type="button" className={styles.botaoNovo} onClick={() => abrir()}>
          + Novo
        </button>
      </header>

      {consulta.isPending ? (
        <p>Carregando…</p>
      ) : consulta.isError ? (
        <ErroCarregamento mensagem={`Não foi possível carregar: ${textos.titulo.toLowerCase()}`} erro={consulta.error.message} onTentarDeNovo={() => consulta.refetch()} />
      ) : (
        <>
          <CampoBusca valor={busca} onChange={setBusca} placeholder={`Pesquisar por nome`} />
          <TabelaPaginada paginacao={paginacao} rotuloItens={textos.titulo.toLowerCase()}>
            <ul className={styles.lista}>
              {paginacao.itens.map((item) => (
                <li key={item.id} className={styles.linha}>
                  <div className={styles.nome}>
                    <strong>{item.nome}</strong>
                    {item.padrao && <span className={styles.padrao}>Padrão</span>}
                  </div>
                  <span className={styles.usos}>{item.usos === 1 ? '1 uso' : `${item.usos} usos`}</span>
                  <div className={styles.acoes}>
                    <BotaoIcone icone={<IconeRenomear />} rotulo={`Renomear ${item.nome}`} onClick={() => abrir(item)} />
                    {!item.padrao && (
                      <BotaoIcone
                        icone={<IconeExcluir />}
                        rotulo={`Excluir ${item.nome}`}
                        onClick={() => {
                          excluir.reset();
                          setAExcluir(item);
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
              {visiveis.length === 0 && <li className={styles.vazia}>Nenhum item encontrado.</li>}
            </ul>
          </TabelaPaginada>
        </>
      )}

      <DialogoConfirmacao
        aberto={editando !== null}
        titulo={editando?.id === null ? textos.novo : `Renomear ${textos.singular}`}
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={salvando}
        erro={erroSalvar}
        onConfirmar={confirmar}
        onCancelar={() => setEditando(null)}
      >
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            value={nome}
            maxLength={TAMANHO_NOME}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmar();
            }}
          />
        </label>
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={aExcluir !== null}
        titulo={`Excluir “${aExcluir?.nome ?? ''}”?`}
        textoConfirmar="Excluir"
        textoConfirmando="Excluindo…"
        confirmando={excluir.isPending}
        erro={excluir.isError ? excluir.error.message : null}
        onConfirmar={() => aExcluir && excluir.mutate(aExcluir.id, { onSuccess: () => setAExcluir(null) })}
        onCancelar={() => setAExcluir(null)}
      >
        Só dá para excluir um item que nenhum módulo esteja usando.
      </DialogoConfirmacao>
    </section>
  );
}
