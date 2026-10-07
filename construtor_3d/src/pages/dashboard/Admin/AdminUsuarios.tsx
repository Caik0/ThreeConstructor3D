import { useState } from 'react';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import type { Usuario } from '../../../lib/auth/auth';
import { useAtualizarPermissoesUsuario, useUsuariosAdmin } from '../../../lib/hooks/useUsuarios';
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
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [adminMarcado, setAdminMarcado] = useState(false);
  const [permissoesMarcadas, setPermissoesMarcadas] = useState<Set<PermissaoChave>>(new Set());

  function abrirEdicao(usuario: Usuario) {
    atualizar.reset();
    setEditando(usuario);
    setAdminMarcado(usuario.admin);
    setPermissoesMarcadas(new Set((usuario.permissoes ?? []) as PermissaoChave[]));
  }

  function alternarPermissao(chave: PermissaoChave) {
    setPermissoesMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
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
                  <button type="button" className={styles.botaoEditar} onClick={() => abrirEdicao(usuario)}>
                    Editar permissões
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DialogoConfirmacao
        aberto={editando !== null}
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

        <div className={adminMarcado ? styles.gruposDesabilitados : undefined}>
          {GRUPOS.map(([grupo, chaves]) => (
            <fieldset key={grupo} className={styles.grupoPermissoes} disabled={adminMarcado}>
              <legend>{grupo}</legend>
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
            </fieldset>
          ))}
        </div>
      </DialogoConfirmacao>
    </section>
  );
}
