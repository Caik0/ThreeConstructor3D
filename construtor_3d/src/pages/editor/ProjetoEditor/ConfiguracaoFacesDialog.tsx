import { useEffect, useRef, useState } from 'react';
import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import {
  facesDoElemento,
  nomeDeGrupoDeFaceValido,
  TAMANHO_NOME_ELEMENTO,
  TAMANHO_NOME_VARIAVEL,
  type MembroGrupoDeFace,
} from '../../../lib/projetos/projetos';
import { nomeDeVariavelValido, ordemNaArvore, useEditorStore, type ElementoEditor } from '../../../store/editorStore';
import dialogoStyles from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao.module.css';
import { CampoVariavel } from './PainelElemento';
import styles from './ProjetoEditor.module.css';

interface ConfiguracaoFacesDialogProps {
  aberto: boolean;
  onFechar: () => void;
  chave: string;
  elemento: ElementoEditor;
  faces: string[];
}

interface DescendentePintavel {
  chave: string;
  nome: string;
  faces: string[];
}

/** Um membro de grupo de face como a UI trabalha: pela chave viva do elemento nesta sessão do
 * editor, não pelo idUnico persistido (ver `MembroGrupoDeFace`) — a tradução de um lado pro outro
 * fica só na borda (ler/gravar `elemento.gruposDeFace`), o resto do diálogo nem sabe que idUnico existe */
interface MembroVivo {
  chave: string;
  face: string;
}

// Tudo que depende de "qual face" numa modal só: variáveis específicas de uma face da própria
// peça/parede/piso (furação, ferragem etc.) e, só em grupos, os grupos de face usados pra pintar
// de uma vez no balde de tinta — um grupo de módulos (gaveteiro, armário) é pintado como um
// conjunto, então cada grupo de face reúne faces de VÁRIOS descendentes dele, não só das suas
// próprias (um grupo não tem face própria)
export default function ConfiguracaoFacesDialog({ aberto, onFechar, chave, elemento, faces }: ConfiguracaoFacesDialogProps) {
  const definirVariavelDeFace = useEditorStore((s) => s.definirVariavelDeFace);
  const removerVariavelDeFace = useEditorStore((s) => s.removerVariavelDeFace);
  const definirGrupoDeFace = useEditorStore((s) => s.definirGrupoDeFace);
  const removerGrupoDeFace = useEditorStore((s) => s.removerGrupoDeFace);
  const todosElementos = useEditorStore((s) => s.elementos);
  const filhos = useEditorStore((s) => s.filhos);
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const [faceSelecionada, setFaceSelecionada] = useState<string | null>(null);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  const faceAtual = faceSelecionada && faces.includes(faceSelecionada) ? faceSelecionada : faces[0];
  const nomesGrupos = Object.keys(elemento.gruposDeFace ?? {}).sort();

  // Qualquer descendente (filho, neto...) deste grupo que tenha face própria pra oferecer — um
  // grupo de face pode misturar faces de peças bem fundo na árvore (ex.: dentro de um subgrupo)
  const descendentes: DescendentePintavel[] =
    elemento.tipo === 'grupo'
      ? ordemNaArvore(filhos, chave)
          .map((c) => todosElementos[c])
          .filter((e): e is ElementoEditor => !!e)
          .map((e) => ({ chave: e.chave, nome: e.nome, faces: facesDoElemento(e) }))
          .filter((d) => d.faces.length > 0)
      : [];
  const nomeDoDescendente = (chaveMembro: string) => descendentes.find((d) => d.chave === chaveMembro)?.nome ?? '?';

  // Traduz os membros guardados (pela referenciaEstavel, nunca mostrada na cena) pros vivos (pela
  // chave desta sessão), pro resto do diálogo trabalhar só com chave — se o elemento dono não
  // existir mais, cai num "?" (igual a uma referência Parent! que perdeu o alvo), em vez de sumir
  function membrosVivos(armazenados: MembroGrupoDeFace[]): MembroVivo[] {
    return armazenados.map(({ referencia, face }) => {
      const vivo = Object.values(todosElementos).find((e) => e.referenciaEstavel === referencia);
      return { chave: vivo?.chave ?? referencia, face };
    });
  }

  return (
    <dialog
      ref={dialogoRef}
      className={styles.dialogoLargo}
      aria-label="Configuração de faces"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={dialogoStyles.conteudo}>
        <h2 className={dialogoStyles.titulo}>Configuração de faces</h2>

        {faces.length > 0 && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Variáveis por face
                <Ajuda
                  rotulo="Ajuda sobre variáveis por face"
                  texto="Escolha uma face e cadastre variáveis específicas dela (furação, ferragem e outras medidas fixas). Aceita número ou fórmula, do mesmo jeito que as variáveis comuns do elemento."
                />
              </span>
            </legend>
            <div className={styles.facesBotoes}>
              {faces.map((face) => (
                <button
                  key={face}
                  type="button"
                  className={face === faceAtual ? styles.botaoFaceAtivo : styles.botaoFace}
                  onClick={() => setFaceSelecionada(face)}
                >
                  {face}
                </button>
              ))}
            </div>
            {Object.entries(elemento.variaveisPorFaceFormulas?.[faceAtual] ?? {}).map(([nomeVariavel, texto]) => (
              <CampoVariavel
                key={nomeVariavel}
                nome={nomeVariavel}
                texto={texto}
                erro={elemento.errosFormula?.[`variavelFace:${faceAtual}:${nomeVariavel}`]}
                onSalvar={(novoTexto) => definirVariavelDeFace(chave, faceAtual, nomeVariavel, novoTexto)}
                onRemover={() => removerVariavelDeFace(chave, faceAtual, nomeVariavel)}
              />
            ))}
            <NovaVariavelDeFace
              elemento={elemento}
              face={faceAtual}
              onCriar={(nomeVariavel, texto) => definirVariavelDeFace(chave, faceAtual, nomeVariavel, texto)}
            />
          </fieldset>
        )}

        {elemento.tipo === 'grupo' && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Grupos de face
                <Ajuda
                  rotulo="Ajuda sobre grupos de face"
                  texto="Reúna faces de peças deste grupo (ex.: “Caixa” = a face esquerda de uma peça, a direita de outra, o fundo de uma terceira) pra pintar todas de uma vez no balde de tinta."
                />
              </span>
            </legend>

            {descendentes.length === 0 ? (
              <p>Nenhuma peça com face dentro deste grupo ainda.</p>
            ) : (
              <>
                {nomesGrupos.length === 0 ? (
                  <p>Nenhum grupo ainda.</p>
                ) : (
                  nomesGrupos.map((nome) => (
                    <GrupoDeFaceLinha
                      key={nome}
                      nome={nome}
                      membros={membrosVivos(elemento.gruposDeFace?.[nome] ?? [])}
                      descendentes={descendentes}
                      nomeDoDescendente={nomeDoDescendente}
                      onAlterar={(novosMembros) => definirGrupoDeFace(chave, nome, novosMembros)}
                      onRemover={() => removerGrupoDeFace(chave, nome)}
                    />
                  ))
                )}
                <NovoGrupoDeFace
                  descendentes={descendentes}
                  nomeDoDescendente={nomeDoDescendente}
                  existentes={nomesGrupos}
                  onCriar={(nome, membros) => definirGrupoDeFace(chave, nome, membros)}
                />
              </>
            )}
          </fieldset>
        )}

        <div className={dialogoStyles.acoes}>
          <button type="button" className={dialogoStyles.cancelar} onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface NovaVariavelDeFaceProps {
  elemento: ElementoEditor;
  face: string;
  onCriar: (nome: string, texto: string) => void;
}

// Mesma UI de NovaVariavel (ver PainelElemento), mas o nome só precisa ser único dentro da própria
// face — faces diferentes podem ter uma variável de mesmo nome sem colidir (cada uma na sua caixinha)
function NovaVariavelDeFace({ elemento, face, onCriar }: NovaVariavelDeFaceProps) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const nomeLimpo = nome.trim();
    const valorLimpo = valor.trim();
    if (!nomeDeVariavelValido(elemento, nomeLimpo)) {
      setErro('Nome inválido, ou já é um campo deste elemento');
      return;
    }
    if (elemento.variaveisPorFaceFormulas?.[face]?.[nomeLimpo]) {
      setErro('Já existe uma variável com este nome nesta face');
      return;
    }
    if (valorLimpo === '') {
      setErro('Informe um número ou uma fórmula');
      return;
    }
    onCriar(nomeLimpo, valorLimpo);
    setNome('');
    setValor('');
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
        placeholder="valor ou fórmula"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
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

interface AdicionarMembroProps {
  descendentes: DescendentePintavel[];
  jaNoGrupo: MembroVivo[];
  onAdicionar: (membros: MembroVivo[]) => void;
}

// Escolhe um módulo (dentre os descendentes deste grupo) e marca uma ou mais faces dele, pra
// adicionar tudo de uma vez — trocar de módulo limpa a marcação em andamento
function AdicionarMembro({ descendentes, jaNoGrupo, onAdicionar }: AdicionarMembroProps) {
  const [chaveEscolhida, setChaveEscolhida] = useState(descendentes[0]?.chave ?? '');
  const [facesMarcadas, setFacesMarcadas] = useState<string[]>([]);
  const descendente = descendentes.find((d) => d.chave === chaveEscolhida) ?? descendentes[0];
  if (!descendente) return null;

  const facesDisponiveis = descendente.faces.filter(
    (face) => !jaNoGrupo.some((m) => m.chave === descendente.chave && m.face === face),
  );
  const todasMarcadas = facesDisponiveis.length > 0 && facesDisponiveis.every((face) => facesMarcadas.includes(face));

  function alternar(face: string) {
    setFacesMarcadas((atual) => (atual.includes(face) ? atual.filter((f) => f !== face) : [...atual, face]));
  }

  function alternarTodos() {
    setFacesMarcadas(todasMarcadas ? [] : [...facesDisponiveis]);
  }

  function adicionar() {
    if (facesMarcadas.length === 0) return;
    onAdicionar(facesMarcadas.map((face) => ({ chave: descendente.chave, face })));
    setFacesMarcadas([]);
  }

  return (
    <div className={styles.linhaAdicionarMembro}>
      <select
        className={styles.input}
        value={descendente.chave}
        onChange={(e) => {
          setChaveEscolhida(e.target.value);
          setFacesMarcadas([]);
        }}
      >
        {descendentes.map((d) => (
          <option key={d.chave} value={d.chave}>
            {d.nome}
          </option>
        ))}
      </select>
      <div className={styles.facesBotoes}>
        {facesDisponiveis.length > 1 && (
          <button
            type="button"
            className={todasMarcadas ? styles.botaoFaceAtivo : styles.botaoFace}
            onClick={alternarTodos}
          >
            Todos
          </button>
        )}
        {descendente.faces.map((face) => {
          const jaAdicionada = jaNoGrupo.some((m) => m.chave === descendente.chave && m.face === face);
          return (
            <button
              key={face}
              type="button"
              disabled={jaAdicionada}
              title={jaAdicionada ? 'Essa face já está no grupo' : undefined}
              className={facesMarcadas.includes(face) ? styles.botaoFaceAtivo : styles.botaoFace}
              onClick={() => alternar(face)}
            >
              {face}
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.botaoSecundario} disabled={facesMarcadas.length === 0} onClick={adicionar}>
        Adicionar
      </button>
    </div>
  );
}

interface ChipsDeMembrosProps {
  membros: MembroVivo[];
  descendentes: DescendentePintavel[];
  nomeDoDescendente: (chave: string) => string;
  onRemover: (paraRemover: MembroVivo[]) => void;
}

// Um chip por elemento + face, exceto quando TODAS as faces de um elemento já estão no grupo: aí
// vira um chip "Todos" só (removê-lo tira as faces dele todas de uma vez), em vez de uma fileira
// inteira de chips repetindo o mesmo nome de elemento
function ChipsDeMembros({ membros, descendentes, nomeDoDescendente, onRemover }: ChipsDeMembrosProps) {
  if (membros.length === 0) return null;

  const porElemento = new Map<string, MembroVivo[]>();
  for (const membro of membros) porElemento.set(membro.chave, [...(porElemento.get(membro.chave) ?? []), membro]);

  return (
    <div className={styles.facesBotoes}>
      {[...porElemento.entries()].flatMap(([chaveElemento, membrosDoElemento]) => {
        const totalFaces = descendentes.find((d) => d.chave === chaveElemento)?.faces.length ?? 0;
        if (totalFaces > 0 && membrosDoElemento.length === totalFaces) {
          return (
            <button
              key={chaveElemento}
              type="button"
              className={styles.botaoFaceAtivo}
              onClick={() => onRemover(membrosDoElemento)}
              title="Remover todas as faces deste elemento do grupo"
            >
              {nomeDoDescendente(chaveElemento)} → Todos ×
            </button>
          );
        }
        return membrosDoElemento.map((membro) => (
          <button
            key={`${membro.chave}:${membro.face}`}
            type="button"
            className={styles.botaoFaceAtivo}
            onClick={() => onRemover([membro])}
            title="Remover do grupo"
          >
            {nomeDoDescendente(membro.chave)} → {membro.face} ×
          </button>
        ));
      })}
    </div>
  );
}

interface GrupoDeFaceLinhaProps {
  nome: string;
  membros: MembroVivo[];
  descendentes: DescendentePintavel[];
  nomeDoDescendente: (chave: string) => string;
  onAlterar: (membros: MembroVivo[]) => void;
  onRemover: () => void;
}

// Um grupo já criado: nome fixo (renomear perderia a ligação com o que já foi pintado por esse
// grupo antes), as faces já escolhidas (cada uma removível) e o seletor pra acrescentar mais —
// começa fechado (só o nome e a contagem), pra uma lista com vários grupos não virar uma parede de
// chips; clicar no nome abre pra ver/editar os membros dele
function GrupoDeFaceLinha({ nome, membros, descendentes, nomeDoDescendente, onAlterar, onRemover }: GrupoDeFaceLinhaProps) {
  const [expandido, setExpandido] = useState(false);

  function adicionar(novosMembros: MembroVivo[]) {
    const semDuplicata = novosMembros.filter((m) => !membros.some((x) => x.chave === m.chave && x.face === m.face));
    if (semDuplicata.length > 0) onAlterar([...membros, ...semDuplicata]);
  }
  function remover(paraRemover: MembroVivo[]) {
    onAlterar(membros.filter((m) => !paraRemover.some((p) => p.chave === m.chave && p.face === m.face)));
  }

  return (
    <div className={styles.cartaoGrupoDeFace}>
      <div className={styles.cabecalhoGrupoDeFace}>
        <button
          type="button"
          className={styles.botaoExpandirGrupo}
          onClick={() => setExpandido((atual) => !atual)}
          aria-expanded={expandido}
        >
          <span aria-hidden="true">{expandido ? '▾' : '▸'}</span>
          <span className={styles.variavelNome}>{nome}</span>
          <span className={styles.contagemGrupoDeFace}>
            ({membros.length} {membros.length === 1 ? 'face' : 'faces'})
          </span>
        </button>
        <button type="button" className={styles.botaoSecundario} onClick={onRemover}>
          Remover grupo
        </button>
      </div>
      {expandido && (
        <>
          <ChipsDeMembros membros={membros} descendentes={descendentes} nomeDoDescendente={nomeDoDescendente} onRemover={remover} />
          <AdicionarMembro descendentes={descendentes} jaNoGrupo={membros} onAdicionar={adicionar} />
        </>
      )}
    </div>
  );
}

interface NovoGrupoDeFaceProps {
  descendentes: DescendentePintavel[];
  nomeDoDescendente: (chave: string) => string;
  existentes: string[];
  onCriar: (nome: string, membros: MembroVivo[]) => void;
}

function NovoGrupoDeFace({ descendentes, nomeDoDescendente, existentes, onCriar }: NovoGrupoDeFaceProps) {
  const [nome, setNome] = useState('');
  const [membros, setMembros] = useState<MembroVivo[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function adicionar(novosMembros: MembroVivo[]) {
    setMembros((atual) => [
      ...atual,
      ...novosMembros.filter((m) => !atual.some((x) => x.chave === m.chave && x.face === m.face)),
    ]);
    setErro(null);
  }
  function remover(paraRemover: MembroVivo[]) {
    setMembros((atual) => atual.filter((m) => !paraRemover.some((p) => p.chave === m.chave && p.face === m.face)));
  }

  function criar() {
    const nomeLimpo = nome.trim();
    if (!nomeDeGrupoDeFaceValido(nomeLimpo)) {
      setErro('Informe um nome pro grupo');
      return;
    }
    if (existentes.includes(nomeLimpo)) {
      setErro('Já existe um grupo com este nome');
      return;
    }
    if (membros.length === 0) {
      setErro('Adicione ao menos uma face');
      return;
    }
    onCriar(nomeLimpo, membros);
    setNome('');
    setMembros([]);
    setErro(null);
  }

  return (
    <div className={styles.cartaoGrupoDeFace}>
      <input
        className={styles.input}
        placeholder="nome do grupo"
        value={nome}
        maxLength={TAMANHO_NOME_ELEMENTO}
        onChange={(e) => {
          setNome(e.target.value);
          setErro(null);
        }}
      />
      <ChipsDeMembros membros={membros} descendentes={descendentes} nomeDoDescendente={nomeDoDescendente} onRemover={remover} />
      <AdicionarMembro descendentes={descendentes} jaNoGrupo={membros} onAdicionar={adicionar} />
      <button type="button" className={styles.botaoSecundario} onClick={criar}>
        + Grupo
      </button>
      {erro && (
        <span className={styles.erro} role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
