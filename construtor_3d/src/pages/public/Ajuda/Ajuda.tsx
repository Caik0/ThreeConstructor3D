import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import CampoBusca from '../../../components/ui/CampoBusca/CampoBusca';
import VoltarLink from '../../../components/ui/VoltarLink/VoltarLink';
import { correspondeBusca } from '../../../lib/busca/busca';
import { FERRAMENTAS } from '../../editor/ProjetoEditor/ferramentas';
import { DESCRICAO_DAS_FERRAMENTAS, SECOES, type Atalho, type Bloco, type IconeAjuda, type SecaoAjuda } from './conteudo';
import styles from './Ajuda.module.css';

const propsDoIcone = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// Desenhos das abas e dos títulos; uma seção nova sem `icone` usa "livro". Pra um ícone novo,
// acrescente o nome em IconeAjuda (conteudo.ts) e o desenho aqui — o tipo Record cobra os dois.
const ICONES: Record<IconeAjuda, ReactNode> = {
  comecar: (
    <svg {...propsDoIcone}>
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </svg>
  ),
  ferramentas: (
    <svg {...propsDoIcone}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
    </svg>
  ),
  teclado: (
    <svg {...propsDoIcone}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  ),
  estrutura: (
    <svg {...propsDoIcone}>
      <path d="M4 6h16M8 12h12M12 18h8" />
    </svg>
  ),
  camera: (
    <svg {...propsDoIcone}>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  ),
  formulas: (
    <svg {...propsDoIcone}>
      <path d="M18 5H7l6 7-6 7h11" />
    </svg>
  ),
  modulos: (
    <svg {...propsDoIcone}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  ),
  colisao: (
    <svg {...propsDoIcone}>
      <rect x="3" y="3" width="11" height="11" rx="2" />
      <rect x="10" y="10" width="11" height="11" rx="2" />
    </svg>
  ),
  celular: (
    <svg {...propsDoIcone}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
  livro: (
    <svg {...propsDoIcone}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M19 19v2" />
    </svg>
  ),
};

const ICONE_DA_DICA = (
  <svg {...propsDoIcone}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
  </svg>
);

const iconeDa = (secao: SecaoAjuda) => ICONES[secao.icone ?? 'livro'];

// De onde a pessoa veio (o botão "?" do editor grava `voltarPara` no estado da navegação): só aceita
// um projeto ou módulo, pra o link nunca levar pra um endereço qualquer
const ROTA_DE_ORIGEM = /^\/(projetos|modulos)\/\d+$/;

function origemDaAjuda(estado: unknown): { para: string; rotulo: string } | null {
  const voltarPara = (estado as { voltarPara?: unknown } | null)?.voltarPara;
  if (typeof voltarPara !== 'string' || !ROTA_DE_ORIGEM.test(voltarPara)) return null;
  return { para: voltarPara, rotulo: voltarPara.startsWith('/modulos/') ? 'Voltar ao módulo' : 'Voltar ao projeto' };
}

// **negrito** e `código` dentro de um texto da ajuda
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, i) => {
        if (parte.startsWith('**')) return <strong key={i}>{parte.slice(2, -2)}</strong>;
        if (parte.startsWith('`')) return <code key={i}>{parte.slice(1, -1)}</code>;
        return <Fragment key={i}>{parte}</Fragment>;
      })}
    </>
  );
}

// 'Ctrl/⌘ + S ou Ctrl/⌘ + Y' -> uma tecla <kbd> por parte, com "ou" entre as combinações alternativas
function Teclas({ teclas }: { teclas: string }) {
  return (
    <>
      {teclas.split(' ou ').map((combinacao, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={styles.ou}> ou </span>}
          {combinacao.split(' + ').map((tecla, j) => (
            <Fragment key={j}>
              {j > 0 && <span className={styles.mais}>+</span>}
              <kbd className={styles.tecla}>{tecla}</kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}

function ListaDeAtalhos({ titulo, itens }: { titulo?: string; itens: Atalho[] }) {
  return (
    <div className={styles.grupoAtalhos}>
      {titulo && <h3>{titulo}</h3>}
      <dl className={styles.atalhos}>
        {itens.map((item) => (
          <div key={item.teclas + item.descricao} className={styles.atalho}>
            <dt>
              <Teclas teclas={item.teclas} />
            </dt>
            <dd>
              <Texto texto={item.descricao} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BlocoDaAjuda({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case 'texto':
      return (
        <p>
          <Texto texto={bloco.texto} />
        </p>
      );
    case 'passos':
      return (
        <ol className={styles.passos}>
          {bloco.itens.map((item) => (
            <li key={item}>
              <Texto texto={item} />
            </li>
          ))}
        </ol>
      );
    case 'lista':
      return (
        <ul className={styles.lista}>
          {bloco.itens.map((item) => (
            <li key={item}>
              <Texto texto={item} />
            </li>
          ))}
        </ul>
      );
    case 'dica':
      return (
        <aside className={styles.dica}>
          <span className={styles.iconeDaDica}>{ICONE_DA_DICA}</span>
          <p>
            <strong>Dica: </strong>
            <Texto texto={bloco.texto} />
          </p>
        </aside>
      );
    case 'atalhos':
      return <ListaDeAtalhos titulo={bloco.titulo} itens={bloco.itens} />;
    case 'ferramentas':
      return (
        <ul className={styles.ferramentas}>
          {FERRAMENTAS.map((f) => (
            <li key={f.id} className={styles.ferramenta}>
              <span className={styles.iconeDaFerramenta}>{f.icone}</span>
              <div>
                <h3>
                  {f.rotulo} <kbd className={styles.tecla}>{f.atalho}</kbd>
                </h3>
                <p>
                  <Texto texto={DESCRICAO_DAS_FERRAMENTAS[f.id]} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      );
    case 'atalhos-das-ferramentas':
      return (
        <ListaDeAtalhos
          titulo="Trocar de ferramenta"
          itens={FERRAMENTAS.map((f) => ({ teclas: f.atalho, descricao: f.rotulo }))}
        />
      );
  }
}

// Tudo que a busca enxerga de uma seção: título, resumo e o texto de cada bloco (inclusive as
// ferramentas, que vêm do registro e não estão escritas em conteudo.ts)
function textoDaSecao(secao: SecaoAjuda): string {
  const partes = [secao.titulo, secao.resumo];
  for (const bloco of secao.blocos) {
    if (bloco.tipo === 'texto' || bloco.tipo === 'dica') partes.push(bloco.texto);
    else if (bloco.tipo === 'passos' || bloco.tipo === 'lista') partes.push(...bloco.itens);
    else if (bloco.tipo === 'atalhos') partes.push(bloco.titulo ?? '', ...bloco.itens.flatMap((a) => [a.teclas, a.descricao]));
    else if (bloco.tipo === 'ferramentas') {
      partes.push(...FERRAMENTAS.flatMap((f) => [f.rotulo, f.atalho, DESCRICAO_DAS_FERRAMENTAS[f.id]]));
    } else partes.push(...FERRAMENTAS.flatMap((f) => [f.rotulo, f.atalho]));
  }
  return partes.join(' ');
}

export default function Ajuda() {
  const [busca, setBusca] = useState('');
  const location = useLocation();
  // Guardado na montagem: o estado da navegação é a única fonte, e a página não deve perdê-lo ao rolar
  const [origem] = useState(() => origemDaAjuda(location.state));
  const secoes = useMemo(() => SECOES.filter((s) => correspondeBusca(busca, textoDaSecao(s))), [busca]);

  // Aba da seção que está à vista: acompanha a rolagem (ver o efeito abaixo) e, num clique, muda na hora
  const [ativaBruta, setAtiva] = useState(SECOES[0]?.id ?? '');
  const ativa = secoes.some((s) => s.id === ativaBruta) ? ativaBruta : (secoes[0]?.id ?? '');

  // Abrindo /ajuda#atalhos (links vindos do editor): vai direto pra seção quando a página monta
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView();
    setAtiva(id);
  }, []);

  // Seção ativa = a última cujo topo já passou da linha a ~25% da altura da tela. Quando a página
  // chega ao FIM, vale a última seção: ela costuma ser curta e nunca subiria até a linha (por isso a
  // aba dela não acendia). O rAF junta os eventos de rolagem num cálculo por quadro.
  useEffect(() => {
    if (secoes.length === 0) return;
    let agendado = 0;
    const calcular = () => {
      agendado = 0;
      const linha = window.innerHeight * 0.25;
      let atual = secoes[0].id;
      for (const secao of secoes) {
        const elemento = document.getElementById(secao.id);
        if (elemento && elemento.getBoundingClientRect().top <= linha) atual = secao.id;
      }
      const noFimDaPagina = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (noFimDaPagina) atual = secoes[secoes.length - 1].id;
      setAtiva(atual);
    };
    const aoRolar = () => {
      if (!agendado) agendado = requestAnimationFrame(calcular);
    };
    calcular();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      cancelAnimationFrame(agendado);
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
    };
  }, [secoes]);

  // Na faixa horizontal de abas (telas estreitas), mantém a aba ativa visível
  useEffect(() => {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelector('[data-aba-ativa="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [ativa]);

  return (
    <section className={styles.pagina}>
      {origem ? <VoltarLink to={origem.para}>{origem.rotulo}</VoltarLink> : <VoltarLink to="/">Início</VoltarLink>}
      <header className={styles.cabecalho}>
        <h1>Ajuda</h1>
        <p>Ferramentas, atalhos e como o sistema funciona.</p>
        <CampoBusca
          className={styles.campoBusca}
          valor={busca}
          onChange={setBusca}
          placeholder="Pesquisar na ajuda (ex.: girar, fórmula, Ctrl)"
        />
      </header>

      <div className={styles.corpo}>
        <nav aria-label="Seções da ajuda" className={styles.indice}>
          <ul>
            {secoes.map((secao) => (
              <li key={secao.id}>
                <a
                  href={`#${secao.id}`}
                  className={styles.aba}
                  aria-current={ativa === secao.id ? 'true' : undefined}
                  data-aba-ativa={ativa === secao.id}
                  onClick={(e) => {
                    // Rola e troca o #, mas SUBSTITUI a entrada do histórico em vez de criar outra: assim o
                    // estado da navegação (de onde a pessoa veio) não se perde e o "voltar" do navegador
                    // sai direto da ajuda
                    e.preventDefault();
                    document.getElementById(secao.id)?.scrollIntoView();
                    window.history.replaceState(window.history.state, '', `#${secao.id}`);
                    setAtiva(secao.id);
                  }}
                >
                  <span className={styles.iconeDaAba}>{iconeDa(secao)}</span>
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.conteudo}>
          {secoes.length === 0 && <p className={styles.vazio}>Nada encontrado para “{busca}”. Tente outra palavra.</p>}
          {secoes.map((secao) => (
            <article key={secao.id} id={secao.id} className={styles.secao}>
              <header className={styles.cabecalhoDaSecao}>
                <span className={styles.iconeDaSecao}>{iconeDa(secao)}</span>
                <div>
                  <h2>{secao.titulo}</h2>
                  <p className={styles.resumo}>{secao.resumo}</p>
                </div>
              </header>
              {secao.blocos.map((bloco, i) => (
                <BlocoDaAjuda key={i} bloco={bloco} />
              ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
