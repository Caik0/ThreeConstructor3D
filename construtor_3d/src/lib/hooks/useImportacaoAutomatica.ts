import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { concluirPendente, listarPendentes, salvarModulo } from '../api/modulos';
import { converterGlbEmModulo } from '../modelo3d/importarGlb';
import { TAMANHO_NOME_ELEMENTO } from '../projetos/projetos';
import { MODULOS_KEY } from './useModulos';

/**
 * Enquanto `ativo` (por padrão sempre, ao montar a tela de módulos; ou só quando aberto, no diálogo
 * de importar módulo do editor), processa sozinho qualquer .glb solto na pasta de importação do
 * servidor (ver Services/ImportacaoPendente na API): busca os bytes, separa em peças/grupos —
 * mesmo código de sempre, ver lib/modelo3d/importarGlb.ts — e salva como módulo novo, sem precisar
 * arrastar arquivo por arquivo na tela. Cada um sai da fila do servidor (com sucesso ou erro) assim
 * que processado, então não é oferecido de novo na próxima vez. Devolve se está processando algo
 * agora, pra mostrar um aviso na tela
 */
export function useImportacaoAutomatica(ativo: boolean = true) {
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState(false);
  // Evita rodar duas vezes ao mesmo tempo (StrictMode roda os efeitos duas vezes em
  // desenvolvimento; no diálogo, `ativo` também pode virar true de novo antes do fetch terminar)
  const emAndamento = useRef(false);

  useEffect(() => {
    if (!ativo || emAndamento.current) return;
    emAndamento.current = true;

    (async () => {
      const pendentes = await listarPendentes().catch(() => []);
      if (pendentes.length === 0) return;

      setProcessando(true);
      for (const pendente of pendentes) {
        let sucesso = false;
        try {
          const resposta = await fetch(pendente.url);
          if (!resposta.ok) throw new Error('não foi possível baixar o arquivo');
          const bytes = await resposta.arrayBuffer();
          const elemento = await converterGlbEmModulo(bytes, pendente.nome);
          await salvarModulo(elemento.nome.slice(0, TAMANHO_NOME_ELEMENTO), elemento);
          sucesso = true;
        } catch (erro) {
          console.error(`Não foi possível importar "${pendente.nome}" automaticamente:`, erro);
        }
        // Sai da fila do servidor mesmo se deu errado — um arquivo inválido não deve ser
        // tentado de novo a cada visita à tela
        await concluirPendente(pendente.nome, sucesso).catch(() => {});
      }
      setProcessando(false);
      void queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true });
    })().finally(() => {
      emAndamento.current = false;
    });
  }, [ativo, queryClient]);

  return processando;
}
