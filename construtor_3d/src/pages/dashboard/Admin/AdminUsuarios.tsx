import { formatarData, formatarDataHora } from '../../../lib/idioma/idioma';
import { useMemo, useState } from 'react';
import SelecaoMultipla from '../../../components/ui/SelecaoMultipla/SelecaoMultipla';
import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import { useTelaCelular } from '../../../lib/hooks/useTelaCelular';
import CartaoAdmin, { GradeCartoes, type Detalhe } from '../../../components/ui/CartaoAdmin/CartaoAdmin';
import TabelaPaginada from '../../../components/ui/TabelaPaginada/TabelaPaginada';
import { usePaginacao } from '../../../lib/hooks/usePaginacao';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import { IconeExcluir, IconePermissoes, IconeRenomear } from '../../../components/ui/icones/Icones';
import { NOME_COMPRIMENTO_MAXIMO, SENHA_COMPRIMENTO_MINIMO, type DadosCadastraisUsuario, type Usuario } from '../../../lib/auth/auth';
import { regraDocumento, regraTelefone } from '../../../lib/localidades/documentos';
import { PAIS_BRASIL, useCidades, useEstados, usePaises } from '../../../lib/localidades/localidades';
import { CampoLocalidade, PaisSelect } from './CamposLocalidade';
import {
  useAtualizarPermissoesUsuario,
  useAtualizarUsuario,
  useBloquearUsuario,
  useCriarUsuario,
  useExcluirUsuario,
  useUsuariosAdmin,
} from '../../../lib/hooks/useUsuarios';
import { CATALOGO_PERMISSOES, type PermissaoChave } from '../../../lib/permissoes/permissoes';
import { correspondeBusca } from '../../../lib/busca/busca';
import estilosFiltro from './AdminEmpresas.module.css';
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

const DADOS_VAZIOS: DadosCadastraisUsuario = {
  telefone: null,
  celular: null,
  cpfCnpj: null,
  documentoFiscal: null,
  cidade: null,
  uf: null,
  estadoProvincia: null,
  pais: PAIS_BRASIL,
  obs: null,
};

function dadosDe(u: Usuario): DadosCadastraisUsuario {
  return {
    telefone: u.telefone,
    celular: u.celular,
    cpfCnpj: u.cpfCnpj,
    documentoFiscal: u.documentoFiscal,
    cidade: u.cidade,
    uf: u.uf,
    estadoProvincia: u.estadoProvincia,
    pais: u.pais,
    obs: u.obs,
  };
}

const ROTULO_POR_CHAVE = new Map(CATALOGO_PERMISSOES.map(({ chave, rotulo }) => [chave, rotulo]));

export default function AdminUsuarios() {
  const celular = useTelaCelular();
  const consulta = useUsuariosAdmin();
  // Busca e filtros da lista (no navegador: a API devolve todos os usuários da empresa)
  const [busca, setBusca] = useState('');
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'admins' | 'comuns'>('todos');
  const [filtroPermissoes, setFiltroPermissoes] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'bloqueados'>('todos');
  const [filtroPais, setFiltroPais] = useState('');
  const filtrando = busca.trim() !== '' || filtroAcesso !== 'todos' || filtroPermissoes.length > 0 || filtroStatus !== 'todos' || filtroPais !== '';
  const visiveis = useMemo(
    () =>
      (consulta.data ?? []).filter((u) => {
        if (filtroAcesso === 'admins' && !u.admin) return false;
        if (filtroAcesso === 'comuns' && u.admin) return false;
        if (filtroStatus === 'ativos' && u.bloqueado) return false;
        if (filtroStatus === 'bloqueados' && !u.bloqueado) return false;
        if (filtroPais && u.pais !== filtroPais) return false;
        // Administrador tem acesso a tudo, então entra em qualquer filtro de permissão
        // Com várias marcadas, o usuário precisa ter todas
        if (!u.admin && !filtroPermissoes.every((p) => (u.permissoes ?? []).includes(p))) return false;
        if (correspondeBusca(busca, u.nome, u.email, u.cpfCnpj, u.documentoFiscal, u.cidade, u.uf, u.estadoProvincia)) return true;
        // Documento e telefones também se acham sem pontuação
        const digitos = busca.replace(/\D/g, '');
        return digitos.length >= 3 && [u.cpfCnpj, u.documentoFiscal, u.telefone, u.celular].some((v) => v?.replace(/\D/g, '').includes(digitos));
      }),
    [consulta.data, busca, filtroAcesso, filtroPermissoes, filtroStatus, filtroPais],
  );
  const paisesUsados = useMemo(() => [...new Set((consulta.data ?? []).map((u) => u.pais).filter((p): p is string => !!p))], [consulta.data]);
  const paginacao = usePaginacao(visiveis, [busca, filtroAcesso, filtroPermissoes.join(','), filtroStatus, filtroPais].join('|'));

  function limparFiltros() {
    setBusca('');
    setFiltroAcesso('todos');
    setFiltroPermissoes([]);
    setFiltroStatus('todos');
    setFiltroPais('');
  }
  const atualizar = useAtualizarPermissoesUsuario();
  const atualizarInfo = useAtualizarUsuario();
  const excluir = useExcluirUsuario();
  const bloquear = useBloquearUsuario();
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
  // Cadastro pessoal do formulário aberto (criação ou edição) e erro de validação do navegador
  const [dadosForm, setDadosForm] = useState<DadosCadastraisUsuario>(DADOS_VAZIOS);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [aBloquear, setABloquear] = useState<Usuario | null>(null);
  const [motivo, setMotivo] = useState('');

  // País, estado e cidade do formulário aberto: listas das APIs públicas (ver lib/localidades)
  const pais = dadosForm.pais;
  const brasil = pais === PAIS_BRASIL;
  const paises = usePaises();
  const nomePaisEmIngles = pais ? paises.data?.nomesEmIngles[pais] : undefined;
  const estados = useEstados(pais, nomePaisEmIngles);
  const estadoEscolhido = (brasil ? dadosForm.uf : dadosForm.estadoProvincia) ?? null;
  const semEstados = !brasil && estados.isSuccess && estados.data.length === 0;
  const cidades = useCidades(pais, nomePaisEmIngles, estadoEscolhido, semEstados);
  const regra = regraDocumento(pais);

  function alterarDados(parcial: Partial<DadosCadastraisUsuario>) {
    setErroLocal(null);
    setDadosForm((atual) => ({ ...atual, ...parcial }));
  }

  /** Em branco vira nulo; só vale o documento/estado do país escolhido. Devolve null (e o erro na tela) se o documento for inválido */
  function dadosParaEnviar(): DadosCadastraisUsuario | null {
    const dados = { ...dadosForm };
    for (const campo of Object.keys(dados) as (keyof DadosCadastraisUsuario)[]) {
      if (dados[campo]?.trim() === '') dados[campo] = null;
    }
    const valorDocumento = dados[regra.campo];
    if (valorDocumento) {
      const problema = regra.validar(valorDocumento);
      if (problema) {
        setErroLocal(problema);
        return null;
      }
    }
    if (regra.campo === 'cpfCnpj') dados.documentoFiscal = null;
    else dados.cpfCnpj = null;
    if (brasil) dados.estadoProvincia = null;
    else dados.uf = null;
    return dados;
  }


  function abrirBloqueio(usuario: Usuario) {
    bloquear.reset();
    setMotivo('');
    setABloquear(usuario);
  }

  function confirmarBloqueio() {
    if (!aBloquear) return;
    bloquear.mutate(
      { id: aBloquear.id, bloqueado: !aBloquear.bloqueado, motivo: aBloquear.bloqueado ? null : motivo.trim() || null },
      { onSuccess: () => setABloquear(null) },
    );
  }

  function abrirCriacao() {
    criar.reset();
    setErroLocal(null);
    setDadosForm(DADOS_VAZIOS);
    setNomeNovo('');
    setEmailNovo('');
    setSenhaNovo('');
    setAdminMarcado(false);
    setPermissoesMarcadas(new Set());
    setCriando(true);
  }

  function confirmarCriacao() {
    if (!nomeNovo.trim() || !emailNovo.trim() || !senhaNovo) return;
    const dados = dadosParaEnviar();
    if (!dados) return;
    criar.mutate(
      { nome: nomeNovo.trim(), email: emailNovo.trim(), senha: senhaNovo, admin: adminMarcado, permissoes: [...permissoesMarcadas], dados },
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
    setErroLocal(null);
    setDadosForm(dadosDe(usuario));
    setEditandoInfo(usuario);
    setNomeInfo(usuario.nome);
    setEmailInfo(usuario.email);
  }

  function confirmarEdicaoInfo() {
    if (!editandoInfo || !nomeInfo.trim() || !emailInfo.trim()) return;
    const dados = dadosParaEnviar();
    if (!dados) return;
    atualizarInfo.mutate(
      { id: editandoInfo.id, nome: nomeInfo.trim(), email: emailInfo.trim(), dados },
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

  // Administrador + permissões marcadas: usado ao criar e ao editar o acesso de um usuário
  const seletorDePermissoes = (
    <>
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
    </>
  );

  // Cadastro pessoal, igual na criação e na edição
  const camposDados = (
    <>
      <fieldset className={estilosFiltro.secao}>
        <legend>Dados pessoais</legend>
        <div className={estilosFiltro.grade}>
          <label className={styles.campo}>
            <span className={styles.rotuloCampo}>País</span>
            <PaisSelect
              valor={pais}
              opcoes={paises.data?.opcoes}
              carregando={paises.isPending}
              falhou={paises.isError}
              onChange={(codigo) => alterarDados({ pais: codigo || null, uf: null, estadoProvincia: null, cidade: null, cpfCnpj: null, documentoFiscal: null, telefone: null, celular: null })}
            />
          </label>
          <label className={styles.campo}>
            <span className={styles.rotuloCampo}>{regra.rotulo}</span>
            <input
              className={styles.input}
              value={dadosForm[regra.campo] ?? ''}
              maxLength={regra.tamanho}
              placeholder={regra.placeholder}
              onChange={(e) => alterarDados({ [regra.campo]: regra.formatar(e.target.value) })}
            />
          </label>
          {(['telefone', 'celular'] as const).map((tipo) => {
            const telefone = regraTelefone(pais, tipo);
            return (
              <label key={tipo} className={styles.campo}>
                <span className={styles.rotuloCampo}>{tipo === 'telefone' ? 'Telefone' : 'Celular'}</span>
                <input
                  className={styles.input}
                  type="tel"
                  value={dadosForm[tipo] ?? ''}
                  maxLength={telefone.tamanho}
                  placeholder={telefone.placeholder}
                  onChange={(e) => alterarDados({ [tipo]: telefone.formatar(e.target.value) })}
                />
              </label>
            );
          })}
          {!semEstados && (
            <CampoLocalidade
              rotulo={brasil ? 'Estado (UF)' : 'Estado / província'}
              valor={estadoEscolhido}
              opcoes={estados.data}
              carregando={estados.isFetching}
              falhou={estados.isError}
              desabilitado={!pais}
              tamanho={brasil ? 2 : 80}
              onChange={(valor) => alterarDados(brasil ? { uf: valor || null, cidade: null } : { estadoProvincia: valor || null, cidade: null })}
            />
          )}
          <CampoLocalidade
            rotulo="Cidade"
            valor={dadosForm.cidade}
            opcoes={cidades.data}
            carregando={cidades.isFetching}
            falhou={cidades.isError}
            desabilitado={!pais || (!semEstados && !estadoEscolhido)}
            tamanho={80}
            onChange={(valor) => alterarDados({ cidade: valor || null })}
          />
        </div>
      </fieldset>
      <label className={styles.campo}>
        <span className={styles.rotuloCampo}>Observações</span>
        <textarea className={styles.input} rows={3} maxLength={1000} value={dadosForm.obs ?? ''} onChange={(e) => alterarDados({ obs: e.target.value })} />
      </label>
    </>
  );

  /** Todos os dados cadastrados do usuário; o que não foi preenchido aparece como "—" */
  function detalhesDe(u: Usuario): Detalhe[] {
    const documento = regraDocumento(u.pais);
    const nomePais = (u.pais && paises.data?.opcoes.find((o) => o.valor === u.pais)?.rotulo) || u.pais;
    return [
      { rotulo: 'Nome', grupo: 'Identificação', valor: u.nome },
      { rotulo: 'E-mail', grupo: 'Identificação', valor: u.email },
      { rotulo: 'País', grupo: 'Identificação', valor: nomePais },
      { grupo: 'Identificação', rotulo: documento.rotulo, valor: u.cpfCnpj ?? u.documentoFiscal },
      { rotulo: 'Telefone', grupo: 'Contato', valor: u.telefone },
      { rotulo: 'Celular', grupo: 'Contato', valor: u.celular },
      { grupo: 'Localização', rotulo: u.pais === PAIS_BRASIL ? 'Estado (UF)' : 'Estado / província', valor: u.pais === PAIS_BRASIL ? u.uf : u.estadoProvincia },
      { rotulo: 'Cidade', grupo: 'Localização', valor: u.cidade },
      { rotulo: 'Acesso', grupo: 'Acesso', valor: u.admin ? 'Administrador' : `${u.permissoes?.length ?? 0} de ${CATALOGO_PERMISSOES.length} permissões` },
      { rotulo: 'Status', grupo: 'Acesso', valor: u.bloqueado ? `Bloqueado${u.dataBloqueio ? ` em ${formatarDataHora(u.dataBloqueio)}` : ''}` : 'Ativo' },
      { rotulo: 'Motivo do bloqueio', grupo: 'Acesso', valor: u.bloqueado ? u.motivoBloqueio : null },
      { rotulo: 'Cadastrado em', grupo: 'Cadastro', valor: formatarDataHora(u.criadoEm) },
      { rotulo: 'Última alteração da senha', grupo: 'Cadastro', valor: u.ultimaAlteracaoSenha ? formatarDataHora(u.ultimaAlteracaoSenha) : null },
      { rotulo: 'Observações', grupo: 'Cadastro', valor: u.obs },
    ];
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titulo}>
          <h1>Usuários</h1>
          <Ajuda texto="Controle quais ferramentas do editor cada usuário pode usar. Um administrador tem acesso total e ignora a lista de permissões." rotulo="Sobre esta tela" />
        </div>
        <button type="button" className={styles.botaoNovo} onClick={abrirCriacao}>
          + Novo usuário
        </button>
      </header>

      {consulta.isPending ? (
        <p>Carregando usuários…</p>
      ) : consulta.isError ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar os usuários"
          erro={consulta.error.message}
          onTentarDeNovo={() => consulta.refetch()}
        />
      ) : (
        <>
        <div className={estilosFiltro.filtros}>
          <input
            className={`${styles.input} ${estilosFiltro.busca}`}
            type="search"
            placeholder="Buscar por nome, e-mail, documento, cidade…"
            aria-label="Buscar usuários"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select className={styles.input} aria-label="Filtrar por acesso" value={filtroAcesso} onChange={(e) => setFiltroAcesso(e.target.value as typeof filtroAcesso)}>
            <option value="todos">Todos os acessos</option>
            <option value="admins">Administradores</option>
            <option value="comuns">Usuários comuns</option>
          </select>
          <select className={styles.input} aria-label="Filtrar por status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
            <option value="todos">Todos os status</option>
            <option value="ativos">Ativos</option>
            <option value="bloqueados">Bloqueados</option>
          </select>
          <select className={styles.input} aria-label="Filtrar por país" value={filtroPais} onChange={(e) => setFiltroPais(e.target.value)}>
            <option value="">Todos os países</option>
            {paisesUsados.map((codigo) => (
              <option key={codigo} value={codigo}>
                {paises.data?.opcoes.find((o) => o.valor === codigo)?.rotulo ?? codigo}
              </option>
            ))}
          </select>
          <SelecaoMultipla
            vazio="Qualquer permissão"
            rotulo="Permissões"
            opcoes={CATALOGO_PERMISSOES.map(({ chave, rotulo, grupo }) => ({ valor: chave, rotulo, grupo }))}
            selecionadas={filtroPermissoes}
            onChange={setFiltroPermissoes}
          />
          {filtrando && (
            <button type="button" className={styles.botaoEditar} onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>
        <p className={estilosFiltro.contagem} aria-live="polite">
          {filtrando ? `${visiveis.length} de ${consulta.data.length} usuários` : `${consulta.data.length} usuários`}
        </p>
        <TabelaPaginada paginacao={paginacao} rotuloItens="usuários">
        <GradeCartoes vazia={visiveis.length === 0 ? 'Nenhum usuário encontrado com esses filtros.' : null}>
          {paginacao.itens.map((usuario) => (
            <CartaoAdmin
              key={usuario.id}
              titulo={usuario.nome}
              subtitulo={usuario.email}
              ativo={!usuario.bloqueado}
              textoStatus={usuario.bloqueado ? 'Bloqueado' : 'Ativo'}
              rotuloInterruptor={`${usuario.bloqueado ? 'Desbloquear' : 'Bloquear'} ${usuario.nome}`}
              onAlternarStatus={() => abrirBloqueio(usuario)}
              resumo={[
                {
                  rotulo: 'Acesso',
                  valor: usuario.admin ? (
                    <span className={styles.badgeAdmin}>Administrador</span>
                  ) : (
                    <span className={styles.contagemPermissoes}>
                      {usuario.permissoes?.length ?? 0} de {CATALOGO_PERMISSOES.length} permissões
                    </span>
                  ),
                },
                { rotulo: 'Criado em', valor: formatarData(usuario.criadoEm) },
              ]}
              resumoExtra={[
                { rotulo: 'Telefone', valor: usuario.celular || usuario.telefone || '—' },
              ]}
              detalhes={() => detalhesDe(usuario)}
              acoes={
                <>
                  {celular ? (
                    <button type="button" className={styles.botaoEditar} onClick={() => abrirEdicao(usuario)}>
                      Permissões
                    </button>
                  ) : (
                    <BotaoIcone icone={<IconePermissoes />} rotulo={`Permissões de ${usuario.nome}`} onClick={() => abrirEdicao(usuario)} />
                  )}
                  <BotaoIcone icone={<IconeRenomear />} rotulo={`Editar dados de ${usuario.nome}`} onClick={() => abrirEdicaoInfo(usuario)} />
                  <BotaoIcone
                    icone={<IconeExcluir />}
                    rotulo={`Excluir ${usuario.nome}`}
                    onClick={() => {
                      excluir.reset();
                      setAExcluir(usuario);
                    }}
                  />
                </>
              }
            />
          ))}
        </GradeCartoes>
        </TabelaPaginada>
        </>
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
        {seletorDePermissoes}
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={editandoInfo !== null}
        className={styles.dialogoLargo}
        titulo="Editar dados do usuário"
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={atualizarInfo.isPending}
        erro={erroLocal ?? (atualizarInfo.isError ? atualizarInfo.error.message : null)}
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
        {camposDados}
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={aBloquear !== null}
        titulo={`${aBloquear?.bloqueado ? 'Desbloquear' : 'Bloquear'} "${aBloquear?.nome ?? ''}"?`}
        textoConfirmar={aBloquear?.bloqueado ? 'Desbloquear' : 'Bloquear'}
        textoConfirmando="Salvando…"
        confirmando={bloquear.isPending}
        erro={bloquear.isError ? bloquear.error.message : null}
        onConfirmar={confirmarBloqueio}
        onCancelar={() => setABloquear(null)}
      >
        {aBloquear?.bloqueado ? (
          'O usuário volta a conseguir entrar.'
        ) : (
          <>
            <p>O usuário não consegue entrar e a sessão aberta dele cai na próxima ação. Os dados ficam guardados.</p>
            <label className={styles.campo}>
              <span className={styles.rotuloCampo}>Motivo (opcional, aparece para ele ao tentar entrar)</span>
              <textarea className={styles.input} rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          </>
        )}
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
        Isso apaga a conta, todos os projetos dela (com os elementos de cada um) e as texturas. Os módulos
        salvos continuam na empresa. Essa ação não tem volta.
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={criando}
        className={styles.dialogoLargo}
        titulo="Novo usuário"
        textoConfirmar="Criar"
        textoConfirmando="Criando…"
        confirmando={criar.isPending}
        erro={erroLocal ?? (criar.isError ? criar.error.message : null)}
        onConfirmar={confirmarCriacao}
        onCancelar={() => setCriando(false)}
      >
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
        {camposDados}
        {seletorDePermissoes}
      </DialogoConfirmacao>
    </section>
  );
}
