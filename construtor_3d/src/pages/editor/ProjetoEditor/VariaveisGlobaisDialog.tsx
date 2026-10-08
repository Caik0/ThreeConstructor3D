import { useEffect, useRef, useState } from 'react';
import { avaliarExpressao } from '../../../lib/medidas/medidas';
import { TAMANHO_NOME_VARIAVEL } from '../../../lib/projetos/projetos';
import { nomeDeVariavelGlobalValido, useEditorStore } from '../../../store/editorStore';
import dialogoStyles from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao.module.css';
import styles from './ProjetoEditor.module.css';

interface VariaveisGlobaisDialogProps {
  aberto: boolean;
  onFechar: () => void;
}

// Cadastro das variáveis globais do projeto: um nome e um número (ou uma conta, resolvida na hora
// e guardada já pronta — ao contrário das variáveis de elemento, não vira uma fórmula ao vivo, já
// que uma variável global não tem "de onde" herdar nada nem outra variável global pra referenciar).
// Qualquer elemento acessa com "Global!nome" nos próprios campos ou variáveis, do mesmo jeito que
// "Parent!nome" acessa o elemento pai (ver resolverFormulaOuNumero em store/editorStore.ts)
export default function VariaveisGlobaisDialog({ aberto, onFechar }: VariaveisGlobaisDialogProps) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const variaveisGlobais = useEditorStore((s) => s.variaveisGlobais);
  const definirVariavelGlobal = useEditorStore((s) => s.definirVariavelGlobal);
  const removerVariavelGlobal = useEditorStore((s) => s.removerVariavelGlobal);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  const nomes = Object.keys(variaveisGlobais).sort();

  return (
    <dialog
      ref={dialogoRef}
      className={dialogoStyles.dialogo}
      aria-label="Variáveis globais do projeto"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={dialogoStyles.conteudo}>
        <h2 className={dialogoStyles.titulo}>Variáveis globais</h2>
        <p className={dialogoStyles.descricao}>
          Um número (ou uma conta, como “60*2”) disponível em qualquer elemento do projeto — em qualquer campo ou
          variável, acesse com <strong>Global!nome</strong> (ou o atalho <strong>Gl!nome</strong>).
        </p>

        {nomes.length === 0 ? (
          <p>Nenhuma variável global ainda.</p>
        ) : (
          nomes.map((nome) => (
            <CampoVariavelGlobal
              key={nome}
              nome={nome}
              valor={variaveisGlobais[nome]}
              onSalvar={(novoValor) => definirVariavelGlobal(nome, novoValor)}
              onRemover={() => removerVariavelGlobal(nome)}
            />
          ))
        )}
        <NovaVariavelGlobal existentes={variaveisGlobais} onCriar={definirVariavelGlobal} />

        <div className={dialogoStyles.acoes}>
          <button type="button" className={dialogoStyles.cancelar} onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface CampoVariavelGlobalProps {
  nome: string;
  valor: number;
  onSalvar: (valor: number) => void;
  onRemover: () => void;
}

// Uma variável já criada: nome fixo (renomear quebraria referências Global!nome em outro lugar) e
// um campo de texto livre pro valor, aceitando uma conta ("60*2"), confirmado ao sair do campo ou
// com Enter — igual ao campo de variável de elemento, só que sem fórmula viva nem erro guardado
function CampoVariavelGlobal({ nome, valor, onSalvar, onRemover }: CampoVariavelGlobalProps) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    if (rascunho === null) return;
    const limpo = rascunho.trim();
    if (limpo === '') {
      setRascunho(null);
      return;
    }
    const resolvido = avaliarExpressao(limpo);
    if (resolvido === null) {
      setErro('Conta inválida: use números, vírgula e + − × ÷ ( )');
      return;
    }
    if (resolvido !== valor) onSalvar(resolvido);
    setRascunho(null);
    setErro(null);
  }

  return (
    <div className={styles.variavelLinha}>
      <span className={styles.variavelNome} title={`Acesse com Global!${nome} (ou Gl!${nome})`}>
        {nome}
      </span>
      <input
        className={styles.input}
        value={rascunho ?? String(valor)}
        title="Número ou conta (ex.: 60*2)"
        aria-invalid={Boolean(erro)}
        onChange={(e) => {
          setRascunho(e.target.value);
          setErro(null);
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmar();
          } else if (e.key === 'Escape') {
            setRascunho(null);
            setErro(null);
          }
        }}
      />
      <button
        type="button"
        className={styles.removerVariavel}
        onClick={onRemover}
        aria-label={`Remover variável global ${nome}`}
        title="Remover variável"
      >
        ×
      </button>
      {erro && (
        <span className={styles.erro} role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}

interface NovaVariavelGlobalProps {
  existentes: Record<string, number>;
  onCriar: (nome: string, valor: number) => void;
}

function NovaVariavelGlobal({ existentes, onCriar }: NovaVariavelGlobalProps) {
  const [nome, setNome] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const nomeLimpo = nome.trim();
    const textoLimpo = texto.trim();
    if (!nomeDeVariavelGlobalValido(nomeLimpo)) {
      setErro('Nome inválido');
      return;
    }
    if (nomeLimpo in existentes) {
      setErro('Já existe uma variável global com este nome');
      return;
    }
    if (textoLimpo === '') {
      setErro('Informe um número ou uma conta');
      return;
    }
    const resolvido = avaliarExpressao(textoLimpo);
    if (resolvido === null) {
      setErro('Conta inválida: use números, vírgula e + − × ÷ ( )');
      return;
    }
    onCriar(nomeLimpo, resolvido);
    setNome('');
    setTexto('');
    setErro(null);
  }

  return (
    <div className={styles.novaVariavel}>
      <input
        className={styles.input}
        placeholder="nome"
        value={nome}
        maxLength={TAMANHO_NOME_VARIAVEL}
        onChange={(e) => {
          setNome(e.target.value);
          setErro(null);
        }}
      />
      <input
        className={styles.input}
        placeholder="valor ou conta"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setErro(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            adicionar();
          }
        }}
      />
      <button type="button" className={styles.botaoSecundario} onClick={adicionar}>
        + Variável
      </button>
      {erro && (
        <span className={styles.erro} role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
