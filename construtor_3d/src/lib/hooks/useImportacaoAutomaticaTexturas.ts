import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { concluirTexturaPendente, importarTextura, listarTexturasPendentes } from '../api/texturas';
import { converterParaTexturaJpeg } from '../textura/textura';
import { TEXTURAS_KEY } from './useTexturas';

/**
 * Enquanto `ativo` (só quando o diálogo de escolher textura está aberto), processa sozinha
 * qualquer imagem solta na pasta de importação do servidor (ver Services/ImportacaoPendente na
 * API), de qualquer formato comum (JPEG, PNG, WEBP...): busca os bytes, recomprime pro formato
 * final (ver converterParaTexturaJpeg — o mesmo passo do arquivo escolhido na tela) e importa pro
 * catálogo de texturas. Cada uma sai da fila do servidor (com sucesso ou erro) assim que
 * processada, então não é oferecida de novo na próxima vez. Devolve se está processando algo
 * agora, pra mostrar um aviso na tela
 */
export function useImportacaoAutomaticaTexturas(ativo: boolean = true) {
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState(false);
  // Evita rodar duas vezes ao mesmo tempo (StrictMode roda os efeitos duas vezes em
  // desenvolvimento; no diálogo, `ativo` também pode virar true de novo antes do fetch terminar)
  const emAndamento = useRef(false);

  useEffect(() => {
    if (!ativo || emAndamento.current) return;
    emAndamento.current = true;

    (async () => {
      const pendentes = await listarTexturasPendentes().catch(() => []);
      if (pendentes.length === 0) return;

      setProcessando(true);
      for (const pendente of pendentes) {
        let sucesso = false;
        try {
          const resposta = await fetch(pendente.url);
          if (!resposta.ok) throw new Error('não foi possível baixar o arquivo');
          const bytes = await resposta.arrayBuffer();
          await importarTextura(await converterParaTexturaJpeg(bytes));
          sucesso = true;
        } catch (erro) {
          console.error(`Não foi possível importar a textura "${pendente.nome}" automaticamente:`, erro);
        }
        // Sai da fila do servidor mesmo se deu errado — um arquivo inválido não deve ser
        // tentado de novo a cada visita ao diálogo
        await concluirTexturaPendente(pendente.nome, sucesso).catch(() => {});
      }
      setProcessando(false);
      void queryClient.invalidateQueries({ queryKey: TEXTURAS_KEY, exact: true });
    })().finally(() => {
      emAndamento.current = false;
    });
  }, [ativo, queryClient]);

  return processando;
}
