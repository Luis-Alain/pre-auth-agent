import { SolicitudesList } from "./components/SolicitudesList";
import "./index.css";

export function App() {
  return (
    <div className="mx-auto w-full max-w-3xl p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Pre-Auth Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Solicitudes de pre autorizacion analizadas con IA (Notion + OpenAI)
        </p>
      </header>
      <SolicitudesList />
    </div>
  );
}

export default App;
