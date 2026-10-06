import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  aplicarTemaNoDocumento,
  assinarTemaDoSistema,
  lerTemaSalvo,
  salvarTemaEscolhido,
  sistemaPrefereEscuro,
  type Tema,
} from '../tema/tema';

/**
 * Tema em uso e função para alternar entre claro e escuro. Sem escolha salva, acompanha o tema
 * do sistema operacional (inclusive se ele mudar em tempo real); ao alternar, a escolha do
 * usuário passa a valer sempre, neste e nos próximos acessos.
 */
export function useTema() {
  const [escolha, setEscolha] = useState<Tema | null>(lerTemaSalvo);
  const sistemaEscuro = useSyncExternalStore(assinarTemaDoSistema, sistemaPrefereEscuro, () => false);
  const tema: Tema = escolha ?? (sistemaEscuro ? 'escuro' : 'claro');

  useEffect(() => {
    if (escolha) aplicarTemaNoDocumento(escolha);
  }, [escolha]);

  function alternar() {
    const novo: Tema = tema === 'claro' ? 'escuro' : 'claro';
    salvarTemaEscolhido(novo);
    setEscolha(novo);
  }

  return { tema, alternar };
}
