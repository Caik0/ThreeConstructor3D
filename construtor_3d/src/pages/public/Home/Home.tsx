import Card from '../../../components/ui/Card/Card';
import styles from './Home.module.css';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default function Home() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Construtor 3D</h1>
        <p>Como você quer começar?</p>
      </header>

      <div className={styles.options}>
        <Card
          variant="accent"
          to="/projetos/novo"
          icon={<PlusIcon />}
          title="Novo projeto"
          description="Comece um projeto do zero."
        />
        <Card
          to="/projetos"
          icon={<FolderIcon />}
          title="Abrir projeto"
          description="Continue de onde parou em um projeto salvo."
        />
      </div>
    </section>
  );
}
