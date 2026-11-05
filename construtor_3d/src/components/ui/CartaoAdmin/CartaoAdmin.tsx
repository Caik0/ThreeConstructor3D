import { useState, type MouseEvent, type ReactNode } from 'react';
import { useTelaCelular } from '../../../lib/hooks/useTelaCelular';
import BotaoIcone from '../BotaoIcone/BotaoIcone';
import { IconeSeta } from '../icones/Icones';
import DialogoConfirmacao from '../DialogoConfirmacao/DialogoConfirmacao';
import styles from './CartaoAdmin.module.css';

export interface Dado {
  rotulo: string;
  valor: ReactNode;
}

/** Um dado da janela de detalhes; os de mesmo `grupo` aparecem juntos, sob o título do grupo */
export interface Detalhe {
  rotulo: string;
  valor: string | null;
  grupo: string;
}

// Agrupa mantendo a ordem em que os grupos e os dados foram informados
function agrupar(detalhes: Detalhe[]): [string, Detalhe[]][] {
  const grupos = new Map<string, Detalhe[]>();
  for (const d of detalhes) grupos.set(d.grupo, [...(grupos.get(d.grupo) ?? []), d]);
  return [...grupos.entries()];
}

interface CartaoAdminProps {
  titulo: string;
  subtitulo?: string | null;
  /** Interruptor de status: ligado = ativo; desligar/ligar só avisa a tela, que pede a confirmação */
  ativo: boolean;
  textoStatus: string;
  rotuloInterruptor: string;
  onAlternarStatus: () => void;
  /** Os dados principais, sempre à mostra */
  resumo: Dado[];
  /** Mais dados principais, só no computador (onde o cartão ocupa a linha toda e há espaço); no celular ficam só nos detalhes */
  resumoExtra?: Dado[];
  /** Todos os dados cadastrados, ao clicar em "Detalhes": no computador abrem numa área recolhível abaixo
   * da linha do cartão; no celular, numa janela. "Observações" ocupa a linha toda */
  detalhes: () => Detalhe[];
  /** Botões extras do rodapé, depois de "Detalhes" */
  acoes: ReactNode;
}

/** Cartão das listas de administração (Empresas, Usuários): título, interruptor de status, resumo,
 * detalhes expansíveis e ações. Quem usa só informa os dados; o visual e o "Detalhes" são daqui */
export default function CartaoAdmin({ titulo, subtitulo, ativo, textoStatus, rotuloInterruptor, onAlternarStatus, resumo, resumoExtra, detalhes, acoes }: CartaoAdminProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const celular = useTelaCelular();

  // No computador o corpo fica sempre montado, para a área poder animar ao fechar; no celular só com a janela aberta
  const corpoDetalhes = (!celular || detalhesAbertos) && (
    <div className={styles.secoes}>
      {agrupar(detalhes()).map(([grupo, itens]) => (
        <section key={grupo} className={styles.secao}>
          <h3>{grupo}</h3>
          <dl className={styles.detalhes}>
            {itens.map(({ rotulo, valor }) => (
              <div key={rotulo} className={rotulo === 'Observações' ? styles.detalheLargo : undefined}>
                <dt>{rotulo}</dt>
                <dd>{valor?.trim() ? valor : '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );

  // No computador o cartão todo abre/fecha ao clicar, menos nos controles e quando há texto selecionado:
  // assim ainda dá para selecionar e copiar os dados sem recolher o cartão. O botão da setinha é a via do teclado
  function alternarPeloCartao(e: MouseEvent<HTMLElement>) {
    if (celular) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('button, a, input, select, textarea, label, dialog, [role="switch"]')) return;
    if (alvo.closest(`.${styles.detalhesInline}`)) return; // clicar dentro dos detalhes não os recolhe
    if (window.getSelection()?.toString()) return;
    setDetalhesAbertos((aberto) => !aberto);
  }

  return (
    <article className={`${styles.cartao} ${celular ? '' : styles.cartaoClicavel}`} onClick={alternarPeloCartao}>
      <div className={styles.cartaoTopo}>
        <div className={styles.cartaoTitulo}>
          <h3>{titulo}</h3>
          {subtitulo && <div className={styles.secundario}>{subtitulo}</div>}
        </div>
        <div className={styles.status}>
          <button type="button" role="switch" aria-checked={ativo} aria-label={rotuloInterruptor} className={styles.interruptor} onClick={onAlternarStatus} />
          <span className={ativo ? styles.textoAtiva : styles.textoBloqueada}>{textoStatus}</span>
        </div>
      </div>
      <dl className={styles.cartaoMeta}>
        {resumo.map(({ rotulo, valor }) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
        {!celular &&
          resumoExtra?.map(({ rotulo, valor }) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
      </dl>
      <div className={styles.cartaoRodape}>
        {celular ? (
          <button type="button" className={styles.botao} aria-haspopup="dialog" onClick={() => setDetalhesAbertos(true)}>
            Detalhes
          </button>
        ) : (
          <BotaoIcone
            icone={<span className={`${styles.seta} ${detalhesAbertos ? styles.setaAberta : ''}`}><IconeSeta /></span>}
            rotulo={detalhesAbertos ? 'Ocultar detalhes' : 'Ver detalhes'}
            aria-expanded={detalhesAbertos}
            onClick={() => setDetalhesAbertos((aberto) => !aberto)}
          />
        )}
        {acoes}
      </div>
      {celular ? (
        <DialogoConfirmacao aberto={detalhesAbertos} className={styles.dialogoDetalhes} titulo={titulo} onCancelar={() => setDetalhesAbertos(false)}>
          {detalhesAbertos && corpoDetalhes}
        </DialogoConfirmacao>
      ) : (
        <div className={`${styles.detalhesInline} ${detalhesAbertos ? styles.detalhesInlineAberto : ''}`} inert={!detalhesAbertos}>
          <div className={styles.detalhesInlineConteudo}>{corpoDetalhes}</div>
        </div>
      )}
    </article>
  );
}

/** Grade responsiva que recebe os cartões; `vazia` aparece no lugar deles quando o filtro não acha nada */
export function GradeCartoes({ children, vazia }: { children: ReactNode; vazia: string | null }) {
  return (
    <div className={styles.cartoes}>
      {children}
      {vazia && <p className={styles.listaVazia}>{vazia}</p>}
    </div>
  );
}
