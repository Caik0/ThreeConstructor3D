import { useId, useState } from 'react';
import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import CampoMedida from '../../../components/ui/CampoMedida/CampoMedida';
import ConfiguracaoFacesDialog from './ConfiguracaoFacesDialog';
import { chaveRaioQuina, FORMAS, parametrosPadrao, QUINAS_CAIXA, TIPOS_FORMA_NOVOS } from '../../../lib/formas/formas';
import { UNIDADE_GRAUS } from '../../../lib/medidas/medidas';
import {
  LIMITE_POSICAO,
  MEDIDA_MAXIMA,
  MEDIDA_MINIMA,
  PAREDE_COMPRIMENTO_MAXIMO,
  TAMANHO_MAXIMO_GRUPO,
  TAMANHO_NOME_ELEMENTO,
  TAMANHO_NOME_VARIAVEL,
  descreverAbertura,
  facesDoElemento,
  type Posicao,
  type TipoAbertura,
} from '../../../lib/projetos/projetos';
import { normalizarGraus } from '../../../lib/transformacoes/transformacoes';
import { nomeDeVariavelValido, resolverFormulaOuNumero, useEditorStore, type ElementoEditor } from '../../../store/editorStore';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import styles from './ProjetoEditor.module.css';

const EIXOS: { chave: keyof Posicao; rotulo: string }[] = [
  { chave: 'x', rotulo: 'X (largura)' },
  { chave: 'y', rotulo: 'Y (profundidade)' },
  { chave: 'z', rotulo: 'Z (altura)' },
];

// Um vão só se move nos dois eixos da parede-mãe (não tem profundidade própria)
const EIXOS_ABERTURA: { chave: 'x' | 'z'; rotulo: string }[] = [
  { chave: 'x', rotulo: 'Deslocamento' },
  { chave: 'z', rotulo: 'Peitoril' },
];

const EIXOS_ROTACAO: { chave: keyof Posicao; rotulo: string }[] = [
  { chave: 'x', rotulo: 'Em X' },
  { chave: 'y', rotulo: 'Em Y' },
  { chave: 'z', rotulo: 'Em Z (vertical)' },
];

// Rótulo de cada eixo do tamanho do grupo e a chave endereçável correspondente (ver
// `camposEnderecaveisDoElemento`, no editorStore), pra um filho poder escrever "Parent!largura"
const MEDIDAS_GRUPO: { eixo: keyof Posicao; rotulo: string; campo: string }[] = [
  { eixo: 'x', rotulo: 'Largura', campo: 'largura' },
  { eixo: 'z', rotulo: 'Altura', campo: 'altura' },
  { eixo: 'y', rotulo: 'Profundidade', campo: 'profundidade' },
];

// Parâmetros de raio das quinas da caixa: ficam fora da lista de "Medidas" (mostrados à parte,
// com o controle de raio único ou por quina — ver seção "Quinas")
const CAMPOS_QUINA = new Set(QUINAS_CAIXA.map(chaveRaioQuina));
// Representante das 4 quinas pro campo "Raio das quinas" (min/max e valor mostrado são os mesmos
// nas 4, já que é sempre a mesma definição de parâmetro — só o valor de cada peça pode divergir)
const campoPrimeiraQuina = chaveRaioQuina(QUINAS_CAIXA[0]);
const parametroPorChave = (campo: string) => FORMAS.caixa.parametros.find((p) => p.chave === campo)!;

const MEDIDAS_PAREDE: { chave: 'comprimento' | 'altura' | 'espessura'; rotulo: string; max: number }[] = [
  { chave: 'comprimento', rotulo: 'Comprimento', max: PAREDE_COMPRIMENTO_MAXIMO },
  { chave: 'altura', rotulo: 'Altura', max: MEDIDA_MAXIMA },
  { chave: 'espessura', rotulo: 'Espessura', max: MEDIDA_MAXIMA },
];

const NOME_TIPO: Record<'peca' | 'grupo' | 'parede' | 'piso' | 'abertura', string> = {
  peca: 'Peça',
  grupo: 'Grupo',
  parede: 'Parede',
  piso: 'Piso',
  abertura: 'Vão',
};

const NOME_TIPO_ABERTURA: Record<TipoAbertura, string> = { porta: 'Porta', janela: 'Janela' };

interface PainelElementoProps {
  /** Fecha o painel limpando a seleção */
  onFechar: () => void;
}

export default function PainelElemento({ onFechar }: PainelElementoProps) {
  const elementos = useEditorStore((s) => s.elementos);
  const elemento = useEditorStore((s) => (s.selecionada ? s.elementos[s.selecionada] : undefined));
  const filhos = useEditorStore((s) => s.filhos);
  const variaveisGlobais = useEditorStore((s) => s.variaveisGlobais);
  const atualizar = useEditorStore((s) => s.atualizar);
  const definirCampo = useEditorStore((s) => s.definirCampo);
  const definirVariavel = useEditorStore((s) => s.definirVariavel);
  const removerVariavel = useEditorStore((s) => s.removerVariavel);
  const alternarTrava = useEditorStore((s) => s.alternarTrava);
  const adicionarAbertura = useEditorStore((s) => s.adicionarAbertura);
  const redimensionarGrupo = useEditorStore((s) => s.redimensionarGrupo);
  const abrirContexto = useEditorStore((s) => s.abrirContexto);
  const abrirExplosao = useEditorStore((s) => s.abrirExplosao);
  const selecionar = useEditorStore((s) => s.selecionar);
  const idErroNome = useId();
  const [quinasIndividuais, setQuinasIndividuais] = useState(false);
  const [configuracaoFacesAberta, setConfiguracaoFacesAberta] = useState(false);
  const podeEditarNomeColisao = useTemPermissao(PERMISSOES.ELEMENTO_EDITAR_NOME_COLISAO);
  const podeRedimensionar = useTemPermissao(PERMISSOES.ELEMENTO_REDIMENSIONAR);
  const podePosicaoRotacao = useTemPermissao(PERMISSOES.ELEMENTO_POSICAO_ROTACAO);
  const podeVaos = useTemPermissao(PERMISSOES.ELEMENTO_VAOS);
  const podeVariaveisFormulas = useTemPermissao(PERMISSOES.ELEMENTO_VARIAVEIS_FORMULAS);
  const podeConfigurarFaces = useTemPermissao(PERMISSOES.ELEMENTO_CONFIGURAR_FACES);

  if (!elemento) return null;

  const { chave, tipo, nome, pai, forma, modelo3d, posicao, rotacao, tamanho, colisao, parede, piso, abertura } = elemento;
  const faces = facesDoElemento(elemento);
  const nomeInvalido = nome.trim() === '';
  const totalFilhos = filhos[chave]?.length ?? 0;
  // Só existe pra um vão: a parede que o contém, cujas medidas limitam as dele
  const paredePai = abertura && pai ? elementos[pai]?.parede : undefined;
  const titulo = abertura ? NOME_TIPO_ABERTURA[abertura.tipo] : NOME_TIPO[tipo];

  // Cada CampoMedida ligado a um campo endereçável (posição, rotação, medidas) recebe os mesmos
  // três fios: o resolvedor de fórmulas, a fórmula ativa (se houver) e o erro dela
  const camposFormula = (campo: string) => ({
    resolverExpressao: (texto: string) => resolverFormulaOuNumero(texto, elementos, chave, campo, variaveisGlobais),
    formula: elemento.formulas?.[campo],
    erro: elemento.errosFormula?.[campo],
    onConfirmar: (valor: number, formula?: string) =>
      definirCampo(chave, campo, formula ? { formula } : { valor }),
    travado: elemento.travados?.includes(campo) ?? false,
    onAlternarTrava: () => alternarTrava(chave, campo),
  });

  const girarEmZ = (graus: number) => {
    const novoValor = normalizarGraus(rotacao.z + graus);
    // Com uma fórmula ativa em rotacaoZ, o botão só teria efeito por um instante (o próximo
    // recálculo devolveria o valor da fórmula): limpa a fórmula pra o clique valer de verdade
    if (elemento.formulas?.rotacaoZ) definirCampo(chave, 'rotacaoZ', { valor: novoValor });
    else atualizar(chave, { rotacao: { ...rotacao, z: novoValor } });
  };

  return (
    <section>
      <div className={styles.painelTopo}>
        <h2 className={styles.secaoTitulo}>
          {titulo}
          <Ajuda
            rotulo="Ajuda sobre os campos"
            texto="Medidas em cm e ângulos em graus. Os campos aceitam contas (60+1,8) e fórmulas, como no SketchUp: sem prefixo referencia outro campo ou variável deste mesmo elemento (largura/2), e com Parent! (ou o atalho Pr!) referencia o elemento pai (Parent!largura/2, Pr!Pr!altura para o avô, ou Pr!*2altura pra não repetir). lenX/lenY/lenZ dá o tamanho de qualquer elemento (o próprio, ou Parent!lenX etc.) em qualquer eixo, seja qual for o tipo. Enter aplica, Esc desfaz."
          />
        </h2>
        <button
          type="button"
          className={styles.fechar}
          onClick={onFechar}
          aria-label="Fechar propriedades"
          title="Fechar (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className={styles.campos}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            className={styles.input}
            value={nome}
            maxLength={TAMANHO_NOME_ELEMENTO}
            aria-invalid={nomeInvalido}
            aria-describedby={nomeInvalido ? idErroNome : undefined}
            disabled={!podeEditarNomeColisao}
            onChange={(e) => atualizar(chave, { nome: e.target.value })}
          />
          {nomeInvalido && (
            <span id={idErroNome} className={styles.erro}>
              Informe um nome
            </span>
          )}
        </label>

        {!abertura && podeEditarNomeColisao && (
          <label className={styles.colisao}>
            <input
              type="checkbox"
              checked={colisao}
              onChange={(e) => atualizar(chave, { colisao: e.target.checked })}
            />
            <span className={styles.rotuloComAjuda}>
              <span className={styles.rotulo}>Colisão</span>
              <Ajuda
                rotulo="Ajuda sobre colisão"
                texto="Bloqueia o movimento contra outro elemento que também tenha a colisão ativada."
              />
            </span>
          </label>
        )}

        {(tipo === 'grupo' || tipo === 'peca') && (
          <>
            <div className={styles.grupoInfo}>
              <span>
                {totalFilhos} {totalFilhos === 1 ? 'elemento' : 'elementos'}
              </span>
              <button type="button" className={styles.botaoSecundario} onClick={() => abrirContexto(chave)}>
                Editar conteúdo
              </button>
            </div>

            {(elemento.idUnico || elemento.idSequencial) && (
              <div className={styles.grupoInfo}>
                {elemento.idSequencial && <span>{elemento.idSequencial}</span>}
                {elemento.idUnico && <span>ID {elemento.idUnico}</span>}
              </div>
            )}

            {totalFilhos > 0 && (
              <button type="button" className={styles.botaoSecundario} onClick={() => abrirExplosao(chave)}>
                Vista explodida
              </button>
            )}

            {tipo === 'grupo' && tamanho && podeRedimensionar && (
              <fieldset className={styles.grupo}>
                <legend className={styles.grupoTitulo}>
                  <span className={styles.rotuloComAjuda}>
                    Medidas
                    <Ajuda
                      rotulo="Ajuda sobre as medidas do grupo"
                      texto="Alterar uma medida redimensiona proporcionalmente tudo o que está dentro do grupo. O tamanho do grupo é fixo: mudar as peças não o altera. Uma fórmula só muda o tamanho do grupo, sem escalar o conteúdo."
                    />
                  </span>
                </legend>
                {MEDIDAS_GRUPO.map(({ eixo, rotulo, campo }) => (
                  <CampoMedida
                    key={`${chave}-tamanho-${eixo}`}
                    rotulo={rotulo}
                    valor={tamanho[eixo]}
                    min={1}
                    max={TAMANHO_MAXIMO_GRUPO}
                    mensagemRecusa="Não aplicado: alguma peça ficaria com medida fora dos limites"
                    resolverExpressao={(texto) => resolverFormulaOuNumero(texto, elementos, chave, campo, variaveisGlobais)}
                    formula={elemento.formulas?.[campo]}
                    erro={elemento.errosFormula?.[campo]}
                    travado={elemento.travados?.includes(campo) ?? false}
                    onAlternarTrava={() => alternarTrava(chave, campo)}
                    onConfirmar={(valor, formula) => {
                      if (formula) {
                        definirCampo(chave, campo, { formula });
                        return;
                      }
                      // Uma fórmula antiga é limpa à parte: o valor de verdade vem do
                      // redimensionamento, que escala o conteúdo do grupo (a fórmula não escala)
                      if (elemento.formulas?.[campo]) definirCampo(chave, campo, { valor: tamanho[eixo] });
                      redimensionarGrupo(chave, { ...tamanho, [eixo]: valor });
                    }}
                  />
                ))}
              </fieldset>
            )}
          </>
        )}

        {modelo3d && tamanho && podeRedimensionar && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Medidas
                <Ajuda
                  rotulo="Ajuda sobre as medidas do modelo 3D"
                  texto="Redimensiona a malha importada nos três eixos, cada um independente (pode distorcer as proporções originais)."
                />
              </span>
            </legend>
            {MEDIDAS_GRUPO.map(({ eixo, rotulo, campo }) => (
              <CampoMedida
                key={`${chave}-modelo3d-${eixo}`}
                rotulo={rotulo}
                valor={tamanho[eixo]}
                min={MEDIDA_MINIMA}
                max={TAMANHO_MAXIMO_GRUPO}
                {...camposFormula(campo)}
              />
            ))}
          </fieldset>
        )}

        {forma && podeRedimensionar && (
          <>
            <fieldset className={styles.grupo}>
              <legend className={styles.grupoTitulo}>Forma</legend>
              <div className={styles.tipos}>
                {/* Cilindro não é mais oferecido pra peça nova (uma caixa com as quinas no raio
                    máximo já faz o mesmo formato) — mas uma peça já salva como cilindro continua
                    aparecendo aqui, senão o rádio ficaria sem nenhuma opção marcada */}
                {[...new Set([...TIPOS_FORMA_NOVOS, forma.tipo])].map((tipoForma) => (
                  <label key={tipoForma} className={styles.tipo}>
                    <input
                      type="radio"
                      name={`tipo-${chave}`}
                      checked={forma.tipo === tipoForma}
                      // Trocar a forma recomeça das medidas padrão da nova forma
                      onChange={() =>
                        atualizar(chave, { forma: { tipo: tipoForma, parametros: parametrosPadrao(tipoForma) } })
                      }
                    />
                    {FORMAS[tipoForma].nome}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.grupo}>
              <legend className={styles.grupoTitulo}>Medidas</legend>
              {FORMAS[forma.tipo].parametros
                .filter((p) => !CAMPOS_QUINA.has(p.chave))
                .map((p) => (
                  <CampoMedida
                    key={`${chave}-${forma.tipo}-${p.chave}`}
                    rotulo={p.rotulo}
                    valor={forma.parametros[p.chave]}
                    min={p.min}
                    max={p.max}
                    {...camposFormula(p.chave)}
                  />
                ))}
            </fieldset>

            {forma.tipo === 'caixa' && (
              <fieldset className={styles.grupo}>
                <legend className={styles.grupoTitulo}>
                  <span className={styles.rotuloComAjuda}>
                    Quinas
                    <Ajuda
                      rotulo="Ajuda sobre as quinas arredondadas"
                      texto="Arredonda as 4 quinas verticais da caixa (o topo e a base continuam retos). Por padrão as 4 seguem o mesmo raio; use “Editar cada quina” pra dar um raio diferente pra cada uma."
                    />
                  </span>
                </legend>
                {quinasIndividuais ? (
                  QUINAS_CAIXA.map((quina) => {
                    const campo = chaveRaioQuina(quina);
                    const p = parametroPorChave(campo);
                    return (
                      <CampoMedida
                        key={`${chave}-${campo}`}
                        rotulo={p.rotulo}
                        valor={forma.parametros[campo] ?? 0}
                        min={p.min}
                        max={p.max}
                        {...camposFormula(campo)}
                      />
                    );
                  })
                ) : (
                  <CampoMedida
                    rotulo="Raio das quinas"
                    valor={forma.parametros[campoPrimeiraQuina] ?? 0}
                    min={parametroPorChave(campoPrimeiraQuina).min}
                    max={parametroPorChave(campoPrimeiraQuina).max}
                    onConfirmar={(valor) => {
                      for (const quina of QUINAS_CAIXA) definirCampo(chave, chaveRaioQuina(quina), { valor });
                    }}
                  />
                )}
                <div className={styles.acoesVao}>
                  <button
                    type="button"
                    className={styles.botaoSecundario}
                    onClick={() => setQuinasIndividuais((v) => !v)}
                  >
                    {quinasIndividuais ? 'Usar o mesmo raio nas 4' : 'Editar cada quina'}
                  </button>
                </div>
              </fieldset>
            )}
          </>
        )}

        {piso && podeRedimensionar && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Medidas
                <Ajuda
                  rotulo="Ajuda sobre o piso"
                  texto="Criado automaticamente ao fechar um contorno de paredes, preenchendo a área interna. O formato acompanha o contorno das paredes que o criaram; só a espessura pode ser ajustada aqui."
                />
              </span>
            </legend>
            <span className={styles.dicaCampo}>{piso.vertices.length} cantos</span>
            <CampoMedida
              rotulo="Espessura"
              valor={piso.espessura}
              min={MEDIDA_MINIMA}
              max={MEDIDA_MAXIMA}
              {...camposFormula('espessura')}
            />
          </fieldset>
        )}

        {parede && podeRedimensionar && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Medidas
                <Ajuda rotulo="Ajuda sobre as medidas da parede" texto="Comprimento no sentido da rotação da parede." />
              </span>
            </legend>
            {MEDIDAS_PAREDE.map(({ chave: chaveMedida, rotulo, max }) => (
              <CampoMedida
                key={`${chave}-parede-${chaveMedida}`}
                rotulo={rotulo}
                valor={parede[chaveMedida]}
                min={MEDIDA_MINIMA}
                max={max}
                {...camposFormula(chaveMedida)}
              />
            ))}
          </fieldset>
        )}

        {parede && podeVaos && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Vãos
                <Ajuda
                  rotulo="Ajuda sobre vãos"
                  texto="Um buraco retangular na parede, pra porta ou janela: sem folha nem vidro desenhados, só o vão. É um elemento próprio, dentro dela: selecione um na lista (ou na Estrutura) pra mover com as setas e editar as medidas dele."
                />
              </span>
            </legend>
            <div className={styles.acoesVao}>
              <button type="button" className={styles.botaoSecundario} onClick={() => adicionarAbertura(chave, 'porta')}>
                + Porta
              </button>
              <button type="button" className={styles.botaoSecundario} onClick={() => adicionarAbertura(chave, 'janela')}>
                + Janela
              </button>
            </div>
            {(filhos[chave] ?? []).flatMap((chaveVao) => {
              const vao = elementos[chaveVao];
              if (!vao?.abertura) return [];
              return (
                <button
                  key={chaveVao}
                  type="button"
                  className={styles.botaoSecundario}
                  onClick={() => selecionar(chaveVao)}
                >
                  {vao.nome} · {descreverAbertura(vao.abertura)}
                </button>
              );
            })}
          </fieldset>
        )}

        {abertura && podeVaos && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>Medidas</legend>
            <CampoMedida
              rotulo="Largura"
              valor={abertura.largura}
              min={MEDIDA_MINIMA}
              max={paredePai ? Math.max(MEDIDA_MINIMA, paredePai.comprimento - posicao.x) : MEDIDA_MAXIMA}
              {...camposFormula('largura')}
            />
            <CampoMedida
              rotulo="Altura"
              valor={abertura.altura}
              min={MEDIDA_MINIMA}
              max={paredePai ? Math.max(MEDIDA_MINIMA, paredePai.altura - posicao.z) : MEDIDA_MAXIMA}
              {...camposFormula('altura')}
            />
          </fieldset>
        )}

        {podePosicaoRotacao && (
        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>{abertura ? 'Posição na parede' : 'Posição da origem'}{!abertura && pai !== null && ' (no grupo)'}</legend>
          {(abertura ? EIXOS_ABERTURA : EIXOS).map((eixo) => {
            // Deslocamento (x) e peitoril (y) não cabem além do que sobra na parede, descontada
            // a largura/altura do próprio vão
            const maxAbertura =
              abertura && paredePai
                ? (eixo.chave === 'x' ? paredePai.comprimento : paredePai.altura) -
                  (eixo.chave === 'x' ? abertura.largura : abertura.altura)
                : LIMITE_POSICAO;
            return (
              <CampoMedida
                key={`${chave}-posicao-${eixo.chave}`}
                rotulo={eixo.rotulo}
                valor={posicao[eixo.chave]}
                min={abertura ? 0 : -LIMITE_POSICAO}
                max={abertura ? Math.max(0, maxAbertura) : LIMITE_POSICAO}
                {...camposFormula(`posicao${eixo.chave.toUpperCase()}`)}
              />
            );
          })}
        </fieldset>
        )}

        {!abertura && podePosicaoRotacao && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              Rotação
              {pai !== null && ' (no grupo)'}
            </legend>
            {EIXOS_ROTACAO.map((eixo) => (
              <CampoMedida
                key={`${chave}-rotacao-${eixo.chave}`}
                rotulo={eixo.rotulo}
                unidade={UNIDADE_GRAUS}
                valor={rotacao[eixo.chave]}
                min={-3600}
                max={3600}
                {...camposFormula(`rotacao${eixo.chave.toUpperCase()}`)}
                travado={undefined}
                onAlternarTrava={undefined}
              />
            ))}
            <div className={styles.girarRapido}>
              <button
                type="button"
                className={styles.botaoSecundario}
                onClick={() => girarEmZ(90)}
                aria-label="Girar 90 graus em Z, sentido anti-horário visto de cima"
              >
                ↺ 90°
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                onClick={() => girarEmZ(-90)}
                aria-label="Girar 90 graus em Z, sentido horário visto de cima"
              >
                ↻ 90°
              </button>
            </div>
          </fieldset>
        )}

        {podeVariaveisFormulas && (
        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>
            <span className={styles.rotuloComAjuda}>
              Variáveis
              <Ajuda
                rotulo="Ajuda sobre variáveis"
                texto="Um número ou uma fórmula. Sem prefixo, acessa outro campo ou variável deste mesmo elemento (ex.: “espessura*2”); com Parent! (ou o atalho Pr!), acessa o elemento pai (Pr!Pr! para o avô, Pr!*2 pra não repetir, e assim por diante). Os filhos deste elemento acessam esta variável com Parent!nome ou Pr!nome."
              />
            </span>
          </legend>
          {Object.entries(elemento.variaveisFormulas ?? {}).map(([nomeVariavel, texto]) => (
            <CampoVariavel
              key={nomeVariavel}
              nome={nomeVariavel}
              texto={texto}
              erro={elemento.errosFormula?.[`variavel:${nomeVariavel}`]}
              onSalvar={(novoTexto) => definirVariavel(chave, nomeVariavel, novoTexto)}
              onRemover={() => removerVariavel(chave, nomeVariavel)}
            />
          ))}
          <NovaVariavel elemento={elemento} onCriar={(nomeVariavel, texto) => definirVariavel(chave, nomeVariavel, texto)} />
        </fieldset>
        )}

        {(faces.length > 0 || tipo === 'grupo') && podeConfigurarFaces && (
          <fieldset className={styles.grupo}>
            <legend className={styles.grupoTitulo}>
              <span className={styles.rotuloComAjuda}>
                Faces
                <Ajuda
                  rotulo="Ajuda sobre configuração de faces"
                  texto="Cadastre variáveis específicas de cada face (furação, ferragem e outras medidas fixas) e, num grupo, reúna faces de peças dele em grupos de face pra pintar todas de uma vez só no balde de tinta."
                />
              </span>
            </legend>
            <button type="button" className={styles.botaoSecundario} onClick={() => setConfiguracaoFacesAberta(true)}>
              Configurar faces
            </button>
          </fieldset>
        )}
      </div>

      <ConfiguracaoFacesDialog
        aberto={configuracaoFacesAberta}
        onFechar={() => setConfiguracaoFacesAberta(false)}
        chave={chave}
        elemento={elemento}
        faces={faces}
      />
    </section>
  );
}

export interface CampoVariavelProps {
  nome: string;
  texto: string;
  erro?: string;
  onSalvar: (texto: string) => void;
  onRemover: () => void;
}

// Uma variável já criada: nome fixo (renomear quebraria referências Parent!nome em outro lugar)
// e um campo de texto livre pro valor ou fórmula, confirmado ao sair do campo ou com Enter.
// Exportado: reaproveitado também pra variáveis de face, no ConfiguracaoFacesDialog
export function CampoVariavel({ nome, texto, erro, onSalvar, onRemover }: CampoVariavelProps) {
  const [rascunho, setRascunho] = useState<string | null>(null);

  function confirmar() {
    if (rascunho === null) return;
    const limpo = rascunho.trim();
    if (limpo !== '' && limpo !== texto) onSalvar(limpo);
    setRascunho(null);
  }

  return (
    <div className={styles.variavelLinha}>
      <span className={styles.variavelNome} title={`Acesse com Parent!${nome} (ou Pr!${nome})`}>
        {nome}
      </span>
      <input
        className={styles.input}
        value={rascunho ?? texto}
        title="Número ou fórmula: sem prefixo acessa este elemento, com Parent! (ou Pr!) acessa o pai"
        aria-invalid={Boolean(erro)}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmar();
          } else if (e.key === 'Escape') {
            setRascunho(null);
          }
        }}
      />
      <button
        type="button"
        className={styles.removerVariavel}
        onClick={onRemover}
        aria-label={`Remover variável ${nome}`}
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

interface NovaVariavelProps {
  elemento: ElementoEditor;
  onCriar: (nome: string, texto: string) => void;
}

function NovaVariavel({ elemento, onCriar }: NovaVariavelProps) {
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
    if (elemento.variaveisFormulas?.[nomeLimpo]) {
      setErro('Já existe uma variável com este nome');
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


