import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEmpresas } from '../../../lib/hooks/useEmpresas';
import { useTrocarEmpresaAtiva } from '../../../lib/hooks/useEmpresaAtiva';
import AlternadorTema from '../../ui/AlternadorTema/AlternadorTema';
import {
  IconeAjuda,
  IconeConfiguracoes,
  IconeClassificacoes,
  IconeEmpresas,
  IconeGrupos,
  IconeExpandir,
  IconeFechar,
  IconeMenu,
  IconeModulos,
  IconeOrcamentos,
  IconeProjetos,
  IconeRecolher,
  IconeSair,
  IconeUsuarios,
} from '../../ui/icones/Icones';
import { useAuthStore } from '../../../store/authStore';
import styles from './DashboardLayout.module.css';

interface ItemMenu {
  to: string;
  rotulo: string;
  icone: ReactNode;
}

const LINKS: ItemMenu[] = [
  { to: '/projetos', rotulo: 'Meus projetos', icone: <IconeProjetos /> },
  { to: '/modulos', rotulo: 'Módulos', icone: <IconeModulos /> },
  { to: '/orcamentos', rotulo: 'Orçamentos', icone: <IconeOrcamentos /> },
];

// Links da conta, no pé do menu, acima do nome e do botão Sair
const LINKS_CONTA: ItemMenu[] = [
  { to: '/configuracoes', rotulo: 'Configurações', icone: <IconeConfiguracoes /> },
  { to: '/ajuda', rotulo: 'Ajuda', icone: <IconeAjuda /> },
];

const CHAVE_RECOLHIDO = 'menu-recolhido';

function menuRecolhidoSalvo(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === '1';
  } catch {
    return false;
  }
}

// Só o super admin: troca o ambiente (a empresa) em que está agindo. A lista vem das empresas
// cadastradas; a escolha vale para todas as telas (projetos, módulos, usuários…) até trocar de novo.
// Usa o <select> nativo: o menu rola por dentro (overflow) e um painel próprio seria cortado
function SeletorEmpresa({ recolhido }: { recolhido: boolean }) {
  const usuario = useAuthStore((s) => s.usuario);
  const empresaAtivaId = useAuthStore((s) => s.empresaAtivaId);
  const empresas = useEmpresas();
  const trocarEmpresa = useTrocarEmpresaAtiva();
  const navigate = useNavigate();
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sem escolha feita, o ambiente é o da própria empresa do super admin
  const atualId = empresaAtivaId ?? usuario?.empresa.id ?? 0;
  const atual = empresas.data?.find((e) => e.id === atualId);
  const nomeAtual = atual ? (atual.nomeFantasia ?? atual.nomeRazaoSocial) : (usuario?.empresa.nome ?? 'Empresa');

  async function escolher(id: number) {
    if (id === atualId) return;
    setErro(null);
    setTrocando(true);
    try {
      await trocarEmpresa(id);
      navigate('/projetos');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível trocar de empresa.');
    } finally {
      setTrocando(false);
    }
  }

  return (
    <div className={styles.seletorEmpresa} title={recolhido ? `Ambiente: ${nomeAtual}` : undefined}>
      <span className={styles.icone}>
        <IconeEmpresas />
      </span>
      <select
        aria-label="Ambiente da empresa"
        value={atualId}
        disabled={trocando || empresas.isPending}
        onChange={(e) => escolher(Number(e.target.value))}
      >
        {!atual && <option value={atualId}>{nomeAtual}</option>}
        {(empresas.data ?? []).map((e) => (
          <option key={e.id} value={e.id}>
            {(e.nomeFantasia ?? e.nomeRazaoSocial) + (e.bloqueada ? ' (bloqueada)' : '')}
          </option>
        ))}
      </select>
      {erro && !recolhido && <small role="alert">{erro}</small>}
    </div>
  );
}

export default function DashboardLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  // Menu recolhido: só os ícones (o nome vira dica ao passar o mouse). Lembrado entre visitas
  const [recolhido, setRecolhido] = useState(menuRecolhidoSalvo);
  // No celular o menu é uma gaveta que abre pelo botão de hambúrguer (ver o CSS)
  const [gavetaAberta, setGavetaAberta] = useState(false);

  useEffect(() => {
    if (!gavetaAberta) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setGavetaAberta(false);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [gavetaAberta]);

  function alternarMenu() {
    setRecolhido((atual) => {
      try {
        localStorage.setItem(CHAVE_RECOLHIDO, atual ? '0' : '1');
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
      return !atual;
    });
  }

  const links: ItemMenu[] = [
    ...LINKS,
    ...(usuario?.admin ? [{ to: '/admin/usuarios', rotulo: 'Usuários', icone: <IconeUsuarios /> }] : []),
    ...(usuario?.admin
      ? [
          { to: '/admin/grupos', rotulo: 'Grupos', icone: <IconeGrupos /> },
          { to: '/admin/classificacoes', rotulo: 'Classificações', icone: <IconeClassificacoes /> },
        ]
      : []),
    ...(usuario?.superAdmin ? [{ to: '/admin/empresas', rotulo: 'Empresas', icone: <IconeEmpresas /> }] : []),
  ];

  const renderizarLink = ({ to, rotulo, icone }: ItemMenu) => (
    <NavLink
      key={to}
      to={to}
      title={recolhido ? rotulo : undefined}
      aria-label={recolhido ? rotulo : undefined}
      onClick={() => setGavetaAberta(false)}
      className={({ isActive }) => (isActive ? styles.linkAtivo : styles.link)}
    >
      <span className={styles.icone}>{icone}</span>
      <span className={styles.rotuloLink}>{rotulo}</span>
    </NavLink>
  );

  return (
    <div className={`${styles.wrapper} ${recolhido ? styles.recolhido : ''}`}>
      <header className={styles.barraMobile}>
        <button
          type="button"
          className={styles.botaoMenu}
          onClick={() => setGavetaAberta(true)}
          aria-expanded={gavetaAberta}
          aria-controls="menu-lateral"
          aria-label="Abrir o menu"
        >
          <IconeMenu />
        </button>
        <strong>Construtor 3D</strong>
      </header>
      {gavetaAberta && <div className={styles.fundo} onClick={() => setGavetaAberta(false)} aria-hidden="true" />}
      <aside id="menu-lateral" className={`${styles.sidebar} ${gavetaAberta ? styles.gavetaAberta : ''}`}>
        <div className={styles.sidebarTopo}>
          <button type="button" className={`${styles.botaoMenu} ${styles.botaoFechar}`} onClick={() => setGavetaAberta(false)} aria-label="Fechar o menu">
            <IconeFechar />
          </button>
          <button
            type="button"
            className={`${styles.botaoMenu} ${styles.botaoRecolher}`}
            onClick={alternarMenu}
            aria-expanded={!recolhido}
            aria-label={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
            title={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
          >
            {recolhido ? <IconeExpandir /> : <IconeRecolher />}
          </button>
          <AlternadorTema />
        </div>

        <nav className={styles.nav}>{links.map(renderizarLink)}</nav>

        <div className={styles.sidebarRodape}>
          {usuario?.superAdmin && <SeletorEmpresa recolhido={recolhido} />}
          <nav className={styles.navConta}>{LINKS_CONTA.map(renderizarLink)}</nav>
          {usuario && <span className={`${styles.nomeUsuario} ${styles.rotuloLink}`}>{usuario.nome}</span>}
          <button type="button" className={styles.sair} onClick={logout} title={recolhido ? 'Sair' : undefined} aria-label="Sair">
            <span className={styles.icone}>
              <IconeSair />
            </span>
            <span className={styles.rotuloLink}>Sair</span>
          </button>
        </div>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
