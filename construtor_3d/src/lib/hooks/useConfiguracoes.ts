import { useEffect, useRef } from 'react';
import { obterConfiguracoes, salvarConfiguracoes } from '../api/configuracoes';
import { normalizarConfiguracoes } from '../configuracoes/configuracoes';
import { useAuthStore } from '../../store/authStore';
import { gravarCache, lerCache, useConfiguracoesStore } from '../../store/configuracoesStore';

const ESPERA_DO_SALVAMENTO_MS = 700;

/**
 * Mantém as configurações do usuário logado em dia: ao entrar, aplica o cache do navegador na hora e
 * depois o que a API tem; a cada mudança feita na tela de configurações, grava o cache e salva na
 * API (com uma pequena espera, pra uma digitação ou uma sequência de cliques virar um salvamento só).
 * Usado uma vez só, em ProtectedRoute
 */
export function useSincronizarConfiguracoes() {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const token = useAuthStore((s) => s.token);
  const aplicar = useConfiguracoesStore((s) => s.aplicar);
  const versaoLocal = useConfiguracoesStore((s) => s.versaoLocal);
  const versaoQueCarregou = useRef(0);

  // Entrada: cache primeiro (sem esperar a rede), depois a API
  useEffect(() => {
    if (!token || usuarioId === undefined) return;
    const cache = lerCache(usuarioId);
    if (cache) aplicar(cache);
    let cancelado = false;
    obterConfiguracoes()
      .then(({ configuracoes }) => {
        // Se o usuário mexeu enquanto a resposta vinha, a mudança dele (que já será salva) vale mais
        if (cancelado || configuracoes === null || useConfiguracoesStore.getState().versaoLocal !== versaoQueCarregou.current) return;
        const doServidor = normalizarConfiguracoes(configuracoes);
        aplicar(doServidor);
        gravarCache(usuarioId, doServidor);
      })
      .catch(() => {
        // Sem rede ou sessão expirada (o client já trata o 401): segue com o cache/padrão
      });
    return () => {
      cancelado = true;
    };
  }, [token, usuarioId, aplicar]);

  // Mudança do usuário: cache já, API logo depois
  useEffect(() => {
    if (versaoLocal === versaoQueCarregou.current || !token || usuarioId === undefined) return;
    const configuracoes = useConfiguracoesStore.getState().configuracoes;
    gravarCache(usuarioId, configuracoes);
    const espera = window.setTimeout(() => {
      void salvarConfiguracoes(configuracoes).catch(() => {
        // Falhou: fica no cache e vai de novo na próxima mudança
      });
    }, ESPERA_DO_SALVAMENTO_MS);
    return () => window.clearTimeout(espera);
  }, [versaoLocal, token, usuarioId]);
}
