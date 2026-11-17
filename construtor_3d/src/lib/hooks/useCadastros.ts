import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { criarCadastro, excluirCadastro, listarCadastro, renomearCadastro, type RecursoCadastro } from '../api/cadastros';
import { MODULOS_KEY } from './useModulos';

export const cadastroKey = (recurso: RecursoCadastro) => ['cadastro', recurso];

export function useCadastro(recurso: RecursoCadastro) {
  return useQuery({ queryKey: cadastroKey(recurso), queryFn: () => listarCadastro(recurso) });
}

// Renomear ou excluir muda o que as listas de módulos mostram (o nome do grupo vem junto com eles)
function useInvalidar(recurso: RecursoCadastro) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: cadastroKey(recurso) }),
      queryClient.invalidateQueries({ queryKey: MODULOS_KEY }),
    ]);
}

export function useCriarCadastro(recurso: RecursoCadastro) {
  const invalidar = useInvalidar(recurso);
  return useMutation({ mutationFn: (nome: string) => criarCadastro(recurso, nome), onSuccess: invalidar });
}

export function useRenomearCadastro(recurso: RecursoCadastro) {
  const invalidar = useInvalidar(recurso);
  return useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => renomearCadastro(recurso, id, nome),
    onSuccess: invalidar,
  });
}

export function useExcluirCadastro(recurso: RecursoCadastro) {
  const invalidar = useInvalidar(recurso);
  return useMutation({ mutationFn: (id: number) => excluirCadastro(recurso, id), onSuccess: invalidar });
}

/**
 * A escolha de grupo e classificação de um módulo, para os diálogos que salvam ou editam um:
 * enquanto a pessoa não escolhe, vale o padrão da empresa. `definir` põe valores (ao abrir o
 * diálogo de um módulo existente) ou volta aos padrões (sem argumento, ao abrir um novo)
 */
export function useEscolhaGrupoEClassificacao() {
  const grupos = useCadastro('grupos-modulo');
  const classificacoes = useCadastro('classificacoes-modulo');
  const [grupo, setGrupoEscolhido] = useState<number | null>(null);
  const [classificacao, setClassificacaoEscolhida] = useState<number | null>(null);

  const grupoId = grupo ?? grupos.data?.find((g) => g.padrao)?.id ?? null;
  const classificacaoId = classificacao ?? classificacoes.data?.find((c) => c.padrao)?.id ?? null;

  return {
    grupos,
    classificacoes,
    grupoId,
    classificacaoId,
    setGrupoId: setGrupoEscolhido,
    setClassificacaoId: setClassificacaoEscolhida,
    definir(inicial?: { grupoId: number; classificacaoId: number }) {
      setGrupoEscolhido(inicial?.grupoId ?? null);
      setClassificacaoEscolhida(inicial?.classificacaoId ?? null);
    },
    /** Só dá para salvar com os dois escolhidos (ou os padrões já carregados) */
    completo: grupoId !== null && classificacaoId !== null,
  };
}

export type EscolhaGrupoEClassificacao = ReturnType<typeof useEscolhaGrupoEClassificacao>;
