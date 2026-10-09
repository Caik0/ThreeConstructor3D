import { useRef, useState } from 'react';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import { useSalvarModulo } from '../../../lib/hooks/useModulos';
import { converterGlbEmModulo } from '../../../lib/modelo3d/importarGlb';
import { MODELO3D_TAMANHO_MAXIMO, TAMANHO_NOME_ELEMENTO, type ElementoEntrada } from '../../../lib/projetos/projetos';
import styles from './ModulosList.module.css';

interface ImportarModelo3dProps {
  className?: string;
}

// Botão que abre o seletor de arquivo, valida e separa um .glb em partes (uma peça por malha,
// dentro de um grupo novo) e, dando certo, pede o nome antes de salvar como um módulo novo — mesmo
// destino de "Salvar como módulo" no editor (POST /api/modulos), só que a origem é um arquivo
export default function ImportarModelo3d({ className }: ImportarModelo3dProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const salvarModulo = useSalvarModulo();
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
      setNome(elemento.nome.slice(0, TAMANHO_NOME_ELEMENTO));
      setPendente(elemento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler esse arquivo como um .glb válido.');
    } finally {
      setProcessando(false);
    }
  }

  function confirmarImportacao() {
    if (!pendente || !nome.trim()) return;
    salvarModulo.mutate(
      { nome: nome.trim(), elemento: pendente },
      { onSuccess: () => setPendente(null) },
    );
  }

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
        titulo="Nome do módulo"
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={salvarModulo.isPending}
        erro={salvarModulo.isError ? salvarModulo.error.message : null}
        onConfirmar={confirmarImportacao}
        onCancelar={() => setPendente(null)}
      >
        {pendente && pendente.filhos && pendente.filhos.length > 1 && (
          <p className={styles.ajuda}>
            {pendente.filhos.length} partes encontradas no arquivo — todas dentro de um grupo.
          </p>
        )}
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome do módulo</span>
          <input
            className={styles.input}
            value={nome}
            maxLength={TAMANHO_NOME_ELEMENTO}
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
