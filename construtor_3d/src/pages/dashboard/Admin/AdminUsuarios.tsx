import { useState } from 'react';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import { IconeExcluir, IconeRenomear } from '../../../components/ui/icones/Icones';
import { NOME_COMPRIMENTO_MAXIMO, SENHA_COMPRIMENTO_MINIMO, type Usuario } from '../../../lib/auth/auth';
import {
  useAtualizarPermissoesUsuario,
  useAtualizarUsuario,
  useCriarUsuario,
  useExcluirUsuario,
  useUsuariosAdmin,
} from '../../../lib/hooks/useUsuarios';
import { CATALOGO_PERMISSOES, type PermissaoChave } from '../../../lib/permissoes/permissoes';
import styles from './AdminUsuarios.module.css';

// Preserva a ordem de CATALOGO_PERMISSOES (já agrupado por assunto), só separando por grupo pra
// desenhar uma seção de checkboxes por vez
const GRUPOS = (() => {
  const porGrupo = new Map<string, PermissaoChave[]>();
  for (const { grupo, chave } of CATALOGO_PERMISSOES) {
    porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), chave]);
  }
  return [...porGrupo.entries()];
})();

const ROTULO_POR_CHAVE = new Map(CATALOGO_PERMISSOES.map(({ chave, rotulo }) => [chave, rotulo]));

export default function AdminUsuarios() {
  const consulta = useUsuariosAdmin();
  const atualizar = useAtualizarPermissoesUsuario();
  const atualizarInfo = useAtualizarUsuario();
  const excluir = useExcluirUsuario();
  const criar = useCriarUsuario();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [adminMarcado, setAdminMarcado] = useState(false);
  const [permissoesMarcadas, setPermissoesMarcadas] = useState<Set<PermissaoChave>>(new Set());
  const [editandoInfo, setEditandoInfo] = useState<Usuario | null>(null);
  const [nomeInfo, setNomeInfo] = useState('');
  const [emailInfo, setEmailInfo] = useState('');
  const [aExcluir, setAExcluir] = useState<Usuario | null>(null);
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [emailNovo, setEmailNovo] = useState('');
  const [senhaNovo, setSenhaNovo] = useState('');

  function abrirCriacao() {
    criar.reset();
    setNomeNovo('');
    setEmailNovo('');
    setSenhaNovo('');
    setCriando(true);
  }

  function confirmarCriacao() {
    if (!nomeNovo.trim() || !emailNovo.trim() || !senhaNovo) return;
    criar.mutate(
      { nome: nomeNovo.trim(), email: emailNovo.trim(), senha: senhaNovo },
      { onSuccess: () => setCriando(false) },
    );
  }

  function abrirEdicao(usuario: Usuario) {
    atualizar.reset();
    setEditando(usuario);
    setAdminMarcado(usuario.admin);
    setPermissoesMarcadas(new Set((usuario.permissoes ?? []) as PermissaoChave[]));
  }

  function abrirEdicaoInfo(usuario: Usuario) {
    atualizarInfo.reset();
    setEditandoInfo(usuario);
    setNomeInfo(usuario.nome);
    setEmailInfo(usuario.email);
  }

  function confirmarEdicaoInfo() {
    if (!editandoInfo || !nomeInfo.trim() || !emailInfo.trim()) return;
    atualizarInfo.mutate(
      { id: editandoInfo.id, nome: nomeInfo.trim(), email: emailInfo.trim() },
      { onSuccess: () => setEditandoInfo(null) },
    );
  }

  function confirmarExclusao() {
    if (!aExcluir) return;
    excluir.mutate(aExcluir.id, { onSuccess: () => setAExcluir(null) });
  }

  function alternarPermissao(chave: PermissaoChave) {
    setPermissoesMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  // Marca ou desmarca a seção inteira de uma vez: se já está tudo marcado, desmarca tudo; senão
  // completa o que falta
  function alternarGrupo(chaves: PermissaoChave[]) {
    setPermissoesMarcadas((atual) => {
      const todasMarcadas = chaves.every((c) => atual.has(c));
      const nova = new Set(atual);
      for (const c of chaves) {
        if (todasMarcadas) nova.delete(c);
        else nova.add(c);
      }
      return nova;
    });
  }

  function confirmarEdicao() {
    if (!editando) return;
    atualizar.mutate(
      { id: editando.id, admin: adminMarcado, permissoes: [...permissoesMarcadas] },
      { onSuccess: () => setEditando(null) },
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Usuários</h1>
        <button type="button" className={styles.botaoNovo} onClick={abrirCriacao}>
          + Novo usuário
        </button>
      </header>
      <p className={styles.ajuda}>
        Controle quais ferramentas do editor cada usuário pode usar. Um administrador tem acesso total e ignora
        a lista de permissões.
      </p>

      {consulta.isPending ? (
        <p>Carregando usuários…</p>
      ) : consulta.isError ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar os usuários"
          erro={consulta.error.message}
          onTentarDeNovo={() => consulta.refetch()}
        />
      ) : (
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Acesso</th>
              <th>Criado em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {consulta.data.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nome}</td>
                <td>{usuario.email}</td>
                <td>
                  {usuario.admin ? (
                    <span className={styles.badgeAdmin}>Administrador</span>
                  ) : (
                    <span className={styles.contagemPermissoes}>
                      {usuario.permissoes?.length ?? 0} de {CATALOGO_PERMISSOES.length} permissões
                    </span>
                  )}
                </td>
                <td>{new Date(usuario.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td>
                  <div className={styles.acoesLinha}>
                    <button type="button" className={styles.botaoEditar} onClick={() => abrirEdicao(usuario)}>
                      Permissões
                    </button>
                    <BotaoIcone
                      icone={<IconeRenomear />}
                      rotulo={`Editar dados de ${usuario.nome}`}
                      onClick={() => abrirEdicaoInfo(usuario)}
                    />
                    <BotaoIcone
                      icone={<IconeExcluir />}
                      rotulo={`Excluir ${usuario.nome}`}
                      onClick={() => {
                        excluir.reset();
                        setAExcluir(usuario);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DialogoConfirmacao
        aberto={editando !== null}
        className={styles.dialogoLargo}
        titulo={`Permissões de ${editando?.nome ?? ''}`}
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={atualizar.isPending}
        erro={atualizar.isError ? atualizar.error.message : null}
        onConfirmar={confirmarEdicao}
        onCancelar={() => setEditando(null)}
      >
        <label className={styles.linhaAdmin}>
          <input type="checkbox" checked={adminMarcado} onChange={(e) => setAdminMarcado(e.target.checked)} />
          <strong>Administrador</strong> (acesso total, ignora a lista abaixo)
        </label>

        <div className={`${styles.corpoPermissoes} ${adminMarcado ? styles.gruposDesabilitados : ''}`}>
          {GRUPOS.map(([grupo, chaves]) => {
            const marcadas = chaves.filter((c) => permissoesMarcadas.has(c)).length;
            const todasMarcadas = marcadas === chaves.length;
            return (
              <fieldset key={grupo} className={styles.grupoPermissoes} disabled={adminMarcado}>
                <legend>
                  <label className={styles.linhaSelecionarTudo}>
                    <input
                      type="checkbox"
                      checked={todasMarcadas}
                      // Controles dentro do <legend> não são desabilitados pelo fieldset
                      // disabled automaticamente (regra do HTML) — precisa repetir aqui
                      disabled={adminMarcado}
                      ref={(el) => {
                        if (el) el.indeterminate = marcadas > 0 && !todasMarcadas;
                      }}
                      onChange={() => alternarGrupo(chaves)}
                    />
                    {grupo}
                  </label>
                </legend>
                <div className={styles.listaPermissoes}>
                  {chaves.map((chave) => (
                    <label key={chave} className={styles.linhaPermissao}>
                      <input
                        type="checkbox"
                        checked={permissoesMarcadas.has(chave)}
                        onChange={() => alternarPermissao(chave)}
                      />
                      {ROTULO_POR_CHAVE.get(chave)}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={editandoInfo !== null}
        titulo="Editar dados do usuário"
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={atualizarInfo.isPending}
        erro={atualizarInfo.isError ? atualizarInfo.error.message : null}
        onConfirmar={confirmarEdicaoInfo}
        onCancelar={() => setEditandoInfo(null)}
      >
        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>Nome</span>
          <input
            className={styles.input}
            value={nomeInfo}
            maxLength={NOME_COMPRIMENTO_MAXIMO}
            onChange={(e) => setNomeInfo(e.target.value)}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>E-mail</span>
          <input
            className={styles.input}
            type="email"
            value={emailInfo}
            onChange={(e) => setEmailInfo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmarEdicaoInfo();
            }}
          />
        </label>
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={aExcluir !== null}
        titulo={`Excluir "${aExcluir?.nome ?? ''}"?`}
        textoConfirmar="Excluir usuário"
        textoConfirmando="Excluindo…"
        confirmando={excluir.isPending}
        erro={excluir.isError ? excluir.error.message : null}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setAExcluir(null)}
      >
        Isso apaga a conta, todos os projetos dela (com os elementos de cada um) e as texturas. Os módulos salvos
        ficam sem dono, acessíveis a qualquer usuário. Essa ação não tem volta.
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={criando}
        titulo="Novo usuário"
        textoConfirmar="Criar"
        textoConfirmando="Criando…"
        confirmando={criar.isPending}
        erro={criar.isError ? criar.error.message : null}
        onConfirmar={confirmarCriacao}
        onCancelar={() => setCriando(false)}
      >
        <p className={styles.ajuda}>
          Nasce sem permissão nenhuma; ajuste pelo botão "Permissões" depois de criar.
        </p>
        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>Nome</span>
          <input
            className={styles.input}
            value={nomeNovo}
            maxLength={NOME_COMPRIMENTO_MAXIMO}
            onChange={(e) => setNomeNovo(e.target.value)}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>E-mail</span>
          <input className={styles.input} type="email" value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>Senha</span>
          <input
            className={styles.input}
            type="password"
            value={senhaNovo}
            minLength={SENHA_COMPRIMENTO_MINIMO}
            onChange={(e) => setSenhaNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmarCriacao();
            }}
          />
        </label>
      </DialogoConfirmacao>
    </section>
  );
}
