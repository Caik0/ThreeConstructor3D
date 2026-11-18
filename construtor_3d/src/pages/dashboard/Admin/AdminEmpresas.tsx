import { formatarDataHora } from '../../../lib/idioma/idioma';
import { useMemo, useState } from 'react';
import Ajuda from '../../../components/ui/Ajuda/Ajuda';
import CartaoAdmin, { GradeCartoes, type Detalhe } from '../../../components/ui/CartaoAdmin/CartaoAdmin';
import TabelaPaginada from '../../../components/ui/TabelaPaginada/TabelaPaginada';
import { usePaginacao } from '../../../lib/hooks/usePaginacao';
import { correspondeBusca } from '../../../lib/busca/busca';
import { regraCep, regraDocumento, regraTelefone } from '../../../lib/localidades/documentos';
import { PAIS_BRASIL, useCidades, useEstados, usePaises } from '../../../lib/localidades/localidades';
import BotaoIcone from '../../../components/ui/BotaoIcone/BotaoIcone';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ErroCarregamento from '../../../components/ui/ErroCarregamento/ErroCarregamento';
import { IconeRenomear } from '../../../components/ui/icones/Icones';
import type { AdminInicial, DadosEmpresa, Empresa } from '../../../lib/api/empresas';
import { NOME_COMPRIMENTO_MAXIMO, SENHA_COMPRIMENTO_MINIMO } from '../../../lib/auth/auth';
import { useAtualizarEmpresa, useBloquearEmpresa, useCriarEmpresa, useEmpresas, useIdiomas } from '../../../lib/hooks/useEmpresas';
import { CampoLocalidade, PaisSelect } from './CamposLocalidade';
import styles from './AdminUsuarios.module.css';
import estilosEmpresa from './AdminEmpresas.module.css';

// Campos de texto simples do formulário; `tamanho` repete o limite da API. O documento fiscal e o
// endereço têm tratamento próprio (dependem do país escolhido)
type CampoTexto = 'nomeFantasia' | 'responsavel' | 'email' | 'endereco' | 'numero' | 'complemento' | 'bairro';
const CAMPOS_CONTATO: { chave: CampoTexto; rotulo: string; tamanho: number; tipo?: string }[] = [
  { chave: 'nomeFantasia', rotulo: 'Nome fantasia', tamanho: 150 },
  { chave: 'responsavel', rotulo: 'Responsável', tamanho: 100 },
  { chave: 'email', rotulo: 'E-mail', tamanho: 200, tipo: 'email' },
];
const CAMPOS_LOGRADOURO: { chave: CampoTexto; rotulo: string; tamanho: number }[] = [
  { chave: 'endereco', rotulo: 'Endereço', tamanho: 150 },
  { chave: 'numero', rotulo: 'Número', tamanho: 20 },
  { chave: 'complemento', rotulo: 'Complemento', tamanho: 60 },
  { chave: 'bairro', rotulo: 'Bairro', tamanho: 80 },
];

const VAZIA: DadosEmpresa = {
  nomeRazaoSocial: '',
  nomeFantasia: null,
  cpfCnpj: null,
  documentoFiscal: null,
  responsavel: null,
  email: null,
  telefone: null,
  celular: null,
  link: null,
  endereco: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  cep: null,
  uf: null,
  estadoProvincia: null,
  pais: PAIS_BRASIL,
  fotoEmpresa: null,
  obs: null,
  versao: null,
  padraoMedida: 'cm',
  espacoArmazenamento: null,
  idiomaPadraoId: 1,
};

const ADMIN_VAZIO: AdminInicial = { nome: '', email: '', senha: '' };

function dadosDe(empresa: Empresa): DadosEmpresa {
  const { id, quemCadastrou, bloqueada, dataBloqueio, motivoBloqueio, quantidadeUsuarios, criadoEm, ...dados } = empresa;
  void id, quemCadastrou, bloqueada, dataBloqueio, motivoBloqueio, quantidadeUsuarios, criadoEm;
  return dados;
}

// Cadastro das empresas da plataforma: só o super admin chega aqui (ver RotaSuperAdmin)
export default function AdminEmpresas() {
  const consulta = useEmpresas();
  const idiomas = useIdiomas();
  const criar = useCriarEmpresa();
  const atualizar = useAtualizarEmpresa();
  const bloquear = useBloquearEmpresa();
  // `editando`: null = formulário fechado; id 0 = nova empresa
  const [editando, setEditando] = useState<{ id: number; dados: DadosEmpresa } | null>(null);
  const [admin, setAdmin] = useState<AdminInicial>(ADMIN_VAZIO);
  const [aBloquear, setABloquear] = useState<Empresa | null>(null);
  const [motivo, setMotivo] = useState('');
  // Busca e filtros da lista (feitos aqui, no navegador: a API devolve todas as empresas)
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<'todas' | 'ativas' | 'bloqueadas'>('todas');
  const [filtroPais, setFiltroPais] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  // País, estado e cidade do formulário aberto: listas das APIs públicas (ver lib/localidades)
  const pais = editando?.dados.pais ?? null;
  const brasil = pais === PAIS_BRASIL;
  const paises = usePaises();
  const nomePaisEmIngles = pais ? paises.data?.nomesEmIngles[pais] : undefined;
  const estados = useEstados(pais, nomePaisEmIngles);
  const estadoEscolhido = (brasil ? editando?.dados.uf : editando?.dados.estadoProvincia) ?? null;
  const semEstados = !brasil && estados.isSuccess && estados.data.length === 0;
  const cidades = useCidades(pais, nomePaisEmIngles, estadoEscolhido, semEstados);
  const regra = regraDocumento(pais);
  const cep = regraCep(pais);

  const nova = editando?.id === 0;
  const salvando = criar.isPending || atualizar.isPending;
  const erro = erroLocal ?? (criar.isError ? criar.error.message : atualizar.isError ? atualizar.error.message : null);

  function abrirNova() {
    criar.reset();
    atualizar.reset();
    setErroLocal(null);
    setAdmin(ADMIN_VAZIO);
    setEditando({ id: 0, dados: VAZIA });
  }

  function abrirEdicao(empresa: Empresa) {
    criar.reset();
    atualizar.reset();
    setErroLocal(null);
    setEditando({ id: empresa.id, dados: dadosDe(empresa) });
  }

  function alterar(parcial: Partial<DadosEmpresa>) {
    setErroLocal(null);
    setEditando((atual) => (atual ? { ...atual, dados: { ...atual.dados, ...parcial } } : atual));
  }

  function confirmar() {
    if (!editando || !editando.dados.nomeRazaoSocial.trim()) return;
    // Campo em branco vai como nulo: a API guarda "sem valor", não texto vazio
    const dados = { ...editando.dados, nomeRazaoSocial: editando.dados.nomeRazaoSocial.trim() };
    for (const campo of Object.keys(dados) as (keyof DadosEmpresa)[]) {
      const valor = dados[campo];
      if (typeof valor === 'string' && valor.trim() === '' && campo !== 'nomeRazaoSocial') (dados as Record<string, unknown>)[campo] = null;
    }
    // Só vale o documento do país escolhido (CPF/CNPJ no Brasil, documento fiscal fora) e o estado
    // correspondente (UF no Brasil, estado/província fora): o outro par é descartado
    const valorDocumento = dados[regra.campo];
    if (valorDocumento) {
      const problema = regra.validar(valorDocumento);
      if (problema) {
        setErroLocal(problema);
        return;
      }
    }
    if (regra.campo === 'cpfCnpj') dados.documentoFiscal = null;
    else dados.cpfCnpj = null;
    if (brasil) dados.estadoProvincia = null;
    else dados.uf = null;
    if (nova) {
      if (!admin.nome.trim() || !admin.email.trim() || !admin.senha) return;
      criar.mutate({ empresa: dados, admin: { ...admin, nome: admin.nome.trim(), email: admin.email.trim() } }, { onSuccess: () => setEditando(null) });
    } else {
      atualizar.mutate({ id: editando.id, empresa: dados }, { onSuccess: () => setEditando(null) });
    }
  }

  const empresas = consulta.data;
  const nomeDoPais = (codigo: string) => paises.data?.opcoes.find((o) => o.valor === codigo)?.rotulo ?? codigo;
  // Só os países que as empresas cadastradas realmente têm
  const paisesUsados = useMemo(() => [...new Set((empresas ?? []).map((e) => e.pais).filter((p): p is string => !!p))], [empresas]);
  const filtrando = busca.trim() !== '' || filtroSituacao !== 'todas' || filtroPais !== '';
  const visiveis = useMemo(() => {
    const digitos = busca.replace(/\D/g, '');
    return (empresas ?? []).filter((e) => {
      if (filtroSituacao === 'ativas' && e.bloqueada) return false;
      if (filtroSituacao === 'bloqueadas' && !e.bloqueada) return false;
      if (filtroPais && e.pais !== filtroPais) return false;
      if (correspondeBusca(busca, e.nomeRazaoSocial, e.nomeFantasia, e.cpfCnpj, e.documentoFiscal, e.responsavel, e.email, e.cidade, e.uf, e.estadoProvincia)) return true;
      // Documento e telefones também se acham sem pontuação: "11222333" acha "11.222.333/0001-81"
      return digitos.length >= 3 && [e.cpfCnpj, e.documentoFiscal, e.telefone, e.celular].some((v) => v?.replace(/\D/g, '').includes(digitos));
    });
  }, [empresas, busca, filtroSituacao, filtroPais]);

  const paginacao = usePaginacao(visiveis, [busca, filtroSituacao, filtroPais].join('|'));

  function limparFiltros() {
    setBusca('');
    setFiltroSituacao('todas');
    setFiltroPais('');
  }


  /** Todos os dados cadastrados da empresa, na ordem do formulário; o que não foi preenchido aparece como "—" */
  function detalhesDe(e: Empresa): Detalhe[] {
    const cep = regraCep(e.pais);
    const documento = regraDocumento(e.pais);
    const nomePais = (e.pais && paises.data?.opcoes.find((o) => o.valor === e.pais)?.rotulo) || e.pais;
    const estado = e.pais === PAIS_BRASIL ? e.uf : e.estadoProvincia;
    const idioma = idiomas.data?.find((i) => i.id === e.idiomaPadraoId);
    const unidades: Record<string, string> = { cm: 'Centímetros (cm)', mm: 'Milímetros (mm)', m: 'Metros (m)' };
    return [
      { rotulo: 'Razão social / nome', grupo: 'Identificação', valor: e.nomeRazaoSocial },
      { rotulo: 'Nome fantasia', grupo: 'Identificação', valor: e.nomeFantasia },
      { rotulo: 'País', grupo: 'Identificação', valor: nomePais },
      { grupo: 'Identificação', rotulo: documento.rotulo, valor: e.cpfCnpj ?? e.documentoFiscal },
      { rotulo: 'Responsável', grupo: 'Identificação', valor: e.responsavel },
      { rotulo: 'E-mail', grupo: 'Contato', valor: e.email },
      { rotulo: 'Telefone', grupo: 'Contato', valor: e.telefone },
      { rotulo: 'Celular', grupo: 'Contato', valor: e.celular },
      { grupo: 'Endereço', rotulo: cep.rotulo, valor: e.cep },
      { rotulo: 'Endereço', grupo: 'Endereço', valor: e.endereco },
      { rotulo: 'Número', grupo: 'Endereço', valor: e.numero },
      { rotulo: 'Complemento', grupo: 'Endereço', valor: e.complemento },
      { rotulo: 'Bairro', grupo: 'Endereço', valor: e.bairro },
      { rotulo: 'Cidade', grupo: 'Endereço', valor: e.cidade },
      { grupo: 'Endereço', rotulo: e.pais === PAIS_BRASIL ? 'Estado (UF)' : 'Estado / província', valor: estado },
      { rotulo: 'Idioma padrão', grupo: 'Plataforma', valor: idioma?.nome ?? null },
      { rotulo: 'Unidade de medida padrão', grupo: 'Plataforma', valor: unidades[e.padraoMedida] ?? e.padraoMedida },
      { rotulo: 'Armazenamento', grupo: 'Plataforma', valor: e.espacoArmazenamento === null ? null : `${(e.espacoArmazenamento / 1024 ** 3).toLocaleString()} GB` },
      { rotulo: 'Versão liberada', grupo: 'Plataforma', valor: e.versao },
      { rotulo: 'Usuários', grupo: 'Plataforma', valor: String(e.quantidadeUsuarios) },
      { rotulo: 'Cadastrada por', grupo: 'Cadastro', valor: e.quemCadastrou },
      { rotulo: 'Cadastrada em', grupo: 'Cadastro', valor: formatarDataHora(e.criadoEm) },
      { rotulo: 'Status', grupo: 'Cadastro', valor: e.bloqueada ? `Bloqueada${e.dataBloqueio ? ` em ${formatarDataHora(e.dataBloqueio)}` : ''}` : 'Ativa' },
      { rotulo: 'Motivo do bloqueio', grupo: 'Cadastro', valor: e.bloqueada ? e.motivoBloqueio : null },
      { rotulo: 'Observações', grupo: 'Cadastro', valor: e.obs },
    ];
  }

  function confirmarBloqueio() {
    if (!aBloquear) return;
    bloquear.mutate({ id: aBloquear.id, bloqueada: !aBloquear.bloqueada, motivo: aBloquear.bloqueada ? null : motivo.trim() || null }, { onSuccess: () => setABloquear(null) });
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titulo}>
          <h1>Empresas</h1>
          <Ajuda texto="Cada empresa tem os próprios usuários, módulos, texturas e projetos. Ao cadastrar uma empresa você cria o primeiro administrador dela, que passa a gerenciar os outros usuários. Uma empresa bloqueada não consegue entrar." rotulo="Sobre esta tela" />
        </div>
        <button type="button" className={styles.botaoNovo} onClick={abrirNova}>
          + Nova empresa
        </button>
      </header>

      {consulta.isPending ? (
        <p>Carregando empresas…</p>
      ) : consulta.isError ? (
        <ErroCarregamento mensagem="Não foi possível carregar as empresas" erro={consulta.error.message} onTentarDeNovo={() => consulta.refetch()} />
      ) : (
        <>
        <div className={estilosEmpresa.filtros}>
          <input
            className={`${styles.input} ${estilosEmpresa.busca}`}
            type="search"
            placeholder="Buscar por nome, documento, responsável, e-mail, cidade…"
            aria-label="Buscar empresas"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select className={styles.input} aria-label="Filtrar por status" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as typeof filtroSituacao)}>
            <option value="todas">Todos os status</option>
            <option value="ativas">Ativas</option>
            <option value="bloqueadas">Bloqueadas</option>
          </select>
          <select className={styles.input} aria-label="Filtrar por país" value={filtroPais} onChange={(e) => setFiltroPais(e.target.value)}>
            <option value="">Todos os países</option>
            {paisesUsados.map((codigo) => (
              <option key={codigo} value={codigo}>
                {nomeDoPais(codigo)}
              </option>
            ))}
          </select>
          {filtrando && (
            <button type="button" className={styles.botaoEditar} onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>
        <p className={estilosEmpresa.contagem} aria-live="polite">
          {filtrando ? `${visiveis.length} de ${consulta.data.length} empresas` : `${consulta.data.length} empresas`}
        </p>
        <TabelaPaginada paginacao={paginacao} rotuloItens="empresas">
        <GradeCartoes vazia={visiveis.length === 0 ? 'Nenhuma empresa encontrada com esses filtros.' : null}>
          {paginacao.itens.map((empresa) => (
            <CartaoAdmin
              key={empresa.id}
              titulo={empresa.nomeFantasia ?? empresa.nomeRazaoSocial}
              subtitulo={empresa.nomeFantasia ? empresa.nomeRazaoSocial : null}
              ativo={!empresa.bloqueada}
              textoStatus={empresa.bloqueada ? 'Bloqueada' : 'Ativa'}
              rotuloInterruptor={`${empresa.bloqueada ? 'Desbloquear' : 'Bloquear'} ${empresa.nomeRazaoSocial}`}
              onAlternarStatus={() => {
                bloquear.reset();
                setMotivo('');
                setABloquear(empresa);
              }}
              resumo={[
                { rotulo: regraDocumento(empresa.pais).rotulo, valor: empresa.cpfCnpj ?? empresa.documentoFiscal ?? '—' },
                { rotulo: 'Usuários', valor: empresa.quantidadeUsuarios },
              ]}
              resumoExtra={[
                { rotulo: 'Responsável', valor: empresa.responsavel || '—' },
                { rotulo: 'Telefone', valor: empresa.celular || empresa.telefone || '—' },
                { rotulo: 'Cidade / UF', valor: [empresa.cidade, empresa.pais === PAIS_BRASIL ? empresa.uf : empresa.estadoProvincia].filter(Boolean).join(' / ') || '—' },
              ]}
              detalhes={() => detalhesDe(empresa)}
              acoes={<BotaoIcone icone={<IconeRenomear />} rotulo={`Editar ${empresa.nomeRazaoSocial}`} onClick={() => abrirEdicao(empresa)} />}
            />
          ))}
        </GradeCartoes>
        </TabelaPaginada>
        </>
      )}

      <DialogoConfirmacao
        aberto={editando !== null}
        className={styles.dialogoLargo}
        titulo={nova ? 'Nova empresa' : 'Editar empresa'}
        textoConfirmar={nova ? 'Cadastrar' : 'Salvar'}
        textoConfirmando="Salvando…"
        confirmando={salvando}
        erro={erro}
        onConfirmar={confirmar}
        onCancelar={() => setEditando(null)}
      >
        {editando && (
          <div className={estilosEmpresa.formulario}>
            <label className={styles.campo}>
              <span className={styles.rotuloCampo}>Razão social / nome *</span>
              <input
                className={styles.input}
                value={editando.dados.nomeRazaoSocial}
                maxLength={150}
                onChange={(e) => alterar({ nomeRazaoSocial: e.target.value })}
              />
            </label>

            <fieldset className={estilosEmpresa.secao}>
              <legend>Dados da empresa</legend>
              <div className={estilosEmpresa.grade}>
                <label className={styles.campo}>
                  <span className={styles.rotuloCampo}>País</span>
                  <PaisSelect
                    valor={pais}
                    opcoes={paises.data?.opcoes}
                    carregando={paises.isPending}
                    falhou={paises.isError}
                    onChange={(codigo) => alterar({ pais: codigo || null, uf: null, estadoProvincia: null, cidade: null, cpfCnpj: null, documentoFiscal: null, telefone: null, celular: null })}
                  />
                </label>
                <label className={styles.campo}>
                  <span className={styles.rotuloCampo}>{regra.rotulo}</span>
                  <input
                    className={styles.input}
                    value={editando.dados[regra.campo] ?? ''}
                    maxLength={regra.tamanho}
                    placeholder={regra.placeholder}
                    onChange={(e) => alterar({ [regra.campo]: regra.formatar(e.target.value) })}
                  />
                </label>
                {CAMPOS_CONTATO.map(({ chave, rotulo, tamanho, tipo }) => (
                  <label key={chave} className={styles.campo}>
                    <span className={styles.rotuloCampo}>{rotulo}</span>
                    <input
                      className={styles.input}
                      type={tipo ?? 'text'}
                      value={editando.dados[chave] ?? ''}
                      maxLength={tamanho}
                      onChange={(e) => alterar({ [chave]: e.target.value })}
                    />
                  </label>
                ))}
                {(['telefone', 'celular'] as const).map((tipo) => {
                  const telefone = regraTelefone(pais, tipo);
                  return (
                    <label key={tipo} className={styles.campo}>
                      <span className={styles.rotuloCampo}>{tipo === 'telefone' ? 'Telefone' : 'Celular'}</span>
                      <input
                        className={styles.input}
                        type="tel"
                        value={editando.dados[tipo] ?? ''}
                        maxLength={telefone.tamanho}
                        placeholder={telefone.placeholder}
                        onChange={(e) => alterar({ [tipo]: telefone.formatar(e.target.value) })}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={estilosEmpresa.secao}>
              <legend>Endereço</legend>
              <div className={estilosEmpresa.grade}>
                <label className={styles.campo}>
                  <span className={styles.rotuloCampo}>{cep.rotulo}</span>
                  <input
                    className={styles.input}
                    value={editando.dados.cep ?? ''}
                    maxLength={cep.tamanho}
                    onChange={(e) => alterar({ cep: cep.formatar(e.target.value) })}
                  />
                </label>
                {CAMPOS_LOGRADOURO.map(({ chave, rotulo, tamanho }) => (
                  <label key={chave} className={styles.campo}>
                    <span className={styles.rotuloCampo}>{rotulo}</span>
                    <input className={styles.input} value={editando.dados[chave] ?? ''} maxLength={tamanho} onChange={(e) => alterar({ [chave]: e.target.value })} />
                  </label>
                ))}
                {!semEstados && (
                  <CampoLocalidade
                    rotulo={brasil ? 'Estado (UF)' : 'Estado / província'}
                    valor={estadoEscolhido}
                    opcoes={estados.data}
                    carregando={estados.isFetching}
                    falhou={estados.isError}
                    desabilitado={!pais}
                    tamanho={brasil ? 2 : 80}
                    onChange={(valor) => alterar(brasil ? { uf: valor || null, cidade: null } : { estadoProvincia: valor || null, cidade: null })}
                  />
                )}
                <CampoLocalidade
                  rotulo="Cidade"
                  valor={editando.dados.cidade}
                  opcoes={cidades.data}
                  carregando={cidades.isFetching}
                  falhou={cidades.isError}
                  desabilitado={!pais || (!semEstados && !estadoEscolhido)}
                  tamanho={80}
                  onChange={(valor) => alterar({ cidade: valor || null })}
                />
              </div>
            </fieldset>

            <fieldset className={estilosEmpresa.secao}>
              <legend>Plataforma</legend>
              <div className={estilosEmpresa.grade}>
                <label className={styles.campo}>
                  <span className={styles.rotuloCampo}>Idioma padrão</span>
                  <select className={styles.input} value={editando.dados.idiomaPadraoId} onChange={(e) => alterar({ idiomaPadraoId: Number(e.target.value) })}>
                    {(idiomas.data ?? []).map((idioma) => (
                      <option key={idioma.id} value={idioma.id}>
                        {idioma.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.campo}>
                  <span className={styles.rotuloCampo}>Unidade de medida padrão</span>
                  <select className={styles.input} value={editando.dados.padraoMedida} onChange={(e) => alterar({ padraoMedida: e.target.value })}>
                    <option value="cm">Centímetros (cm)</option>
                    <option value="mm">Milímetros (mm)</option>
                    <option value="m">Metros (m)</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <label className={styles.campo}>
              <span className={styles.rotuloCampo}>Observações</span>
              <textarea
                className={styles.input}
                rows={3}
                maxLength={1000}
                value={editando.dados.obs ?? ''}
                onChange={(e) => alterar({ obs: e.target.value })}
              />
            </label>

            {nova && (
              <fieldset className={estilosEmpresa.secao}>
                <legend>Primeiro administrador *</legend>
                <div className={estilosEmpresa.grade}>
                  <label className={styles.campo}>
                    <span className={styles.rotuloCampo}>Nome</span>
                    <input className={styles.input} value={admin.nome} maxLength={NOME_COMPRIMENTO_MAXIMO} onChange={(e) => setAdmin({ ...admin, nome: e.target.value })} />
                  </label>
                  <label className={styles.campo}>
                    <span className={styles.rotuloCampo}>E-mail</span>
                    <input className={styles.input} type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
                  </label>
                  <label className={styles.campo}>
                    <span className={styles.rotuloCampo}>Senha</span>
                    <input
                      className={styles.input}
                      type="password"
                      minLength={SENHA_COMPRIMENTO_MINIMO}
                      value={admin.senha}
                      onChange={(e) => setAdmin({ ...admin, senha: e.target.value })}
                    />
                  </label>
                </div>
              </fieldset>
            )}
          </div>
        )}
      </DialogoConfirmacao>

      <DialogoConfirmacao
        aberto={aBloquear !== null}
        titulo={`${aBloquear?.bloqueada ? 'Desbloquear' : 'Bloquear'} "${aBloquear?.nomeFantasia ?? aBloquear?.nomeRazaoSocial ?? ''}"?`}
        textoConfirmar={aBloquear?.bloqueada ? 'Desbloquear' : 'Bloquear'}
        textoConfirmando="Salvando…"
        confirmando={bloquear.isPending}
        erro={bloquear.isError ? bloquear.error.message : null}
        onConfirmar={confirmarBloqueio}
        onCancelar={() => setABloquear(null)}
      >
        {aBloquear?.bloqueada ? (
          'Os usuários da empresa voltam a conseguir entrar.'
        ) : (
          <>
            <p>Ninguém dessa empresa consegue entrar, e as sessões abertas caem na próxima ação. Os dados ficam guardados.</p>
            <label className={styles.campo}>
              <span className={styles.rotuloCampo}>Motivo (opcional, aparece para os usuários ao tentar entrar)</span>
              <textarea className={styles.input} rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
          </>
        )}
      </DialogoConfirmacao>
    </section>
  );
}
