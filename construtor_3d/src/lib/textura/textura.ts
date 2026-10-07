/** Maior lado (px) da imagem guardada: texturas maiores que isso só pesam no projeto sem ganho visível */
export const TEXTURA_LADO_MAXIMO = 1024;
const QUALIDADE_JPEG = 0.85;

/**
 * Qualquer formato de imagem serve de entrada (JPEG, PNG, WEBP, GIF, BMP...) — o navegador decodifica
 * e este canvas sempre recomprime pro mesmo formato final (JPEG, reduzido a `TEXTURA_LADO_MAXIMO`
 * px no maior lado), que é como a textura é guardada no elemento. Usado tanto pro arquivo escolhido
 * na tela (ver lerTexturaJpeg) quanto pro que chega pronto da pasta de importação do servidor (ver
 * useImportacaoAutomaticaTexturas), já que os bytes ali também podem não ser JPEG
 */
export async function converterParaTexturaJpeg(bytes: Blob | ArrayBuffer): Promise<string> {
  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(bytes instanceof Blob ? bytes : new Blob([bytes]));
  } catch {
    throw new Error('Não foi possível ler esta imagem.');
  }

  const fator = Math.min(1, TEXTURA_LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagem.width * fator));
  canvas.height = Math.max(1, Math.round(imagem.height * fator));
  canvas.getContext('2d')?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close();
  return canvas.toDataURL('image/jpeg', QUALIDADE_JPEG);
}

const EXTENSAO_IMAGEM = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

/** Lê uma imagem (qualquer formato comum) escolhida pelo usuário — ver `converterParaTexturaJpeg` */
export async function lerTexturaJpeg(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/') && !EXTENSAO_IMAGEM.test(arquivo.name)) {
    throw new Error('Escolha um arquivo de imagem.');
  }
  return converterParaTexturaJpeg(arquivo);
}

/**
 * Uma cor sólida (ex.: "#3a7bd5", como um `<input type="color">` devolve) é básica demais pra
 * virar arquivo: fica direto nesse formato no campo de textura da face, sem gerar nenhuma imagem
 * nem passar pelo armazenamento de arquivos — só uma URL de arquivo ou um data URL JPEG são
 * mesmo uma imagem (ver Formas.EhCorSolida na API)
 */
export function ehCorSolida(valor: string): boolean {
  return valor.startsWith('#');
}
