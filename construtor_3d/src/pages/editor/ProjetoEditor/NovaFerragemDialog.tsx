import { useState } from 'react';
import CampoMedida from '../../../components/ui/CampoMedida/CampoMedida';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ModuloMiniatura from '../../../components/three/ModuloMiniatura/ModuloMiniatura';
import { useModulos } from '../../../lib/hooks/useModulos';
import { UNIDADE_GRAUS } from '../../../lib/medidas/medidas';
import {
  descreverElementoModulo,
  LIMITE_POSICAO,
  type Posicao,
  type Rotacao,
} from '../../../lib/projetos/projetos';
import { SEM_ROTACAO } from '../../../lib/transformacoes/transformacoes';
import { paiParaCriacao, useEditorStore } from '../../../store/editorStore';
import styles from './ProjetoEditor.module.css';

const EIXOS = ['x', 'y', 'z'] as const;

// Modal de criação de ferragem: escolhe um módulo salvo com categoria "ferragem" (dobradiça, puxador
// etc.) e a posição/rotação dele em relação ao pai, antes de inserir. Entra dentro do elemento
// selecionado (ver paiParaCriacao), como uma cópia independente do módulo
export default function NovaFerragemDialog({ onFechar }: { onFechar: () => void }) {
  const consulta = useModulos();
  const elementos = useEditorStore((s) => s.elementos);
  const selecionada = useEditorStore((s) => s.selecionada);
  const contexto = useEditorStore((s) => s.contexto);
  const importarModulo = useEditorStore((s) => s.importarModulo);

  const chavePai = paiParaCriacao({ elementos, selecionada, contexto });
  const pai = chavePai ? elementos[chavePai] : undefined;

  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [posicao, setPosicao] = useState<Posicao>({ x: 0, y: 0, z: 0 });
  const [rotacao, setRotacao] = useState<Rotacao>(SEM_ROTACAO);
  const [erro, setErro] = useState<string | null>(null);

  const modulos = (consulta.data ?? []).filter(
    (m) => mostrarTodos || (m.elemento.categoria ?? 'estrutura') === 'ferragem',
  );

  function confirmar() {
    const modulo = consulta.data?.find((m) => m.id === escolhido);
    if (!modulo) {
      setErro('Escolha uma ferragem da lista.');
      return;
    }
    importarModulo(modulo.elemento, { posicao, rotacao, categoria: 'ferragem' });
    onFechar();
  }

  return (
    <DialogoConfirmacao
      aberto
      className={styles.dialogoLargo}
      titulo="Nova ferragem"
      textoConfirmar="Adicionar ferragem"
      textoConfirmando="Adicionando…"
      erro={erro}
      onConfirmar={confirmar}
      onCancelar={onFechar}
    >
      <div>
        <p>{pai ? `Será adicionada dentro de “${pai.nome}”.` : 'Será adicionada na raiz.'}</p>

        <label>
          <input type="checkbox" checked={mostrarTodos} onChange={(e) => setMostrarTodos(e.target.checked)} /> Mostrar
          também módulos que não são ferragem
        </label>

        {consulta.isPending ? (
          <p>Carregando módulos…</p>
        ) : consulta.isError ? (
          <p role="alert">Não foi possível carregar os módulos: {consulta.error.message}</p>
        ) : modulos.length === 0 ? (
          <p>
            Nenhuma ferragem salva. Crie a ferragem como peça ou grupo, marque a categoria como “Ferragem” e use
            “Salvar como módulo”.
          </p>
        ) : (
          <ul className={styles.listaModulos}>
            {modulos.map((modulo) => (
              <li key={modulo.id}>
                <button
                  type="button"
                  className={`${styles.itemModulo} ${escolhido === modulo.id ? styles.itemModuloEscolhido : ''}`}
                  aria-pressed={escolhido === modulo.id}
                  onClick={() => {
                    setEscolhido(modulo.id);
                    setErro(null);
                  }}
                >
                  <span className={styles.miniaturaModulo}>
                    <ModuloMiniatura elemento={modulo.elemento} />
                  </span>
                  <span className={styles.textoModulo}>
                    <span className={styles.nomeModulo}>{modulo.nome}</span>
                    <span className={styles.noMedidas}>{descreverElementoModulo(modulo.elemento)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Posição no pai (origem da ferragem)</legend>
          {EIXOS.map((eixo) => (
            <CampoMedida
              key={`posicao-${eixo}`}
              rotulo={eixo.toUpperCase()}
              valor={posicao[eixo]}
              min={-LIMITE_POSICAO}
              max={LIMITE_POSICAO}
              onConfirmar={(valor) => setPosicao((p) => ({ ...p, [eixo]: valor }))}
            />
          ))}
        </fieldset>

        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Rotação</legend>
          {EIXOS.map((eixo) => (
            <CampoMedida
              key={`rotacao-${eixo}`}
              rotulo={eixo.toUpperCase()}
              unidade={UNIDADE_GRAUS}
              valor={rotacao[eixo]}
              min={-3600}
              max={3600}
              onConfirmar={(valor) => setRotacao((r) => ({ ...r, [eixo]: valor }))}
            />
          ))}
        </fieldset>
      </div>
    </DialogoConfirmacao>
  );
}
