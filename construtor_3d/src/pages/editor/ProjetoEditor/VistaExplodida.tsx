import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import { EXPLOSAO_DISTANCIA_MAXIMA } from '../../../store/editorStore';
import styles from './ProjetoEditor.module.css';

interface VistaExplodidaProps {
  distancia: number;
  onMudarDistancia: (distancia: number) => void;
  onReagrupar: () => void;
  onFechar: () => void;
}

// Painel flutuante da Vista Explodida (como no SketchUp): afasta visualmente os módulos de um
// grupo pra facilitar ver todos eles separados, sem alterar a posição salva de nada
export default function VistaExplodida({ distancia, onMudarDistancia, onReagrupar, onFechar }: VistaExplodidaProps) {
  return (
    <aside className={`${styles.flutuante} ${styles.painelExplosao}`} aria-label="Vista Explodida">
      <div className={styles.painelTopo}>
        <h2 className={styles.secaoTitulo}>
          Vista Explodida
          <Ajuda
            rotulo="Ajuda sobre a Vista Explodida"
            texto="Afasta os módulos deste grupo do centro dele pra você ver todos separados, só pra visualização: não muda a posição salva de nada. Reagrupar volta tudo pro lugar sem fechar o painel."
          />
        </h2>
        <button type="button" className={styles.fechar} onClick={onFechar} aria-label="Fechar Vista Explodida" title="Fechar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <label className={styles.campo}>
        <span className={styles.rotulo}>
          Distância entre componentes: <output>{distancia} mm</output>
        </span>
        <input
          type="range"
          className={styles.controleExplosao}
          min={0}
          max={EXPLOSAO_DISTANCIA_MAXIMA}
          step={10}
          value={distancia}
          onChange={(e) => onMudarDistancia(Number(e.target.value))}
        />
      </label>

      <div className={styles.acoesExplosao}>
        <button type="button" className={styles.salvar} onClick={onReagrupar}>
          Reagrupar
        </button>
        <button type="button" className={styles.botaoSecundario} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </aside>
  );
}
