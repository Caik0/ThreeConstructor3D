import { forwardRef, useId, useState } from 'react';
import { UNIDADE_CM, avaliarExpressao, type UnidadeCampo } from '../../../lib/medidas/medidas';
import styles from './CampoMedida.module.css';

interface CampoMedidaProps {
  rotulo: string;
  /** Valor atual, na unidade guardada (mm por padrão) */
  valor: number;
  /** Limites aceitos, na unidade guardada */
  min: number;
  max: number;
  /** Como mostrar e interpretar o valor; cm por padrão */
  unidade?: UnidadeCampo;
  /**
   * Substitui a conta padrão (avaliarExpressao) por uma que também entende fórmulas com
   * referências, como "Parent!largura/2"; ausente nos campos fora da hierarquia do editor
   * (ex.: planta do ambiente). `formula` diz se o texto tinha alguma referência
   */
  resolverExpressao?: (texto: string) => { valor: number; formula: boolean } | null;
  /** Fórmula ativa deste campo, se houver: mostrada (em vez do número) ao ganhar foco, pra poder
   * ser editada como fórmula de novo em vez de sobrescrita sem querer */
  formula?: string;
  /**
   * Recebe o resultado na unidade guardada e, quando o texto era uma fórmula viva, o texto bruto
   * dela também; devolver false indica que não pôde ser aplicado
   */
  onConfirmar: (valor: number, formula?: string) => boolean | void;
  /** Mensagem mostrada quando onConfirmar devolve false */
  mensagemRecusa?: string;
  /** Erro vindo de fora, como a validação de um formulário ou uma fórmula que não resolveu */
  erro?: string;
  /** Cadeado: quando `onAlternarTrava` existe, mostra o botão; `travado` diz se está ativo */
  travado?: boolean;
  onAlternarTrava?: () => void;
}

// Campo numérico que aceita contas ("60+1,8", "120/2"), em cm por padrão, e — quando
// `resolverExpressao` é passado — também fórmulas com referências. O valor só é aplicado ao sair
// do campo ou com Enter, quando a conta é resolvida; Esc volta ao valor atual. `ref` dá acesso ao
// <input> de verdade, pra quem precisar focar o campo de fora (ex.: um atalho de teclado)
const CampoMedida = forwardRef<HTMLInputElement, CampoMedidaProps>(function CampoMedida({
  rotulo,
  valor,
  min,
  max,
  unidade = UNIDADE_CM,
  resolverExpressao,
  formula,
  onConfirmar,
  mensagemRecusa = 'Não foi possível aplicar este valor',
  erro: erroExterno,
  travado = false,
  onAlternarTrava,
}, ref) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const idCampo = useId();
  const idErro = useId();

  function confirmar() {
    if (rascunho === null) return;

    const resolvido = resolverExpressao
      ? resolverExpressao(rascunho)
      : ((valor) => (valor === null ? null : { valor, formula: false }))(avaliarExpressao(rascunho));
    if (resolvido === null) {
      setErro(
        formula || /parent!/i.test(rascunho)
          ? 'Não foi possível calcular esta fórmula'
          : 'Conta inválida: use números, vírgula e + − × ÷ ( )',
      );
      return;
    }
    const convertido = unidade.converter(resolvido.valor);
    if (convertido < min || convertido > max) {
      const comUnidade = (v: number) =>
        unidade.simbolo === '°' ? `${unidade.formatar(v)}°` : `${unidade.formatar(v)} ${unidade.simbolo}`;
      setErro(`Resultado ${comUnidade(convertido)}: use de ${comUnidade(min)} a ${comUnidade(max)}`);
      return;
    }
    if (onConfirmar(convertido, resolvido.formula ? rascunho.trim() : undefined) === false) {
      setErro(mensagemRecusa);
      return;
    }

    setErro(null);
    setRascunho(null);
  }

  function desfazer() {
    setRascunho(null);
    setErro(null);
  }

  const mensagem = erro ?? erroExterno;

  return (
    <div className={styles.campo}>
      <div className={styles.cabecalho}>
        <label htmlFor={idCampo} className={styles.rotulo}>
          {rotulo}
          <span className={styles.somenteLeitor}> ({unidade.nome})</span>
        </label>
        {onAlternarTrava && (
          <button
            type="button"
            className={`${styles.trava} ${travado ? styles.travaAtiva : ''}`}
            aria-pressed={travado}
            aria-label={`${travado ? 'Destravar' : 'Travar'} ${rotulo}`}
            title={travado ? 'Travado: não muda quando o pai é redimensionado' : 'Travar este valor'}
            onClick={onAlternarTrava}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d={travado ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
            </svg>
          </button>
        )}
      </div>
      <span className={styles.entrada}>
        <input
          ref={ref}
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={`${styles.input} ${formula ? styles.temFormula : ''}`}
          value={rascunho ?? unidade.formatar(valor)}
          title={formula ? `Fórmula: ${formula}` : 'Aceita contas, como 60+1,8 ou 120/2'}
          aria-invalid={Boolean(mensagem)}
          aria-describedby={mensagem ? idErro : undefined}
          onFocus={() => {
            // Ganhar foco com uma fórmula ativa mostra o texto dela (não o número), pra continuar
            // editando a fórmula em vez de sobrescrevê-la sem querer
            if (formula && rascunho === null) setRascunho(formula);
          }}
          onChange={(e) => {
            setRascunho(e.target.value);
            setErro(null);
          }}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Não envia o formulário: só resolve a conta
              e.preventDefault();
              confirmar();
            } else if (e.key === 'Escape') {
              desfazer();
            }
          }}
        />
        <span className={styles.unidade} aria-hidden="true">
          {unidade.simbolo}
        </span>
        {formula && (
          <span className={styles.marcaFormula} aria-hidden="true" title={`Fórmula: ${formula}`}>
            ƒ
          </span>
        )}
      </span>
      {mensagem && (
        <span id={idErro} className={styles.erro} role="alert">
          {mensagem}
        </span>
      )}
    </div>
  );
});

export default CampoMedida;
