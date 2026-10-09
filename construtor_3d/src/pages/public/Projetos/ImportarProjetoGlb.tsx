import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import { useImportarProjetoGlb } from '../../../lib/hooks/useProjetos';
import { converterGlbEmModulo } from '../../../lib/modelo3d/importarGlb';
import { MODELO3D_TAMANHO_MAXIMO, type ElementoEntrada } from '../../../lib/projetos/projetos';
import styles from './ProjetosList.module.css';

interface ImportarProjetoGlbProps {
  className?: string;
}

// Mesmo limite de Dtos/ProjetoDtos.cs (CriarProjetoRequest.Nome) — não o de um nome de elemento
// (TAMANHO_NOME_ELEMENTO, 60), que é outra coisa
const NOME_PROJETO_TAMANHO_MAXIMO = 100;

// Um projeto de .glb não tem teto de elementos (ver useImportarProjetoGlb), mas cada peça vira um
// objeto 3D próprio no editor — um arquivo bem detalhado (ex.: uma planta inteira, malha por
// malha) pode virar milhares deles, e isso pesa pro navegador navegar depois. Sem um jeito de
// resolver isso de verdade ainda (juntar malhas repetidas, etc.), pelo menos avisa antes de criar
const AVISO_TOTAL_ELEMENTOS = 500;

function contarElementos(elemento: ElementoEntrada): number {
  return 1 + (elemento.filhos ?? []).reduce((soma, filho) => soma + contarElementos(filho), 0);
}

// Botão que abre o seletor de arquivo, separa um .glb em partes (uma peça por malha, dentro de um
// grupo novo — mesma conversão de ImportarModelo3d, na tela de módulos) e, dando certo, pede o
// nome do projeto antes de criar: o projeto nasce direto com essa árvore como conteúdo, sem passar
// por módulo nenhum. Sem teto de elementos (ver useImportarProjetoGlb) e até 1 GB de arquivo (ver
// MODELO3D_TAMANHO_MAXIMO)
export default function ImportarProjetoGlb({ className }: ImportarProjetoGlbProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const importarProjeto = useImportarProjetoGlb();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<ElementoEntrada | null>(null);
  const [nome, setNome] = useState('');

  async function selecionarArquivo(arquivo: File) {
    setErro(null);

    if (!arquivo.name.toLowerCase().endsWith('.glb')) {
      setErro('Escolha um arquivo .glb.');
      return;
    }
    if (arquivo.size > MODELO3D_TAMANHO_MAXIMO) {
      setErro(`O arquivo pode ter no máximo ${MODELO3D_TAMANHO_MAXIMO / 1024 / 1024} MB.`);
      return;
    }

    setProcessando(true);
    try {
      const bytes = await arquivo.arrayBuffer();
      const elemento = await converterGlbEmModulo(bytes, arquivo.name);
      setNome(elemento.nome.slice(0, NOME_PROJETO_TAMANHO_MAXIMO));
      setPendente(elemento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler esse arquivo como um .glb válido.');
    } finally {
      setProcessando(false);
    }
  }

  function confirmarImportacao() {
    if (!pendente || !nome.trim()) return;
    importarProjeto.mutate(
      { nome: nome.trim(), elemento: pendente },
      { onSuccess: (projeto) => navigate(`/projetos/${projeto.id}`) },
    );
  }

  const totalElementos = pendente ? contarElementos(pendente) : 0;

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={processando}
        onClick={() => inputRef.current?.click()}
      >
        {processando ? 'Processando…' : '+ Importar'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".glb"
        className={styles.inputArquivoOculto}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (arquivo) void selecionarArquivo(arquivo);
        }}
      />
      {erro && (
        <p role="alert" className={styles.erroImportacao}>
          {erro}
        </p>
      )}

      <DialogoConfirmacao
        aberto={pendente !== null}
        titulo="Nome do projeto"
        textoConfirmar="Criar projeto"
        textoConfirmando="Criando…"
        confirmando={importarProjeto.isPending}
        erro={importarProjeto.isError ? importarProjeto.error.message : null}
        onConfirmar={confirmarImportacao}
        onCancelar={() => setPendente(null)}
      >
        {pendente && pendente.filhos && pendente.filhos.length > 1 && (
          <p className={styles.ajuda}>
            {pendente.filhos.length} partes encontradas no arquivo — todas dentro de um grupo.
          </p>
        )}
        {totalElementos > AVISO_TOTAL_ELEMENTOS && (
          <p className={styles.erroImportacao} role="alert">
            Atenção: esse arquivo vai virar {totalElementos} elementos no projeto. Um projeto tão grande pode
            deixar o editor lento pra navegar.
          </p>
        )}
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome do projeto</span>
          <input
            className={styles.input}
            value={nome}
            maxLength={NOME_PROJETO_TAMANHO_MAXIMO}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmarImportacao();
            }}
          />
        </label>
      </DialogoConfirmacao>
    </>
  );
}
