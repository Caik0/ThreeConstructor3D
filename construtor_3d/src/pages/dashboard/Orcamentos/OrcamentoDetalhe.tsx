import { useParams } from 'react-router-dom';

export default function OrcamentoDetalhe() {
  const { id } = useParams();
  return <h1>Orçamento #{id}</h1>;
}